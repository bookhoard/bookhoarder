import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDriver } from "@/lib/storage/test-helpers";
import { buildEpub, CONTAINER_XML, opfXml } from "@/lib/epub/test-helpers";

const driver = createMemoryDriver();
vi.mock("@/lib/storage", () => ({ getStorage: () => driver }));

const service = await import("./service");
const { updateSettings } = await import("@/lib/settings/store");
const { readJson } = await import("@/lib/store");

function epub(title: string, author = "Anon") {
  return buildEpub({
    "META-INF/container.xml": CONTAINER_XML,
    "OEBPS/content.opf": opfXml({ title, author, language: "en" }),
    "OEBPS/chapter1.xhtml": "<html><body>Hello</body></html>",
  });
}

beforeEach(() => {
  driver.files.clear();
  vi.unstubAllGlobals();
});

describe("addBookFromEpub", () => {
  it("stores the epub, its unpacked content, and the metadata", async () => {
    const { book, duplicate } = await service.addBookFromEpub(epub("Dracula", "Bram Stoker"));
    expect(duplicate).toBe(false);
    expect(book).toMatchObject({ id: "dracula", title: "Dracula", author: "Bram Stoker", lang: "en" });
    expect(driver.files.has("books/dracula/book.epub")).toBe(true);
    expect(driver.files.has("books/dracula/content/OEBPS/chapter1.xhtml")).toBe(true);
    expect(await readJson("books/dracula/metadata.json")).toMatchObject({ title: "Dracula" });
    expect((await service.listBookRecords()).map((b) => b.id)).toEqual(["dracula"]);
  });

  it("returns the existing book for the same file instead of adding it twice", async () => {
    const first = await service.addBookFromEpub(epub("Dracula"));
    const again = await service.addBookFromEpub(epub("Dracula"));
    expect(again).toMatchObject({ duplicate: true, book: { id: first.book.id } });
    expect(await service.listBookRecords()).toHaveLength(1);
  });

  it("gives two different books with the same title different ids", async () => {
    await service.addBookFromEpub(epub("Dracula", "A"));
    const second = await service.addBookFromEpub(epub("Dracula", "B"));
    expect(second.book.id).toMatch(/^dracula-[0-9a-f]{6}$/);
  });

  it("rejects a file over the upload limit", async () => {
    await updateSettings({ uploadMaxSizeMb: 1 });
    await expect(service.addBookFromEpub(Buffer.alloc(1024 * 1024 + 1))).rejects.toMatchObject({ status: 413 });
  });

  it("rejects something that is not an epub", async () => {
    await expect(service.addBookFromEpub(Buffer.from("nope"))).rejects.toMatchObject({ status: 400 });
    expect(await service.listBookRecords()).toEqual([]);
  });
});

describe("addBookFromUrl", () => {
  it("downloads an epub and adds it", async () => {
    const data = epub("Frankenstein", "Mary Shelley");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(data), { status: 200 })));
    const { book } = await service.addBookFromUrl("https://example.com/f.epub");
    expect(book.title).toBe("Frankenstein");
  });

  it("rejects bad addresses and failed downloads", async () => {
    await expect(service.addBookFromUrl("not a url")).rejects.toMatchObject({ status: 400 });
    await expect(service.addBookFromUrl("ftp://example.com/x.epub")).rejects.toMatchObject({ status: 400 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    await expect(service.addBookFromUrl("https://example.com/x.epub")).rejects.toMatchObject({ status: 502 });
  });

  it("refuses a download that says it is too big, without reading it", async () => {
    await updateSettings({ uploadMaxSizeMb: 1 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x", { status: 200, headers: { "content-length": String(5 * 1024 * 1024) } }))
    );
    await expect(service.addBookFromUrl("https://example.com/big.epub")).rejects.toMatchObject({ status: 413 });
  });
});

describe("updateBookMetadata", () => {
  it("changes only what is sent and keeps the index in sync", async () => {
    const { book } = await service.addBookFromEpub(epub("Dracula", "Bram Stoker"));
    const updated = await service.updateBookMetadata(book.id, { description: "Vampire", tags: ["gothic"] });
    expect(updated).toMatchObject({ title: "Dracula", author: "Bram Stoker", description: "Vampire", tags: ["gothic"] });
    expect((await service.listBookRecords())[0].description).toBe("Vampire");
  });

  it("sets and clears a series", async () => {
    const { book } = await service.addBookFromEpub(epub("Dracula"));
    const withSeries = await service.updateBookMetadata(book.id, { series: { name: "Monsters", position: 1 } });
    expect(withSeries.series).toEqual({ name: "Monsters", position: 1 });
    const cleared = await service.updateBookMetadata(book.id, { series: null });
    expect(cleared.series).toBeUndefined();
  });

  it("stores a new cover", async () => {
    const { book } = await service.addBookFromEpub(epub("Dracula"));
    const updated = await service.updateBookMetadata(book.id, {
      cover: { data: Buffer.from("img"), contentType: "image/jpeg" },
    });
    expect(updated).toMatchObject({ hasCover: true, coverExt: "jpg" });
    expect(driver.files.has("books/dracula/cover.jpg")).toBe(true);
  });

  it("404s for an unknown book", async () => {
    await expect(service.updateBookMetadata("nope", {})).rejects.toMatchObject({ status: 404 });
  });
});

describe("normalizeTags", () => {
  it("trims, drops blanks and duplicates, and ignores non-strings", () => {
    expect(service.normalizeTags([" Gothic ", "gothic", "", 3, "Horror"])).toEqual(["Gothic", "Horror"]);
  });
  it("returns undefined for something that is not a list", () => {
    expect(service.normalizeTags("gothic")).toBeUndefined();
  });
});

describe("setBookState", () => {
  it("sets rating, read, and progress per profile; 0 clears the rating", async () => {
    const { book } = await service.addBookFromEpub(epub("Dracula"));
    const state = await service.setBookState("default", book.id, { rating: 5, read: true, progress: 140 });
    expect(state).toMatchObject({ rating: 5, read: true, progress: 100 });
    expect((await service.setBookState("default", book.id, { rating: 0 })).rating).toBeUndefined();
    expect((await service.getBookForProfile("other", book.id)).read).toBe(false);
  });

  it("rejects a bad rating", async () => {
    const { book } = await service.addBookFromEpub(epub("Dracula"));
    await expect(service.setBookState("default", book.id, { rating: 9 })).rejects.toMatchObject({ status: 400 });
  });
});

describe("deleteBook", () => {
  it("removes files, the index entry, and every profile's state", async () => {
    const { book } = await service.addBookFromEpub(epub("Dracula"));
    await service.setBookState("default", book.id, { read: true });
    await service.deleteBook(book.id);
    expect(await service.listBookRecords()).toEqual([]);
    expect([...driver.files.keys()].filter((k) => k.startsWith("books/"))).toEqual([]);
    expect(await readJson("profiles/default/state.json")).toEqual({});
  });

  it("404s for an unknown book", async () => {
    await expect(service.deleteBook("nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("sendBookToEreader", () => {
  const profile = { id: "default", name: "A", color: "", role: "admin" as const, createdAt: "" };

  it("explains what is missing when SMTP or the e-reader address is not set", async () => {
    const { book } = await service.addBookFromEpub(epub("Dracula"));
    await expect(service.sendBookToEreader(profile, book.id)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("SMTP"),
    });
  });
});
