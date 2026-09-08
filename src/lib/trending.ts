import { openLibraryUserAgent } from "./metadata/user-agent";
import { fetchJson } from "./metadata/http";

export type TrendingPeriod = "daily" | "weekly" | "monthly";

export const TRENDING_PERIODS: { id: TrendingPeriod; label: string }[] = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This Week" },
  { id: "monthly", label: "This Month" },
];

export interface TrendingBook {
  key: string;
  title: string;
  authors?: string[];
  coverUrl?: string;
}

interface OpenLibraryTrendingWork {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
}

interface OpenLibraryTrendingResponse {
  works?: OpenLibraryTrendingWork[];
}

/** Open Library's trending feed — no API key, refreshed daily server-side. */
export async function fetchTrendingBooks(
  period: TrendingPeriod = "weekly",
  limit = 24
): Promise<TrendingBook[]> {
  const data = await fetchJson<OpenLibraryTrendingResponse>(
    `https://openlibrary.org/trending/${period}.json`,
    { headers: { "User-Agent": openLibraryUserAgent() }, next: { revalidate: 3600 } }
  );
  return (data?.works ?? [])
    .filter((w) => w.key && w.title)
    .slice(0, limit)
    .map((w) => ({
      key: w.key!,
      title: w.title!,
      authors: w.author_name,
      coverUrl: w.cover_i
        ? `https://covers.openlibrary.org/b/id/${w.cover_i}-M.jpg`
        : undefined,
    }));
}
