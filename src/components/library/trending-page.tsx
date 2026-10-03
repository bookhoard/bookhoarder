"use client";

import * as React from "react";
import { Loader2, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRENDING_PERIODS, type TrendingPeriod } from "@/lib/trending";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { BookGridLayout } from "./book-grid";
import { BookTile, bookTileClassName, tileEntranceStyle } from "./book-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { readNdjsonStream } from "@/lib/metadata/ndjson-client";
import { discoveredBookUrl } from "@/lib/metadata/source-url";
import type { DiscoveredBook, ProviderResultChunk } from "@/lib/metadata/types";

// A skeleton grid instead of a plain spinner while results load — each
// tile pulses in a staggered wave rather than all at once, so it reads as
// "still working" rather than a single frozen frame.
function TrendingGridSkeleton() {
  return (
    <div role="status" aria-label="Loading trending books">
      <BookGridLayout>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="w-full p-2 sm:w-40 sm:shrink-0">
            <Skeleton
              className="aspect-[2/3] w-full rounded-lg"
              style={{ animationDelay: `${(i % 6) * 75}ms` }}
            />
            <Skeleton className="mt-3 h-3.5 w-4/5 rounded" style={{ animationDelay: `${(i % 6) * 75}ms` }} />
            <Skeleton className="mt-2 h-3 w-2/5 rounded" style={{ animationDelay: `${(i % 6) * 75}ms` }} />
          </div>
        ))}
      </BookGridLayout>
    </div>
  );
}

export function TrendingPage() {
  useDocumentTitle("Trending");
  const [period, setPeriod] = React.useState<TrendingPeriod>("weekly");
  const [books, setBooks] = React.useState<DiscoveredBook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [streaming, setStreaming] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setStreaming(true);
    setBooks([]);

    fetch(`/api/trending?period=${period}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load trending books");
        await readNdjsonStream<ProviderResultChunk<DiscoveredBook>>(res, (chunk) => {
          if (chunk.results.length === 0) return;
          setBooks((prev) => [...prev, ...chunk.results]);
          setLoading(false);
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setBooks([]);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setStreaming(false);
      });

    return () => controller.abort();
  }, [period]);

  return (
    <section>
      <div className="mb-6 flex items-center gap-1 rounded-full border border-border p-1 w-fit">
        {TRENDING_PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              period === p.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TrendingGridSkeleton />
      ) : books.length === 0 ? (
        <Empty className="border py-24">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingDown />
            </EmptyMedia>
            <EmptyTitle>Couldn&rsquo;t load trending books right now.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <BookGridLayout>
            {books.map((book, index) => (
              <a
                key={`${book.source}:${book.key}`}
                href={discoveredBookUrl(book)}
                target="_blank"
                rel="noreferrer"
                className={bookTileClassName()}
                style={tileEntranceStyle(index)}
              >
                <BookTile
                  title={book.title}
                  author={book.authors?.join(", ") ?? "Unknown author"}
                  coverUrl={book.coverUrl}
                />
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
    </section>
  );
}
