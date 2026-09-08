export type MetadataProviderId = "openlibrary" | "google" | "dnb" | "ibdb";

export interface MetadataProviderInfo {
  id: MetadataProviderId;
  label: string;
}

/** Order here is display order everywhere providers are listed (settings, candidate pooling). */
export const METADATA_PROVIDER_INFO: MetadataProviderInfo[] = [
  { id: "openlibrary", label: "Open Library" },
  { id: "google", label: "Google Books" },
  { id: "dnb", label: "Deutsche Nationalbibliothek" },
  { id: "ibdb", label: "IBDb" },
];

export const ALL_METADATA_PROVIDER_IDS: MetadataProviderId[] = METADATA_PROVIDER_INFO.map((p) => p.id);

export interface MetadataProviderQuery {
  isbn?: string;
  title: string;
  author: string;
}

export interface MetadataCandidate {
  /** Provider-specific identifier (e.g. Open Library's work key) — used to lazily fetch extra data. */
  key?: string;
  title?: string;
  authors?: string[];
  language?: string;
  description?: string;
  coverUrl?: string;
  source: MetadataProviderId;
  sourceLabel: string;
}

/** Which providers can find "similar" books (i.e. have subject/category data to browse) — a subset of METADATA_PROVIDER_INFO. */
export const SIMILAR_BOOKS_PROVIDER_IDS: MetadataProviderId[] = ["openlibrary", "google"];

/** Which providers have a trending/popular feed — a subset of METADATA_PROVIDER_INFO. */
export const TRENDING_PROVIDER_IDS: MetadataProviderId[] = ["openlibrary"];

/** A book discovered from an external provider (not yet in the library) — used by both Find Similar and Trending. */
export interface DiscoveredBook {
  key: string;
  title: string;
  authors?: string[];
  coverUrl?: string;
  source: MetadataProviderId;
  sourceLabel: string;
}

/** One provider's results, streamed to the client as soon as that provider answers. */
export interface ProviderResultChunk<T> {
  providerId: MetadataProviderId;
  providerLabel: string;
  results: T[];
}
