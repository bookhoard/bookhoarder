import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Book } from "@/lib/books/types";
import {
  ServiceError,
  addBookFromUrl,
  collectProviderResults,
  deleteBook,
  downloadCover,
  getBookForProfile,
  getBookRecord,
  listBooksForProfile,
  normalizeTags,
  sendBookToEreader,
  setBookState,
  updateBookMetadata,
  type BookMetadataPatch,
} from "@/lib/books/service";
import { streamMetadataProviders, streamSimilarBooks, streamTrendingBooks } from "@/lib/metadata/providers/registry";
import type { Profile } from "@/lib/profiles/types";
import { getSettings } from "@/lib/settings/store";
import {
  addBookToShelf,
  createShelf,
  deleteShelf,
  listShelves,
  removeBookFromShelf,
  updateShelf,
} from "@/lib/shelves/store";
import type { TrendingPeriod } from "@/lib/trending";
import { MCP_TOOLS, mcpToolInfo } from "./catalog";

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

function summarize(b: Book) {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    tags: b.tags ?? [],
    series: b.series,
    rating: b.rating,
    read: b.read,
    progress: b.progress,
  };
}

function full(b: Book) {
  return {
    ...summarize(b),
    description: b.description,
    isbn: b.isbn,
    language: b.lang,
    sizeBytes: b.size,
    addedAt: b.addedAt,
    lastReadAt: b.lastReadAt,
  };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** Runs a handler and turns any failure into a tool error the model can read
 * and react to, instead of a protocol-level error. */
async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Something went wrong");
  }
}

async function requireShelf(profileId: string, id: string) {
  const shelf = (await listShelves(profileId)).find((s) => s.id === id);
  if (!shelf) throw new ServiceError(404, "Shelf not found");
  return shelf;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** Registers every tool in the catalog on `server`, acting as `profile`. */
export function registerTools(server: McpServer, profile: Profile): void {
  const handlers = {
    search_books: {
      input: {
        query: z.string().optional().describe("Matches title, author, tags, and series name"),
        author: z.string().optional(),
        tag: z.string().optional(),
        series: z.string().optional(),
        read: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional().describe("Default 25"),
      },
      run: async (a: {
        query?: string;
        author?: string;
        tag?: string;
        series?: string;
        read?: boolean;
        limit?: number;
      }) => {
        const q = a.query?.trim().toLowerCase();
        const author = a.author?.trim().toLowerCase();
        const tag = a.tag?.trim().toLowerCase();
        const series = a.series?.trim().toLowerCase();
        const matches = (await listBooksForProfile(profile.id)).filter(
          (b) =>
            (!q ||
              b.title.toLowerCase().includes(q) ||
              b.author.toLowerCase().includes(q) ||
              (b.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
              (b.series?.name.toLowerCase().includes(q) ?? false)) &&
            (!author || b.author.toLowerCase().includes(author)) &&
            (!tag || (b.tags ?? []).some((t) => t.toLowerCase() === tag)) &&
            (!series || b.series?.name.toLowerCase() === series) &&
            (a.read === undefined || !!b.read === a.read)
        );
        return { total: matches.length, results: matches.slice(0, a.limit ?? 25).map(summarize) };
      },
    },

    get_book: {
      input: { id: z.string().describe("Book id from search_books") },
      run: async (a: { id: string }) => full(await getBookForProfile(profile.id, a.id)),
    },

    add_book_from_url: {
      input: { url: z.string().url().describe("Direct link to an .epub file") },
      run: async (a: { url: string }) => {
        const { book, duplicate } = await addBookFromUrl(a.url);
        return { duplicate, book: full(await getBookForProfile(profile.id, book.id)) };
      },
    },

    update_book_metadata: {
      input: {
        id: z.string(),
        title: z.string().optional(),
        author: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional().describe("Replaces the whole tag list"),
        series: z
          .object({ name: z.string(), position: z.number().min(0).optional() })
          .nullable()
          .optional()
          .describe("null takes the book out of its series"),
        coverUrl: z.string().url().optional().describe("Image to download and use as the cover"),
      },
      run: async (a: {
        id: string;
        title?: string;
        author?: string;
        description?: string;
        tags?: string[];
        series?: { name: string; position?: number } | null;
        coverUrl?: string;
      }) => {
        await getBookRecord(a.id);
        const patch: BookMetadataPatch = {
          title: a.title?.trim(),
          author: a.author?.trim(),
          description: a.description,
          tags: a.tags === undefined ? undefined : normalizeTags(a.tags),
          series:
            a.series === undefined
              ? undefined
              : a.series === null || !a.series.name.trim()
                ? null
                : { name: a.series.name.trim(), position: a.series.position ?? 0 },
          cover: a.coverUrl ? await downloadCover(a.coverUrl) : undefined,
        };
        await updateBookMetadata(a.id, patch);
        return full(await getBookForProfile(profile.id, a.id));
      },
    },

    delete_book: {
      input: { id: z.string() },
      run: async (a: { id: string }) => {
        if (profile.role !== "admin") {
          throw new ServiceError(403, "Only an admin can delete books — the MCP profile is not an admin");
        }
        await deleteBook(a.id);
        return { ok: true };
      },
    },

    set_book_state: {
      input: {
        id: z.string(),
        rating: z.number().int().min(0).max(5).optional().describe("1-5, or 0 to clear"),
        read: z.boolean().optional(),
        progress: z.number().min(0).max(100).optional().describe("Percent read"),
      },
      run: async (a: { id: string; rating?: number; read?: boolean; progress?: number }) =>
        summarize(await setBookState(profile.id, a.id, a)),
    },

    send_book_to_ereader: {
      input: { id: z.string() },
      run: async (a: { id: string }) => ({ ok: true, ...(await sendBookToEreader(profile, a.id)) }),
    },

    find_metadata_candidates: {
      input: { id: z.string().describe("Library book to look up") },
      run: async (a: { id: string }) => {
        const [book, settings] = await Promise.all([getBookRecord(a.id), getSettings()]);
        const stream = streamMetadataProviders(
          { isbn: book.isbn, title: book.title, author: book.author },
          settings.metadataProviders,
          settings.metadataCandidateLimit
        );
        return { candidates: await collectProviderResults(stream) };
      },
    },

    find_similar_books: {
      input: { id: z.string().describe("Library book to find similar ones for") },
      run: async (a: { id: string }) => {
        const [book, settings] = await Promise.all([getBookRecord(a.id), getSettings()]);
        const stream = streamSimilarBooks(
          { title: book.title, author: book.author },
          settings.metadataProviders,
          12
        );
        return { results: await collectProviderResults(stream) };
      },
    },

    get_trending_books: {
      input: { period: z.enum(["daily", "weekly", "monthly"]).optional().describe("Default weekly") },
      run: async (a: { period?: TrendingPeriod }) => {
        const settings = await getSettings();
        const stream = streamTrendingBooks(a.period ?? "weekly", settings.metadataProviders, 24);
        return { results: await collectProviderResults(stream) };
      },
    },

    list_shelves: {
      input: {},
      run: async () => ({
        shelves: (await listShelves(profile.id)).map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          bookIds: s.bookIds,
        })),
      }),
    },

    create_shelf: {
      input: { name: z.string().min(1), color: z.string().optional().describe("A Tailwind class such as bg-blue-500") },
      run: async (a: { name: string; color?: string }) => createShelf(profile.id, a.name, a.color),
    },

    update_shelf: {
      input: { id: z.string(), name: z.string().optional(), color: z.string().optional() },
      run: async (a: { id: string; name?: string; color?: string }) => {
        const patch: { name?: string; color?: string } = {};
        if (a.name?.trim()) patch.name = a.name.trim();
        if (a.color) patch.color = a.color;
        const shelf = await updateShelf(profile.id, a.id, patch);
        if (!shelf) throw new ServiceError(404, "Shelf not found");
        return shelf;
      },
    },

    delete_shelf: {
      input: { id: z.string() },
      run: async (a: { id: string }) => {
        await requireShelf(profile.id, a.id);
        await deleteShelf(profile.id, a.id);
        return { ok: true };
      },
    },

    add_book_to_shelf: {
      input: { shelfId: z.string(), bookId: z.string() },
      run: async (a: { shelfId: string; bookId: string }) => {
        await requireShelf(profile.id, a.shelfId);
        await getBookRecord(a.bookId);
        const shelves = await addBookToShelf(profile.id, a.shelfId, a.bookId);
        return shelves.find((s) => s.id === a.shelfId);
      },
    },

    remove_book_from_shelf: {
      input: { shelfId: z.string(), bookId: z.string() },
      run: async (a: { shelfId: string; bookId: string }) => {
        await requireShelf(profile.id, a.shelfId);
        const shelves = await removeBookFromShelf(profile.id, a.shelfId, a.bookId);
        return shelves.find((s) => s.id === a.shelfId);
      },
    },
  };

  for (const info of MCP_TOOLS) {
    const handler = handlers[info.name as keyof typeof handlers];
    if (!handler) throw new Error(`MCP tool "${info.name}" is in the catalog but has no handler`);
    // The handler map is typed per tool; registration only needs the common shape.
    const { input, run: runTool } = handler as unknown as {
      input: z.ZodRawShape;
      run: (args: never) => Promise<unknown>;
    };
    const { description, readOnly, name } = mcpToolInfo(info.name);
    server.registerTool(
      name,
      {
        description,
        inputSchema: input,
        // Metadata, trending, and similar look things up on external sites.
        annotations: { readOnlyHint: readOnly, openWorldHint: EXTERNAL_TOOLS.has(name) },
      },
      async (args: unknown) => run(() => runTool(args as never))
    );
  }
}

const EXTERNAL_TOOLS = new Set([
  "add_book_from_url",
  "update_book_metadata",
  "find_metadata_candidates",
  "find_similar_books",
  "get_trending_books",
  "send_book_to_ereader",
]);
