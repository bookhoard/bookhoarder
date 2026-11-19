import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDriver } from "@/lib/storage/test-helpers";

const driver = createMemoryDriver();
vi.mock("@/lib/storage", () => ({ getStorage: () => driver }));

const route = await import("./route");

beforeEach(() => driver.files.clear());
afterEach(() => vi.unstubAllEnvs());

function rpc(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("/api/mcp", () => {
  it("answers initialize and tools/list over plain JSON, with no auth", async () => {
    const init = await route.POST(
      rpc({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      })
    );
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe("bookhoarder");

    const list = await route.POST(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    expect((await list.json()).result.tools.length).toBeGreaterThan(10);
  });

  it("runs a tool call end to end", async () => {
    const res = await route.POST(
      rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_books", arguments: {} } })
    );
    const body = await res.json();
    expect(JSON.parse(body.result.content[0].text)).toEqual({ total: 0, results: [] });
  });

  it("rejects a request from another origin", async () => {
    const res = await route.POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("is POST-only", async () => {
    expect((await route.GET()).status).toBe(405);
    expect((await route.DELETE()).status).toBe(405);
  });

  it("fails clearly when MCP_PROFILE_ID points at nothing", async () => {
    vi.stubEnv("MCP_PROFILE_ID", "ghost");
    await expect(route.POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }))).rejects.toThrow(/MCP_PROFILE_ID/);
  });
});
