import { describe, expect, it } from "vitest";
import { readNdjsonStream } from "./ndjson-client";

function responseFromChunks(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream);
}

describe("readNdjsonStream", () => {
  it("parses one JSON object per line", async () => {
    const response = responseFromChunks(['{"a":1}\n{"a":2}\n']);
    const received: unknown[] = [];
    await readNdjsonStream(response, (chunk) => received.push(chunk));
    expect(received).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reassembles a JSON object split across multiple stream reads", async () => {
    const response = responseFromChunks(['{"a":', "1}\n"]);
    const received: unknown[] = [];
    await readNdjsonStream(response, (chunk) => received.push(chunk));
    expect(received).toEqual([{ a: 1 }]);
  });

  it("parses a final line with no trailing newline", async () => {
    const response = responseFromChunks(['{"a":1}']);
    const received: unknown[] = [];
    await readNdjsonStream(response, (chunk) => received.push(chunk));
    expect(received).toEqual([{ a: 1 }]);
  });

  it("does nothing for a response with no body", async () => {
    const received: unknown[] = [];
    await readNdjsonStream({ body: null } as Response, (chunk) => received.push(chunk));
    expect(received).toEqual([]);
  });

  it("skips blank lines", async () => {
    const response = responseFromChunks(['{"a":1}\n\n{"a":2}\n']);
    const received: unknown[] = [];
    await readNdjsonStream(response, (chunk) => received.push(chunk));
    expect(received).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
