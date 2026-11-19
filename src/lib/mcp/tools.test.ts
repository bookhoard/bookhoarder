import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMemoryDriver } from "@/lib/storage/test-helpers";
import { buildEpub, CONTAINER_XML, opfXml } from "@/lib/epub/test-helpers";
import type { Profile } from "@/lib/profiles/types";

const driver = createMemoryDriver();
vi.mock("@/lib/storage", () => ({ getStorage: () => driver }));

const { createMcpServer } = await import("./server");
const { MCP_TOOLS } = await import("./catalog");
const { addBookFromEpub } = await import("@/lib/books/service");

const admin: Profile = { id: "default", name: "Admin", color: "bg-blue-500", role: "admin", createdAt: "" };
const reader: Profile = { ...admin, id: "reader", role: "reader" };

function epub(title: string, author: string) {
  return buildEpub({
    "META-INF/container.xml": CONTAINER_XML,
    "OEBPS/content.opf": opfXml({ title, author, language: "en" }),
  });
}

beforeEach(() => driver.files.clear());

async function connect(profile: Profile = admin) {
  const server = createMcpServer(profile, "0.0.0-test");
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text: string }[];
  };
  const text = res.content[0].text;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // an error message, not JSON
  }
  return { isError: !!res.isError, data };
}

async function seed() {
  await addBookFromEpub(epub("Dracula", "Bram Stoker"));
  await addBookFromEpub(epub("Frankenstein", "Mary Shelley"));
}

describe("tool registration", () => {
  it("exposes exactly the tools in the catalog, with matching read-only hints", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(MCP_TOOLS.map((t) => t.name).sort());
    for (const tool of tools) {
      const info = MCP_TOOLS.find((t) => t.name === tool.name)!;
      expect(tool.annotations?.readOnlyHint).toBe(info.readOnly);
      expect(tool.description).toBe(info.description);
    }
  });
});

describe("books", () => {
  it("searches by text and filters", async () => {
    await seed();
    const client = await connect();
    expect((await call(client, "search_books")).data.total).toBe(2);
    const byAuthor = await call(client, "search_books", { query: "shelley" });
    expect(byAuthor.data.results.map((b: { id: string }) => b.id)).toEqual(["frankenstein"]);
    expect((await call(client, "search_books", { author: "stoker" })).data.total).toBe(1);
    expect((await call(client, "search_books", { read: true })).data.total).toBe(0);
  });

  it("gets a book and reports a missing one as a tool error", async () => {
    await seed();
    const client = await connect();
    expect((await call(client, "get_book", { id: "dracula" })).data).toMatchObject({
      title: "Dracula",
      author: "Bram Stoker",
      language: "en",
    });
    expect(await call(client, "get_book", { id: "nope" })).toMatchObject({ isError: true, data: "Book not found" });
  });

  it("updates metadata: partial change, tags, series, and clearing the series", async () => {
    await seed();
    const client = await connect();
    const updated = await call(client, "update_book_metadata", {
      id: "dracula",
      description: "Vampire",
      tags: ["Gothic", "gothic", "Horror"],
      series: { name: "Monsters", position: 1 },
    });
    expect(updated.data).toMatchObject({
      title: "Dracula",
      description: "Vampire",
      tags: ["Gothic", "Horror"],
      series: { name: "Monsters", position: 1 },
    });
    const cleared = await call(client, "update_book_metadata", { id: "dracula", series: null });
    expect(cleared.data.series).toBeUndefined();
    expect((await call(client, "search_books", { tag: "horror" })).data.total).toBe(1);
  });

  it("sets state per profile and filters on it", async () => {
    await seed();
    const client = await connect();
    expect((await call(client, "set_book_state", { id: "dracula", rating: 5, read: true })).data).toMatchObject({
      rating: 5,
      read: true,
    });
    const read = await call(client, "search_books", { read: true });
    expect(read.data.results.map((b: { id: string }) => b.id)).toEqual(["dracula"]);
    const other = await connect(reader);
    expect((await call(other, "search_books", { read: true })).data.total).toBe(0);
  });

  it("only lets an admin delete", async () => {
    await seed();
    const readerClient = await connect(reader);
    const res = await call(readerClient, "delete_book", { id: "dracula" });
    expect(res.isError).toBe(true);
    expect(res.data).toMatch(/admin/);
    const adminClient = await connect(admin);
    expect((await call(adminClient, "delete_book", { id: "dracula" })).data).toEqual({ ok: true });
    expect((await call(adminClient, "search_books")).data.total).toBe(1);
  });

  it("adds a book from a url", async () => {
    const data = epub("Carmilla", "Le Fanu");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(data), { status: 200 })));
    const client = await connect();
    const added = await call(client, "add_book_from_url", { url: "https://example.com/carmilla.epub" });
    expect(added.data).toMatchObject({ duplicate: false, book: { id: "carmilla" } });
    expect((await call(client, "add_book_from_url", { url: "https://example.com/carmilla.epub" })).data.duplicate).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("shelves", () => {
  it("creates a shelf and moves a book on and off it", async () => {
    await seed();
    const client = await connect();
    const shelf = (await call(client, "create_shelf", { name: "Spooky" })).data;

    expect((await call(client, "add_book_to_shelf", { shelfId: shelf.id, bookId: "dracula" })).data.bookIds).toEqual([
      "dracula",
    ]);
    const listed = (await call(client, "list_shelves")).data.shelves.find((s: { id: string }) => s.id === shelf.id);
    expect(listed.bookIds).toEqual(["dracula"]);
    expect((await call(client, "remove_book_from_shelf", { shelfId: shelf.id, bookId: "dracula" })).data.bookIds).toEqual([]);

    expect((await call(client, "update_shelf", { id: shelf.id, name: "Creepy" })).data.name).toBe("Creepy");
    expect((await call(client, "delete_shelf", { id: shelf.id })).data).toEqual({ ok: true });
  });

  it("refuses unknown shelves and books", async () => {
    await seed();
    const client = await connect();
    expect((await call(client, "add_book_to_shelf", { shelfId: "x", bookId: "dracula" })).isError).toBe(true);
    const shelf = (await call(client, "create_shelf", { name: "A" })).data;
    expect(await call(client, "add_book_to_shelf", { shelfId: shelf.id, bookId: "ghost" })).toMatchObject({
      isError: true,
      data: "Book not found",
    });
  });
});

describe("discover", () => {
  it("collects candidates, similar books, and trending from the providers", async () => {
    await seed();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } }))
    );
    const client = await connect();
    expect((await call(client, "find_metadata_candidates", { id: "dracula" })).data).toHaveProperty("candidates");
    expect((await call(client, "find_similar_books", { id: "dracula" })).data).toHaveProperty("results");
    expect((await call(client, "get_trending_books", { period: "daily" })).data).toHaveProperty("results");
    vi.unstubAllGlobals();
  });
});
