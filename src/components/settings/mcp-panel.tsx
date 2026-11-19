"use client";

import * as React from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DEMO_MODE } from "@/lib/demo-mode";
import { MCP_TOOLS, type McpToolGroup } from "@/lib/mcp/catalog";

const GROUPS: McpToolGroup[] = ["Books", "Shelves", "Discover"];

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.add({ title: "Couldn't copy — select the text instead", type: "error" });
    }
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <Button variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** Body of Settings → MCP: the endpoint, how to connect a client, and what it can do. */
export function McpPanel() {
  // window isn't there during SSR; the URL fills in once mounted.
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin || "http://localhost:3000"}/api/mcp`;

  if (DEMO_MODE) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        The MCP endpoint is disabled on this read-only demo. Self-host Bookhoarder to connect Claude to your own library.
      </p>
    );
  }

  const claudeCode = `claude mcp add --transport http bookhoarder ${url}`;
  const claudeDesktop = JSON.stringify(
    { mcpServers: { bookhoarder: { command: "npx", args: ["-y", "mcp-remote", url, ...(url.startsWith("http:") ? ["--allow-http"] : [])] } } },
    null,
    2
  );

  return (
    <div className="flex flex-col gap-5 py-4">
      <p className="text-sm text-muted-foreground">
        Connect Claude (or any MCP client) and ask it to find, tidy up, and organize your books. Everything runs on
        your server.
      </p>

      <CopyBlock label="Endpoint" text={url} />
      <CopyBlock label="Claude Code" text={claudeCode} />
      <CopyBlock label="Claude Desktop (claude_desktop_config.json)" text={claudeDesktop} />

      <div className="rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground">
        <p>
          There is no login on this endpoint, same as the rest of the app — it is meant for a private network such as
          Tailscale, or a reverse proxy that does the authenticating. The client must be able to reach this address, so
          Claude on the web and the mobile app can&apos;t use it.
        </p>
        <p className="mt-2">
          Tools act as your first admin profile. Set <code className="text-foreground">MCP_PROFILE_ID</code> to use a
          different one — ratings, read status, shelves, and the e-reader address belong to that profile.
        </p>
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
          What it can do ({MCP_TOOLS.length} tools)
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 pt-3">
            {GROUPS.map((group) => (
              <div key={group}>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</h3>
                <ul className="divide-y divide-border/60">
                  {MCP_TOOLS.filter((t) => t.group === group).map((tool) => (
                    <li key={tool.name} className="py-2">
                      <code className="text-xs font-medium">{tool.name}</code>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tool.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </details>
    </div>
  );
}
