/**
 * Browsers attach an `Origin` header to cross-site requests, and a web page
 * has no business talking to the MCP endpoint. Real MCP clients (Claude Code,
 * mcp-remote, ...) are not browsers and send none, so: no Origin is fine, and
 * an Origin must match the host the request came to.
 */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
