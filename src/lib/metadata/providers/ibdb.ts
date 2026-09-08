import { openLibraryUserAgent } from "../user-agent";
import { fetchJson } from "../http";
import type { MetadataCandidate, MetadataProviderQuery } from "../types";

// https://ibdb.dev — a free, unofficial Internet Book Database with its own JSON search API.
const SEARCH_URL = "https://ibdb.dev/api/search";
const SOURCE_LABEL = "IBDb";

interface IbdbBook {
  id?: string;
  title?: string;
  authors?: { name?: string }[];
  synopsis?: string;
  language?: string;
  image?: { url?: string };
}

interface IbdbSearchResponse {
  books?: IbdbBook[];
}

export async function searchIbdb(
  query: MetadataProviderQuery,
  limit = 10
): Promise<MetadataCandidate[]> {
  const q = encodeURIComponent(`${query.title} ${query.author}`.trim());
  const data = await fetchJson<IbdbSearchResponse>(`${SEARCH_URL}?q=${q}`, {
    headers: { "User-Agent": openLibraryUserAgent() },
  });

  const candidates: MetadataCandidate[] = [];
  for (const book of data?.books ?? []) {
    if (!book.id || !book.title) continue;
    candidates.push({
      key: book.id,
      title: book.title,
      authors: book.authors?.map((a) => a.name).filter((n): n is string => Boolean(n)),
      language: book.language,
      description: book.synopsis,
      coverUrl: book.image?.url,
      source: "ibdb",
      sourceLabel: SOURCE_LABEL,
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}
