import { lookupOpenLibraryCandidates, lookupSimilarBooks } from "../openlibrary";
import { searchGoogleBooks, searchGoogleBooksSimilar } from "./google-books";
import { searchDnb } from "./dnb";
import { searchIbdb } from "./ibdb";
import { fetchTrendingBooks, type TrendingPeriod } from "../../trending";
import { raceInCompletionOrder } from "../merge";
import {
  ALL_METADATA_PROVIDER_IDS,
  METADATA_PROVIDER_INFO,
  SIMILAR_BOOKS_PROVIDER_IDS,
  TRENDING_PROVIDER_IDS,
  type MetadataCandidate,
  type MetadataProviderId,
  type MetadataProviderQuery,
  type ProviderResultChunk,
  type DiscoveredBook,
} from "../types";

const OPEN_LIBRARY_LABEL = METADATA_PROVIDER_INFO.find((p) => p.id === "openlibrary")!.label;

function providerLabel(id: MetadataProviderId): string {
  return METADATA_PROVIDER_INFO.find((p) => p.id === id)?.label ?? id;
}

type SearchFn = (query: MetadataProviderQuery, limit: number) => Promise<MetadataCandidate[]>;

const SEARCH_FNS: Record<MetadataProviderId, SearchFn> = {
  openlibrary: async (query, limit) => {
    const results = await lookupOpenLibraryCandidates(query, limit);
    return results.map((r) => ({ ...r, source: "openlibrary" as const, sourceLabel: OPEN_LIBRARY_LABEL }));
  },
  google: searchGoogleBooks,
  dnb: searchDnb,
  ibdb: searchIbdb,
};

/**
 * Queries every enabled provider in parallel and yields each one's
 * candidates the moment it answers — a fast provider reaches the caller
 * without waiting on a slow one. A provider that errors just yields an
 * empty chunk; it never blocks the others.
 */
export async function* streamMetadataProviders(
  query: MetadataProviderQuery,
  enabledIds: MetadataProviderId[],
  perProviderLimit: number
): AsyncGenerator<ProviderResultChunk<MetadataCandidate>> {
  const ids = enabledIds.length ? enabledIds : ALL_METADATA_PROVIDER_IDS;
  const tasks = ids.map((id) => ({
    id,
    promise: SEARCH_FNS[id](query, perProviderLimit).catch(() => [] as MetadataCandidate[]),
  }));
  for await (const { id, value } of raceInCompletionOrder(tasks)) {
    yield { providerId: id, providerLabel: providerLabel(id), results: value };
  }
}

type TrendingFn = (period: TrendingPeriod, limit: number) => Promise<DiscoveredBook[]>;

// Only Open Library has a public trending/popular feed among the built-in
// providers today — see TRENDING_PROVIDER_IDS. The shape is ready for more.
const TRENDING_FNS: Partial<Record<MetadataProviderId, TrendingFn>> = {
  openlibrary: async (period, limit) => {
    const results = await fetchTrendingBooks(period, limit);
    return results.map((r) => ({ ...r, source: "openlibrary" as const, sourceLabel: OPEN_LIBRARY_LABEL }));
  },
};

/**
 * Same idea as streamMetadataProviders, restricted to the providers with a
 * trending feed — yields each one's results as soon as it answers.
 */
export async function* streamTrendingBooks(
  period: TrendingPeriod,
  enabledIds: MetadataProviderId[],
  limit: number
): AsyncGenerator<ProviderResultChunk<DiscoveredBook>> {
  const candidateIds = enabledIds.length ? enabledIds : ALL_METADATA_PROVIDER_IDS;
  const ids = candidateIds.filter((id) => TRENDING_PROVIDER_IDS.includes(id));
  const tasks = ids.map((id) => ({
    id,
    promise: TRENDING_FNS[id]!(period, limit).catch(() => [] as DiscoveredBook[]),
  }));
  for await (const { id, value } of raceInCompletionOrder(tasks)) {
    yield { providerId: id, providerLabel: providerLabel(id), results: value };
  }
}

type SimilarFn = (query: MetadataProviderQuery, limit: number) => Promise<DiscoveredBook[]>;

// Only providers with subject/category data can approximate "similar books" —
// see SIMILAR_BOOKS_PROVIDER_IDS.
const SIMILAR_FNS: Partial<Record<MetadataProviderId, SimilarFn>> = {
  openlibrary: async (query, limit) => {
    const results = await lookupSimilarBooks(query, limit);
    return results.map((r) => ({ ...r, source: "openlibrary" as const, sourceLabel: OPEN_LIBRARY_LABEL }));
  },
  google: searchGoogleBooksSimilar,
};

/**
 * Same idea as streamMetadataProviders, restricted to the providers that
 * support a "similar books" lookup — yields each one's results as soon as
 * it answers.
 */
export async function* streamSimilarBooks(
  query: MetadataProviderQuery,
  enabledIds: MetadataProviderId[],
  limit: number
): AsyncGenerator<ProviderResultChunk<DiscoveredBook>> {
  const candidateIds = enabledIds.length ? enabledIds : ALL_METADATA_PROVIDER_IDS;
  const ids = candidateIds.filter((id) => SIMILAR_BOOKS_PROVIDER_IDS.includes(id));
  const tasks = ids.map((id) => ({
    id,
    promise: SIMILAR_FNS[id]!(query, limit).catch(() => [] as DiscoveredBook[]),
  }));
  for await (const { id, value } of raceInCompletionOrder(tasks)) {
    yield { providerId: id, providerLabel: providerLabel(id), results: value };
  }
}
