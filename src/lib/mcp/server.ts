import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Profile } from "@/lib/profiles/types";
import { registerTools } from "./tools";

const INSTRUCTIONS =
  "Bookhoarder is a self-hosted EPUB library. Use these tools to search and read about the books in it, " +
  "fix their metadata, track what has been read, organize books into shelves, and discover new ones. " +
  "Book ids are slugs from search_books; shelf ids are UUIDs from list_shelves.";

/** A fresh server per request — the endpoint is stateless, so there is no
 * session to keep between calls. */
export function createMcpServer(profile: Profile, version: string): McpServer {
  const server = new McpServer({ name: "bookhoarder", version }, { instructions: INSTRUCTIONS });
  registerTools(server, profile);
  return server;
}
