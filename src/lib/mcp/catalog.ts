/**
 * Every tool the MCP endpoint exposes — name, group, and what it does.
 *
 * Kept free of server-only imports so the Settings → MCP screen can list the
 * same tools the server registers (see tools.ts, which holds the handlers and
 * is checked against this list in a test).
 */

export type McpToolGroup = "Books" | "Shelves" | "Discover";

export interface McpToolInfo {
  name: string;
  group: McpToolGroup;
  description: string;
  /** read-only tools never change anything — clients can safely auto-approve them */
  readOnly: boolean;
}

export const MCP_TOOLS: McpToolInfo[] = [
  {
    name: "search_books",
    group: "Books",
    description:
      "Search the library by text (title, author, tag, series) and/or filter by author, tag, series, or read status. Returns short summaries — use get_book for everything about one book.",
    readOnly: true,
  },
  {
    name: "get_book",
    group: "Books",
    description: "Get one book in full: author, description, ISBN, tags, series, and your rating, read flag, and progress.",
    readOnly: true,
  },
  {
    name: "add_book_from_url",
    group: "Books",
    description:
      "Download an EPUB from a web address and add it to the library. A book that is already in the library is not added twice.",
    readOnly: false,
  },
  {
    name: "update_book_metadata",
    group: "Books",
    description:
      "Change a book's title, author, description, tags, series, or cover. Fields you leave out stay as they are. Tags replace the whole list; series null removes the book from its series; coverUrl downloads a new cover.",
    readOnly: false,
  },
  {
    name: "delete_book",
    group: "Books",
    description: "Delete a book and its files for good. Only works when the MCP profile is an admin.",
    readOnly: false,
  },
  {
    name: "set_book_state",
    group: "Books",
    description: "Set your rating (1-5, or 0 to clear), read flag, or reading progress (0-100) on a book.",
    readOnly: false,
  },
  {
    name: "send_book_to_ereader",
    group: "Books",
    description:
      "Email the book to the e-reader address of the MCP profile. Needs SMTP set up in Settings → E-Reader Email.",
    readOnly: false,
  },
  {
    name: "find_metadata_candidates",
    group: "Discover",
    description:
      "Look up a book on the metadata providers set up in Settings → Metadata and return matching titles, authors, descriptions, and cover URLs. Apply one with update_book_metadata.",
    readOnly: true,
  },
  {
    name: "find_similar_books",
    group: "Discover",
    description: "Find books similar to one in the library, from the enabled metadata providers.",
    readOnly: true,
  },
  {
    name: "get_trending_books",
    group: "Discover",
    description: "What is trending right now (daily, weekly, or monthly), from the enabled metadata providers.",
    readOnly: true,
  },
  {
    name: "list_shelves",
    group: "Shelves",
    description: "List your shelves and the book ids on each.",
    readOnly: true,
  },
  {
    name: "create_shelf",
    group: "Shelves",
    description: "Create a shelf.",
    readOnly: false,
  },
  {
    name: "update_shelf",
    group: "Shelves",
    description: "Rename a shelf or change its color.",
    readOnly: false,
  },
  {
    name: "delete_shelf",
    group: "Shelves",
    description: "Delete a shelf. The books on it stay in the library.",
    readOnly: false,
  },
  {
    name: "add_book_to_shelf",
    group: "Shelves",
    description: "Put a book on a shelf.",
    readOnly: false,
  },
  {
    name: "remove_book_from_shelf",
    group: "Shelves",
    description: "Take a book off a shelf. The book itself is not deleted.",
    readOnly: false,
  },
];

export function mcpToolInfo(name: string): McpToolInfo {
  const info = MCP_TOOLS.find((t) => t.name === name);
  if (!info) throw new Error(`Unknown MCP tool: ${name}`);
  return info;
}
