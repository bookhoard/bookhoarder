import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOpenLibraryDescription, lookupOpenLibraryCandidates, lookupSimilarBooks } from "./openlibrary";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function routeFetch(routes: Record<string, unknown>) {
  fetchMock.mockImplementation(async (url: string) => {
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.includes(pattern)) return jsonResponse(body);
    }
    return jsonResponse(null, false);
  });
}

describe("network resilience", () => {
  it("retries up to 3 times after dropped connections and still returns results", async () => {
    let searchCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/search.json?title=")) {
        searchCalls++;
        if (searchCalls < 3) throw new Error("read ECONNRESET");
        return jsonResponse({ docs: [{ key: "/works/OL1W", title: "Dracula", author_name: ["Bram Stoker"] }] });
      }
      if (url.includes("/works/OL1W/editions.json")) {
        return jsonResponse({
          entries: [{ title: "Dracula", languages: [{ key: "/languages/eng" }], works: [{ key: "/works/OL1W" }] }],
        });
      }
      if (url.includes("/works/OL1W.json")) return jsonResponse({});
      return jsonResponse(null, false);
    });

    const candidates = await lookupOpenLibraryCandidates({ title: "Dracula", author: "Bram Stoker" });
    expect(candidates).toHaveLength(1);
    expect(searchCalls).toBe(3);
  });

  it("gives up gracefully (no throw) once every attempt fails", async () => {
    fetchMock.mockRejectedValue(new Error("read ECONNRESET"));
    await expect(lookupOpenLibraryCandidates({ title: "Dracula", author: "Bram Stoker" })).resolves.toEqual([]);
  });
});

describe("lookupOpenLibraryCandidates", () => {
  it("adds an ISBN-matched candidate first when an ISBN is given", async () => {
    routeFetch({
      "/isbn/9780486411095.json": {
        title: "Dracula",
        description: "A vampire novel.",
        covers: [111],
      },
      "/search.json?title=": { docs: [] },
    });

    const [first] = await lookupOpenLibraryCandidates({
      isbn: "9780486411095",
      title: "Dracula",
      author: "Bram Stoker",
    });

    expect(first).toEqual({
      title: "Dracula",
      description: "A vampire novel.",
      coverUrl: "https://covers.openlibrary.org/b/id/111-L.jpg",
    });
  });

  it("finds a work, lists one edition per language, sorted English-first", async () => {
    routeFetch({
      "/search.json?title=": { docs: [{ key: "/works/OL1W", title: "Dracula", author_name: ["Bram Stoker"] }] },
      "/works/OL1W/editions.json": {
        entries: [
          {
            title: "Dracula (French)",
            languages: [{ key: "/languages/fre" }],
            covers: [222],
            works: [{ key: "/works/OL1W" }],
          },
          {
            title: "Dracula",
            languages: [{ key: "/languages/eng" }],
            covers: [333],
            works: [{ key: "/works/OL1W" }],
          },
        ],
      },
      "/works/OL1W.json": { description: "The work description.", covers: [999] },
    });

    const candidates = await lookupOpenLibraryCandidates({ title: "Dracula", author: "Bram Stoker" });

    expect(candidates).toHaveLength(2);
    expect(candidates[0].language).toBe("eng");
    expect(candidates[0].coverUrl).toBe("https://covers.openlibrary.org/b/id/333-L.jpg");
    expect(candidates[1].language).toBe("fre");
  });

  it("falls back to the work's cover when an edition has none", async () => {
    routeFetch({
      "/search.json?title=": { docs: [{ key: "/works/OL1W", title: "Dracula", author_name: ["Bram Stoker"] }] },
      "/works/OL1W/editions.json": {
        entries: [{ title: "Dracula", languages: [{ key: "/languages/eng" }], works: [{ key: "/works/OL1W" }] }],
      },
      "/works/OL1W.json": { covers: [999] },
    });

    const [candidate] = await lookupOpenLibraryCandidates({ title: "Dracula", author: "Bram Stoker" });
    expect(candidate.coverUrl).toBe("https://covers.openlibrary.org/b/id/999-L.jpg");
  });

  it("falls back to a loose full-text search when no work matches", async () => {
    routeFetch({
      "/search.json?title=": { docs: [] },
      "/search.json?q=": {
        docs: [{ key: "/works/OL9W", title: "Some Book", author_name: ["Someone"], cover_i: 5, language: ["eng"] }],
      },
    });

    const candidates = await lookupOpenLibraryCandidates({ title: "Some Book", author: "Someone" });
    expect(candidates).toEqual([
      {
        key: "/works/OL9W",
        title: "Some Book",
        authors: ["Someone"],
        language: "eng",
        coverUrl: "https://covers.openlibrary.org/b/id/5-L.jpg",
      },
    ]);
  });

  it("caps the number of candidates at the given limit", async () => {
    routeFetch({
      "/search.json?title=": { docs: [{ key: "/works/OL1W", title: "Dracula", author_name: ["Bram Stoker"] }] },
      "/works/OL1W/editions.json": {
        entries: Array.from({ length: 5 }, (_, i) => ({
          title: `Dracula ${i}`,
          languages: [{ key: `/languages/l${i}` }],
          works: [{ key: "/works/OL1W" }],
        })),
      },
      "/works/OL1W.json": {},
    });

    const candidates = await lookupOpenLibraryCandidates({ title: "Dracula", author: "Bram Stoker" }, 2);
    expect(candidates).toHaveLength(2);
  });
});

describe("lookupSimilarBooks", () => {
  it("browses the work's subjects and pools other works, skipping the book itself", async () => {
    routeFetch({
      "/search.json?title=": {
        docs: [
          {
            key: "/works/OL1W",
            title: "The Song of Achilles",
            author_name: ["Madeline Miller"],
            subject: ["Fiction", "Gay love", "Trojan War. fast (OCoLC)fst01157294", "nyt:trade-fiction-paperback=2020-08-30"],
          },
        ],
      },
      "/subjects/gay_love.json": {
        works: [
          { key: "/works/OL1W", title: "The Song of Achilles" },
          { key: "/works/OL2W", title: "Circe", cover_id: 42, authors: [{ name: "Madeline Miller" }] },
        ],
      },
    });

    const results = await lookupSimilarBooks({ title: "The Song of Achilles", author: "Madeline Miller" });

    expect(results).toEqual([
      {
        key: "/works/OL2W",
        title: "Circe",
        authors: ["Madeline Miller"],
        coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg",
      },
    ]);
  });

  it("returns an empty list when no work matches", async () => {
    routeFetch({ "/search.json?title=": { docs: [] } });
    expect(await lookupSimilarBooks({ title: "Unknown", author: "Nobody" })).toEqual([]);
  });

  it("caps results at the given limit across multiple subjects", async () => {
    routeFetch({
      "/search.json?title=": {
        docs: [{ key: "/works/OL1W", title: "Book", author_name: ["Author"], subject: ["Adventure", "Pirates"] }],
      },
      "/subjects/adventure.json": {
        works: Array.from({ length: 5 }, (_, i) => ({ key: `/works/OLA${i}W`, title: `Adventure ${i}` })),
      },
      "/subjects/pirates.json": {
        works: Array.from({ length: 5 }, (_, i) => ({ key: `/works/OLP${i}W`, title: `Pirates ${i}` })),
      },
    });

    const results = await lookupSimilarBooks({ title: "Book", author: "Author" }, 3);
    expect(results).toHaveLength(3);
  });
});

describe("fetchOpenLibraryDescription", () => {
  it("extracts a plain string description", async () => {
    routeFetch({ "/works/OL1W.json": { description: "Plain text." } });
    expect(await fetchOpenLibraryDescription("/works/OL1W")).toBe("Plain text.");
  });

  it("extracts the value from an { value } description object", async () => {
    routeFetch({ "/works/OL1W.json": { description: { value: "Rich text." } } });
    expect(await fetchOpenLibraryDescription("/works/OL1W")).toBe("Rich text.");
  });

  it("returns undefined when the lookup fails", async () => {
    routeFetch({});
    expect(await fetchOpenLibraryDescription("/works/OL1W")).toBeUndefined();
  });
});
