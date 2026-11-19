import { NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { APP_VERSION } from "@/lib/app-version";
import { createMcpServer } from "@/lib/mcp/server";
import { getMcpProfile } from "@/lib/mcp/profile";
import { isAllowedOrigin } from "@/lib/mcp/origin";

/**
 * MCP endpoint (Streamable HTTP, stateless). Like the rest of the API it has
 * no login of its own — keep the app on a private network (e.g. Tailscale) or
 * behind a reverse proxy that does the authenticating.
 */
export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
  }

  const profile = await getMcpProfile();
  const server = createMcpServer(profile, APP_VERSION);
  // No session id and plain JSON replies: every request stands alone, which is
  // what lets this run on serverless (Cloudflare Workers) as well as Node.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Stateless: there is no server-to-client stream to open and no session to close.
function methodNotAllowed() {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
