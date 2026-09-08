/**
 * Streams an async generator to the client as newline-delimited JSON — one
 * provider's results per line, sent the moment that provider answers rather
 * than waiting for every provider to finish. See ndjson-client.ts for the
 * matching reader.
 */
export function ndjsonResponse<T>(generator: AsyncGenerator<T>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
