import { describe, expect, it } from "vitest";
import { ndjsonResponse } from "./ndjson";

async function* gen<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function collectLines(response: Response): Promise<string[]> {
  const text = await response.text();
  return text.split("\n").filter((l) => l.length > 0);
}

describe("ndjsonResponse", () => {
  it("emits one JSON line per yielded chunk", async () => {
    const response = ndjsonResponse(gen([{ a: 1 }, { a: 2 }]));
    const lines = await collectLines(response);
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("sets the ndjson content type", () => {
    const response = ndjsonResponse(gen([]));
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
  });

  it("produces an empty body for a generator that yields nothing", async () => {
    const response = ndjsonResponse(gen([]));
    const lines = await collectLines(response);
    expect(lines).toEqual([]);
  });

  it("propagates a generator error by erroring the stream", async () => {
    async function* failing(): AsyncGenerator<never> {
      throw new Error("boom");
    }
    const response = ndjsonResponse(failing());
    await expect(response.text()).rejects.toThrow();
  });
});
