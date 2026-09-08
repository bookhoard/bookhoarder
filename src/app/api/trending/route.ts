import type { TrendingPeriod } from "@/lib/trending";
import { streamTrendingBooks } from "@/lib/metadata/providers/registry";
import { ndjsonResponse } from "@/lib/metadata/ndjson";
import { getSettings } from "@/lib/settings/store";

const VALID_PERIODS = new Set<TrendingPeriod>(["daily", "weekly", "monthly"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("period") ?? "weekly";
  const period = (VALID_PERIODS.has(requested as TrendingPeriod) ? requested : "weekly") as TrendingPeriod;

  const settings = await getSettings();
  const stream = streamTrendingBooks(period, settings.metadataProviders, 24);
  return ndjsonResponse(stream);
}
