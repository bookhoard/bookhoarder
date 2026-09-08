/**
 * Reads a newline-delimited JSON response body, calling `onChunk` for each
 * complete line as it arrives — the client-side half of ndjson.ts's
 * streaming response, letting the UI show a fast provider's results before
 * a slow one has even answered.
 */
export async function readNdjsonStream<T>(
  response: Response,
  onChunk: (chunk: T) => void
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onChunk(JSON.parse(line) as T);
    }
  }
  if (buffer.trim()) onChunk(JSON.parse(buffer) as T);
}
