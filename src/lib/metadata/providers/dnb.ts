import { XMLParser } from "fast-xml-parser";
import { openLibraryUserAgent } from "../user-agent";
import { fetchWithRetry } from "../http";
import type { MetadataCandidate, MetadataProviderQuery } from "../types";

// https://services.dnb.de/sru/dnb — the German National Library's public
// SRU catalog search, returning MARC21 XML records. No API key required.
const QUERY_URL = "https://services.dnb.de/sru/dnb";
const COVER_URL = "https://portal.dnb.de/opac/mvb/cover?isbn=";
const SOURCE_LABEL = "Deutsche Nationalbibliothek";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true });

interface MarcSubfield {
  "@_code"?: string;
  "#text"?: string | number;
}

interface MarcDatafield {
  "@_tag"?: string;
  subfield?: MarcSubfield | MarcSubfield[];
}

interface MarcRecord {
  datafield?: MarcDatafield | MarcDatafield[];
}

interface SruRecord {
  recordData?: { record?: MarcRecord };
}

interface SruResponse {
  searchRetrieveResponse?: {
    records?: { record?: SruRecord | SruRecord[] };
  };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function subfieldText(field: MarcDatafield | undefined, code: string): string | undefined {
  const match = toArray(field?.subfield).find((s) => s?.["@_code"] === code);
  const text = match?.["#text"];
  return text === undefined || text === null ? undefined : String(text);
}

function datafield(record: MarcRecord, tag: string): MarcDatafield | undefined {
  return toArray(record.datafield).find((d) => d?.["@_tag"] === tag);
}

export async function searchDnb(
  query: MetadataProviderQuery,
  limit = 10
): Promise<MetadataCandidate[]> {
  const title = query.title.replace(/"/g, "");
  // Exclude non-book media (film, music, microfiches, journals) from the catalog search.
  const sruQuery = `tit="${title}" NOT (mat=film OR mat=music OR mat=microfiches OR cod=tt)`;
  const url = `${QUERY_URL}?version=1.1&maximumRecords=${limit}&operation=searchRetrieve&recordSchema=MARC21-xml&query=${encodeURIComponent(sruQuery)}`;

  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": openLibraryUserAgent(), Accept: "application/xml, text/xml" },
  });
  if (!res || !res.ok) return [];

  let xml: string;
  try {
    xml = await res.text();
  } catch {
    return [];
  }

  let parsed: SruResponse;
  try {
    parsed = parser.parse(xml) as SruResponse;
  } catch {
    return [];
  }

  const records = toArray(parsed.searchRetrieveResponse?.records?.record)
    .map((r) => r.recordData?.record)
    .filter((r): r is MarcRecord => !!r);

  const candidates: MetadataCandidate[] = [];
  for (const record of records) {
    const titleField = datafield(record, "245");
    const title = subfieldText(titleField, "a");
    if (!title) continue;
    const subtitle = subfieldText(titleField, "b");

    const author = subfieldText(datafield(record, "100"), "a");
    const isbn = subfieldText(datafield(record, "020"), "a");
    const language = subfieldText(datafield(record, "041"), "a");

    candidates.push({
      title: subtitle ? `${title}: ${subtitle}` : title,
      authors: author ? [author] : undefined,
      language,
      coverUrl: isbn ? `${COVER_URL}${isbn}` : undefined,
      source: "dnb",
      sourceLabel: SOURCE_LABEL,
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}
