import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchIbdb } from "./ibdb";

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

describe("searchIbdb", () => {
  it("maps books into candidates", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        books: [
          {
            id: "b1",
            title: "Dracula",
            authors: [{ name: "Bram Stoker" }],
            synopsis: "A vampire novel.",
            language: "en",
            image: { url: "https://ibdb.dev/covers/b1.jpg" },
          },
        ],
      })
    );

    const [candidate] = await searchIbdb({ title: "Dracula", author: "Bram Stoker" });
    expect(candidate).toEqual({
      key: "b1",
      title: "Dracula",
      authors: ["Bram Stoker"],
      language: "en",
      description: "A vampire novel.",
      coverUrl: "https://ibdb.dev/covers/b1.jpg",
      source: "ibdb",
      sourceLabel: "IBDb",
    });
  });

  it("skips books missing an id or title", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ books: [{ title: "No id" }, { id: "no-title" }] }));
    expect(await searchIbdb({ title: "Dracula", author: "Bram Stoker" })).toEqual([]);
  });

  it("returns an empty list on a non-ok response (e.g. 501 not implemented)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false));
    expect(await searchIbdb({ title: "Dracula", author: "Bram Stoker" })).toEqual([]);
  });
});
