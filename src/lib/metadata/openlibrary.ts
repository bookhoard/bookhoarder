import { openLibraryUserAgent } from "./user-agent";
import { fetchJson as fetchJsonWithRetry } from "./http";
import { roundRobinMerge } from "./merge";
import type { TrendingBook } from "../trending";

export interface MetadataLookupResult {
  /** Open Library work key, e.g. "/works/OL166894W" — used to lazily fetch the description */
  key?: string;
  title?: string;
  authors?: string[];
  language?: string;
  description?: string;
  coverUrl?: string;
}

interface OpenLibraryIsbnResponse {
  title?: string;
  covers?: number[];
  description?: string | { value: string };
}

interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  language?: string[];
  subject?: string[];
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

interface OpenLibraryWorkResponse {
  description?: string | { value: string };
  covers?: number[];
}

interface OpenLibraryEditionDoc {
  key?: string;
  title?: string;
  covers?: number[];
  languages?: { key: string }[];
  works?: { key: string }[];
  /** Rare — most editions don't carry their own description, only the work does */
  description?: string | { value: string };
}

interface OpenLibraryEditionsResponse {
  entries?: OpenLibraryEditionDoc[];
}

function descriptionText(value: string | { value: string } | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.value;
}

function languageLabel(key?: string): string | undefined {
  return key?.replace("/languages/", "");
}

function fetchJson<T>(url: string): Promise<T | null> {
  return fetchJsonWithRetry<T>(url, { headers: { "User-Agent": openLibraryUserAgent() } });
}

/**
 * Up to `limit` candidates so the caller can pick the right edition. Rather
 * than a loose full-text search (which mixes in unrelated books), this finds
 * the single best-matching work by title+author, then lists up to one
 * candidate per language from that work's editions — so the carousel shows
 * the SAME book across languages instead of different books entirely.
 * No confidence scoring or auto-apply here (see plans/2.md for the fuller
 * sync design); the user picks.
 */
export async function lookupOpenLibraryCandidates(
  query: {
    isbn?: string;
    title: string;
    author: string;
  },
  limit = 10
): Promise<MetadataLookupResult[]> {
  const candidates: MetadataLookupResult[] = [];

  if (query.isbn) {
    const byIsbn = await fetchJson<OpenLibraryIsbnResponse>(
      `https://openlibrary.org/isbn/${encodeURIComponent(query.isbn)}.json`
    );
    if (byIsbn) {
      candidates.push({
        title: byIsbn.title,
        description: descriptionText(byIsbn.description),
        coverUrl: byIsbn.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${byIsbn.covers[0]}-L.jpg`
          : undefined,
      });
    }
  }

  const titleParam = encodeURIComponent(query.title);
  const authorParam = encodeURIComponent(query.author);
  const workSearch = await fetchJson<OpenLibrarySearchResponse>(
    `https://openlibrary.org/search.json?title=${titleParam}&author=${authorParam}&fields=key,title,author_name&limit=1`
  );
  const work = workSearch?.docs?.[0];

  if (work?.key) {
    const [editions, workDetail] = await Promise.all([
      fetchJson<OpenLibraryEditionsResponse>(`https://openlibrary.org${work.key}/editions.json?limit=50`),
      fetchJson<OpenLibraryWorkResponse>(`https://openlibrary.org${work.key}.json`),
    ]);
    const entries = editions?.entries ?? [];
    // Most editions don't carry their own cover even when the work has one —
    // fall back to the work's cover so candidates aren't left blank.
    const workCoverUrl = workDetail?.covers?.[0]
      ? `https://covers.openlibrary.org/b/id/${workDetail.covers[0]}-L.jpg`
      : undefined;

    // One edition per language — preferring whichever has a cover — so the
    // carousel reads as "this book, in each language" rather than a pile of
    // near-duplicate reprints.
    const byLanguage = new Map<string, OpenLibraryEditionDoc>();
    for (const edition of entries) {
      const lang = languageLabel(edition.languages?.[0]?.key) ?? "unknown";
      const existing = byLanguage.get(lang);
      if (!existing || (!existing.covers?.length && edition.covers?.length)) {
        byLanguage.set(lang, edition);
      }
    }

    const englishFirst = (a: [string, OpenLibraryEditionDoc], b: [string, OpenLibraryEditionDoc]) => {
      const aEng = a[0] === "eng" ? 0 : 1;
      const bEng = b[0] === "eng" ? 0 : 1;
      return aEng - bEng;
    };

    for (const [lang, edition] of [...byLanguage.entries()].sort(englishFirst)) {
      candidates.push({
        key: edition.works?.[0]?.key ?? work.key,
        title: edition.title || work.title,
        authors: work.author_name,
        language: lang === "unknown" ? undefined : lang,
        // Prefer the edition's own description (rare) over the work's
        // (language-independent, but still better than an empty state).
        description: descriptionText(edition.description) ?? descriptionText(workDetail?.description),
        coverUrl: edition.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg`
          : workCoverUrl,
      });
      if (candidates.length >= limit) break;
    }
  }

  // Fall back to a loose full-text search if no work matched (or it has no
  // editions on record) so a lookup still returns something.
  if (candidates.length === 0) {
    const q = encodeURIComponent(`${query.title} ${query.author}`.trim());
    const search = await fetchJson<OpenLibrarySearchResponse>(
      `https://openlibrary.org/search.json?q=${q}&fields=key,title,author_name,cover_i,language&limit=${limit}`
    );
    for (const doc of search?.docs ?? []) {
      candidates.push({
        key: doc.key,
        title: doc.title,
        authors: doc.author_name,
        language: doc.language?.[0],
        coverUrl: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
          : undefined,
      });
    }
  }

  return candidates.slice(0, limit);
}

/** Lazy fetch — only called for whichever candidate the user actually picks. */
export async function fetchOpenLibraryDescription(key: string): Promise<string | undefined> {
  const work = await fetchJson<OpenLibraryWorkResponse>(`https://openlibrary.org${key}.json`);
  return descriptionText(work?.description);
}

interface OpenLibrarySubjectWork {
  key?: string;
  title?: string;
  cover_id?: number;
  authors?: { name?: string }[];
}

interface OpenLibrarySubjectResponse {
  works?: OpenLibrarySubjectWork[];
}

// Subjects that are too broad to signal "similar" (nearly every book in the
// catalog carries one of these) or that are catalog housekeeping tags rather
// than genre/topic signals.
const GENERIC_SUBJECTS = new Set([
  "fiction",
  "nonfiction",
  "history",
  "biography",
  "juvenile fiction",
  "large type books",
  "accessible book",
  "protected daisy",
  "in library",
  "overdrive",
  "internet archive wishlist",
  "lending library",
  "open library staff picks",
  "new york times bestseller",
  "new york times reviewed",
]);

function isUsableSubject(subject: string): boolean {
  const normalized = subject.toLowerCase();
  if (GENERIC_SUBJECTS.has(normalized)) return false;
  if (normalized.includes("bestseller")) return false;
  // Catalog codes like "nyt:trade-fiction-paperback=2020-08-30" or
  // "Trojan War. fast (OCoLC)fst01157294" aren't real subjects to browse by.
  if (/[():]/.test(subject)) return false;
  if (/\d/.test(subject)) return false;
  return true;
}

function slugifySubject(subject: string): string {
  return subject
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Open Library has no "similar books" endpoint, so this approximates one:
 * find the book's work, then browse a few of its subject tags via the
 * `/subjects/{slug}.json` endpoint and pool the other works listed there.
 * Broad/generic subjects (e.g. "Fiction") and catalog housekeeping tags are
 * filtered out first so results stay on-topic instead of just "any novel".
 * Results are interleaved across subjects (rather than draining the first
 * subject before moving to the next) so one broad tag like "American
 * literature" can't crowd out a more specific one like "Queer".
 */
export async function lookupSimilarBooks(
  query: { title: string; author: string },
  limit = 12
): Promise<TrendingBook[]> {
  const titleParam = encodeURIComponent(query.title);
  const authorParam = encodeURIComponent(query.author);
  const workSearch = await fetchJson<OpenLibrarySearchResponse>(
    `https://openlibrary.org/search.json?title=${titleParam}&author=${authorParam}&fields=key,title,author_name,subject&limit=1`
  );
  const work = workSearch?.docs?.[0];
  if (!work?.key) return [];

  const subjects = (work.subject ?? []).filter(isUsableSubject).slice(0, 4);
  const perSubjectBooks = await Promise.all(
    subjects.map(async (subject): Promise<TrendingBook[]> => {
      const slug = slugifySubject(subject);
      if (!slug) return [];
      const subjectResponse = await fetchJson<OpenLibrarySubjectResponse>(
        `https://openlibrary.org/subjects/${slug}.json?limit=${limit}`
      );
      return (subjectResponse?.works ?? [])
        .filter((w) => !!w.key && !!w.title)
        .map((w) => ({
          key: w.key!,
          title: w.title!,
          authors: w.authors?.map((a) => a.name).filter((n): n is string => Boolean(n)),
          coverUrl: w.cover_id ? `https://covers.openlibrary.org/b/id/${w.cover_id}-M.jpg` : undefined,
        }));
    })
  );

  return roundRobinMerge(perSubjectBooks, (b) => b.key, limit, [work.key]);
}
