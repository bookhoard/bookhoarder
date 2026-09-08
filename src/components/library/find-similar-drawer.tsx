"use client";

import * as React from "react";
import { Loader2, AlertCircle, SearchX } from "lucide-react";
import {
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { SideDrawer } from "@/components/side-drawer";
import { BookGridLayout } from "./book-grid";
import { BookTile, bookTileClassName } from "./book-tile";
import { readNdjsonStream } from "@/lib/metadata/ndjson-client";
import { discoveredBookUrl } from "@/lib/metadata/source-url";
import type { Book } from "@/lib/books/types";
import type { ProviderResultChunk, DiscoveredBook } from "@/lib/metadata/types";

interface FindSimilarDrawerProps {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = "loading" | "ready" | "error";

export function FindSimilarDrawer({ book, open, onOpenChange }: FindSimilarDrawerProps) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [streaming, setStreaming] = React.useState(false);
  const [books, setBooks] = React.useState<DiscoveredBook[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setStatus("loading");
    setStreaming(true);
    setBooks([]);

    const controller = new AbortController();

    fetch(`/api/books/${book.id}/similar`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to find similar books");
        }
        await readNdjsonStream<ProviderResultChunk<DiscoveredBook>>(res, (chunk) => {
          if (chunk.results.length === 0) return;
          setBooks((prev) => [...prev, ...chunk.results]);
          setStatus("ready");
        });
        // Nothing ever arrived — flip to "ready" anyway so the empty state renders.
        setStatus((prev) => (prev === "loading" ? "ready" : prev));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus("error");
      })
      .finally(() => setStreaming(false));

    return () => controller.abort();
  }, [open, book.id]);

  return (
    <SideDrawer open={open} onOpenChange={onOpenChange}>
      <DrawerHeader>
        <DrawerTitle>Find Similar</DrawerTitle>
        <DrawerDescription>
          Books like &ldquo;{book.title}&rdquo; from your enabled metadata providers.
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Searching metadata providers…
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 py-6 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            Couldn&rsquo;t reach any metadata providers. Try again later.
          </div>
        )}

        {status === "ready" && books.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <SearchX className="size-5" />
            No similar books found.
          </div>
        )}

        {status === "ready" && books.length > 0 && (
          <>
            <BookGridLayout>
              {books.map((similar) => (
                <a
                  key={`${similar.source}:${similar.key}`}
                  href={discoveredBookUrl(similar)}
                  target="_blank"
                  rel="noreferrer"
                  className={bookTileClassName()}
                >
                  <BookTile
                    title={similar.title}
                    author={similar.authors?.join(", ") ?? "Unknown author"}
                    coverUrl={similar.coverUrl}
                  />
                  <span className="mt-1.5 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent-foreground">
                    {similar.sourceLabel}
                  </span>
                </a>
              ))}
            </BookGridLayout>
            {streaming && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                still searching…
              </div>
            )}
          </>
        )}
      </div>
    </SideDrawer>
  );
}
