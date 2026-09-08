import { openLibraryUserAgent } from "../user-agent";
import { fetchJson } from "../http";
import { roundRobinMerge } from "../merge";
import type { MetadataCandidate, MetadataProviderQuery, DiscoveredBook } from "../types";

// https://developers.google.com/books/docs/v1/using — free, no API key required.
const SEARCH_URL = "https://www.googleapis.com/books/v1/volumes";
const SOURCE_LABEL = "Google Books";

interface GoogleVolumeInfo {
  title?: string;
  authors?: string[];
  description?: string;
  language?: string;
  categories?: string[];
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
}

interface GoogleVolume {
  id: string;
  volumeInfo?: GoogleVolumeInfo;
}

interface GoogleBooksResponse {
  items?: GoogleVolume[];
}

function coverUrl(info: GoogleVolumeInfo): string | undefined {
  const thumbnail = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  if (!thumbnail) return undefined;
  return thumbnail.replace("http://", "https://").replace("&edge=curl", "");
}

async function searchByQuery(q: string, limit: number): Promise<GoogleVolume[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&maxResults=${Math.min(limit, 40)}`;
  const data = await fetchJson<GoogleBooksResponse>(url, {
    headers: { "User-Agent": openLibraryUserAgent() },
  });
  return data?.items ?? [];
}

export async function searchGoogleBooks(
  query: MetadataProviderQuery,
  limit = 10
): Promise<MetadataCandidate[]> {
  const terms = [`intitle:${query.title}`];
  if (query.author) terms.push(`inauthor:${query.author}`);
  const items = await searchByQuery(terms.join(" "), limit);

  const candidates: MetadataCandidate[] = [];
  for (const item of items) {
    const info = item.volumeInfo;
    if (!info?.title) continue;
    candidates.push({
      key: item.id,
      title: info.title,
      authors: info.authors,
      language: info.language,
      description: info.description,
      coverUrl: coverUrl(info),
      source: "google",
      sourceLabel: SOURCE_LABEL,
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

/**
 * Google Books has no "similar books" endpoint either, so this mirrors the
 * Open Library approach: find the book's own categories, then browse each
 * category via subject: search and pool the results — interleaved so one
 * category can't crowd out the others.
 */
export async function searchGoogleBooksSimilar(
  query: MetadataProviderQuery,
  limit = 12
): Promise<DiscoveredBook[]> {
  const terms = [`intitle:${query.title}`];
  if (query.author) terms.push(`inauthor:${query.author}`);
  const [seed] = await searchByQuery(terms.join(" "), 1);
  const categories = seed?.volumeInfo?.categories ?? [];
  if (!seed || categories.length === 0) return [];

  const perCategoryBooks = await Promise.all(
    categories.slice(0, 4).map(async (category): Promise<DiscoveredBook[]> => {
      const items = await searchByQuery(`subject:"${category}"`, limit);
      return items
        .filter((item) => !!item.volumeInfo?.title)
        .map((item) => ({
          key: item.id,
          title: item.volumeInfo!.title!,
          authors: item.volumeInfo!.authors,
          coverUrl: coverUrl(item.volumeInfo!),
          source: "google" as const,
          sourceLabel: SOURCE_LABEL,
        }));
    })
  );

  return roundRobinMerge(perCategoryBooks, (b) => b.key, limit, [seed.id]);
}
