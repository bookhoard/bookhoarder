import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body, text: async () => "" } as Response;
}

async function collect<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of generator) items.push(item);
  return items;
}

const { streamMetadataProviders, streamSimilarBooks, streamTrendingBooks } = await import("./registry");

describe("streamMetadataProviders", () => {
  it("queries only the enabled providers and yields one chunk per provider", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("googleapis.com")) {
        return jsonResponse({ items: [{ id: "g1", volumeInfo: { title: "From Google" } }] });
      }
      return jsonResponse(null, false);
    });

    const chunks = await collect(
      streamMetadataProviders({ title: "Dracula", author: "Bram Stoker" }, ["google"], 5)
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].providerId).toBe("google");
    expect(chunks[0].results).toEqual([
      expect.objectContaining({ title: "From Google", source: "google" }),
    ]);
    // Open Library / DNB / IBDb URLs should never have been hit.
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain("openlibrary.org");
    }
  });

  it("a failing provider yields an empty chunk instead of blocking the others", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("googleapis.com")) throw new Error("network down");
      if (url.includes("ibdb.dev")) {
        return jsonResponse({ books: [{ id: "b1", title: "From IBDb" }] });
      }
      return jsonResponse(null, false);
    });

    const chunks = await collect(
      streamMetadataProviders({ title: "Dracula", author: "Bram Stoker" }, ["google", "ibdb"], 5)
    );

    const byProvider = Object.fromEntries(chunks.map((c) => [c.providerId, c.results]));
    expect(byProvider.google).toEqual([]);
    expect(byProvider.ibdb).toEqual([expect.objectContaining({ title: "From IBDb", source: "ibdb" })]);
  });

  it("defaults to every provider when the enabled list is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false));
    const chunks = await collect(
      streamMetadataProviders({ title: "Dracula", author: "Bram Stoker" }, [], 5)
    );
    expect(chunks.map((c) => c.providerId).sort()).toEqual(["dnb", "google", "ibdb", "openlibrary"]);
  });

  it("yields the faster provider's chunk before the slower one", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("googleapis.com")) {
        return jsonResponse({ items: [{ id: "g1", volumeInfo: { title: "Fast" } }] });
      }
      if (url.includes("ibdb.dev")) {
        // Slow to resolve — google's fetch mock above resolves synchronously
        // via a resolved promise, so it settles first in the microtask queue.
        await new Promise((r) => setTimeout(r, 5));
        return jsonResponse({ books: [{ id: "b1", title: "Slow" }] });
      }
      return jsonResponse(null, false);
    });

    const chunks = await collect(
      streamMetadataProviders({ title: "Dracula", author: "Bram Stoker" }, ["ibdb", "google"], 5)
    );

    expect(chunks.map((c) => c.providerId)).toEqual(["google", "ibdb"]);
  });
});

describe("streamSimilarBooks", () => {
  it("only queries providers that support a similar-books lookup, ignoring dnb/ibdb even when enabled", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("openlibrary.org/search.json")) {
        return jsonResponse({ docs: [{ key: "/works/OL1W", title: "Dracula", subject: ["Horror"] }] });
      }
      if (url.includes("openlibrary.org/subjects/horror.json")) {
        return jsonResponse({ works: [{ key: "/works/OL2W", title: "Frankenstein" }] });
      }
      if (url.includes("googleapis.com") && url.includes("intitle")) {
        return jsonResponse({
          items: [{ id: "g1", volumeInfo: { title: "Dracula", categories: ["Fiction / Horror"] } }],
        });
      }
      if (url.includes("googleapis.com") && url.includes("subject")) {
        return jsonResponse({
          items: [{ id: "g2", volumeInfo: { title: "The Shining", authors: ["Stephen King"] } }],
        });
      }
      return jsonResponse(null, false);
    });

    const chunks = await collect(
      streamSimilarBooks(
        { title: "Dracula", author: "Bram Stoker" },
        ["openlibrary", "google", "dnb", "ibdb"],
        10
      )
    );

    expect(chunks.map((c) => c.providerId).sort()).toEqual(["google", "openlibrary"]);
    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      expect(url).not.toContain("ibdb.dev");
      expect(url).not.toContain("services.dnb.de");
    }
  });

  it("defaults to the similar-capable providers when the enabled list is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false));
    const chunks = await collect(
      streamSimilarBooks({ title: "Dracula", author: "Bram Stoker" }, [], 5)
    );
    expect(chunks.map((c) => c.providerId).sort()).toEqual(["google", "openlibrary"]);
  });
});

describe("streamTrendingBooks", () => {
  it("only queries providers with a trending feed, ignoring google/dnb/ibdb even when enabled", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("openlibrary.org/trending/weekly.json")) {
        return jsonResponse({ works: [{ key: "/works/OL1W", title: "Atomic Habits" }] });
      }
      return jsonResponse(null, false);
    });

    const chunks = await collect(
      streamTrendingBooks("weekly", ["openlibrary", "google", "dnb", "ibdb"], 24)
    );

    expect(chunks.map((c) => c.providerId)).toEqual(["openlibrary"]);
    expect(chunks[0].results).toEqual([
      expect.objectContaining({ title: "Atomic Habits", source: "openlibrary" }),
    ]);
    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      expect(url).not.toContain("googleapis.com");
      expect(url).not.toContain("ibdb.dev");
      expect(url).not.toContain("services.dnb.de");
    }
  });

  it("defaults to the trending-capable providers when the enabled list is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false));
    const chunks = await collect(streamTrendingBooks("weekly", [], 24));
    expect(chunks.map((c) => c.providerId)).toEqual(["openlibrary"]);
  });

  it("yields nothing when the only capable provider isn't enabled", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false));
    const chunks = await collect(streamTrendingBooks("weekly", ["google", "ibdb"], 24));
    expect(chunks).toEqual([]);
  });
});
