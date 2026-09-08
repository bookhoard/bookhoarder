/**
 * Metadata providers' upstream APIs occasionally drop the connection
 * mid-request (ECONNRESET, timeouts) — a few retries clear most of those
 * instead of failing the whole lookup. Shared by every provider so retry
 * behavior stays consistent instead of each one reimplementing it.
 */
export const METADATA_FETCH_ATTEMPTS = 3;

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  attempts = METADATA_FETCH_ATTEMPTS
): Promise<Response | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, init);
    } catch {
      if (attempt === attempts) return null;
    }
  }
  return null;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  attempts = METADATA_FETCH_ATTEMPTS
): Promise<T | null> {
  const res = await fetchWithRetry(url, init, attempts);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
