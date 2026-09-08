import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchGoogleBooks, searchGoogleBooksSimilar } from "./google-books";

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

describe("searchGoogleBooks", () => {
  it("maps volumes into candidates, upgrading http covers to https", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "abc123",
            volumeInfo: {
              title: "Dracula",
              authors: ["Bram Stoker"],
              description: "A vampire novel.",
              language: "en",
              imageLinks: { thumbnail: "http://books.google.com/cover.jpg&edge=curl" },
            },
          },
        ],
      })
    );

    const [candidate] = await searchGoogleBooks({ title: "Dracula", author: "Bram Stoker" });
    expect(candidate).toEqual({
      key: "abc123",
      title: "Dracula",
      authors: ["Bram Stoker"],
      language: "en",
      description: "A vampire novel.",
      coverUrl: "https://books.google.com/cover.jpg",
      source: "google",
      sourceLabel: "Google Books",
    });
  });

  it("skips volumes with no title", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [{ id: "x", volumeInfo: {} }] }));
    expect(await searchGoogleBooks({ title: "Dracula", author: "Bram Stoker" })).toEqual([]);
  });

  it("caps results at the given limit", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: Array.from({ length: 5 }, (_, i) => ({
          id: `id${i}`,
          volumeInfo: { title: `Book ${i}` },
        })),
      })
    );
    expect(await searchGoogleBooks({ title: "Book", author: "Author" }, 2)).toHaveLength(2);
  });

  it("returns an empty list when the request fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false));
    expect(await searchGoogleBooks({ title: "Dracula", author: "Bram Stoker" })).toEqual([]);
  });
});

describe("searchGoogleBooksSimilar", () => {
  it("browses the seed book's categories and pools other volumes, excluding itself", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("intitle%3ADracula")) {
        return jsonResponse({
          items: [{ id: "seed1", volumeInfo: { title: "Dracula", categories: ["Fiction / Horror"] } }],
        });
      }
      if (url.includes("subject%3A%22Fiction")) {
        return jsonResponse({
          items: [
            { id: "seed1", volumeInfo: { title: "Dracula" } },
            { id: "other1", volumeInfo: { title: "Frankenstein", authors: ["Mary Shelley"] } },
          ],
        });
      }
      return jsonResponse(null, false);
    });

    const results = await searchGoogleBooksSimilar({ title: "Dracula", author: "Bram Stoker" });
    expect(results).toEqual([
      { key: "other1", title: "Frankenstein", authors: ["Mary Shelley"], coverUrl: undefined, source: "google", sourceLabel: "Google Books" },
    ]);
  });

  it("returns an empty list when the seed book has no categories", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [{ id: "seed1", volumeInfo: { title: "Dracula" } }] }));
    expect(await searchGoogleBooksSimilar({ title: "Dracula", author: "Bram Stoker" })).toEqual([]);
  });

  it("returns an empty list when no seed book is found", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    expect(await searchGoogleBooksSimilar({ title: "Nonexistent", author: "Nobody" })).toEqual([]);
  });
});
