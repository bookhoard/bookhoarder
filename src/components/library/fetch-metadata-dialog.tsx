"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, AlertCircle, BookOpen, SearchX } from "lucide-react";
import {
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { SideDrawer } from "@/components/side-drawer";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { readNdjsonStream } from "@/lib/metadata/ndjson-client";
import type { Book, BookRecord } from "@/lib/books/types";
import type { MetadataCandidate, ProviderResultChunk } from "@/lib/metadata/types";

interface FetchMetadataDialogProps {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (book: BookRecord) => void;
}

type Status = "loading" | "ready" | "empty" | "error";

export function FetchMetadataDialog({
  book,
  open,
  onOpenChange,
  onApplied,
}: FetchMetadataDialogProps) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<MetadataCandidate[]>(
    [],
  );
  const [applying, setApplying] = React.useState(false);

  const [api, setApi] = React.useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const [useTitle, setUseTitle] = React.useState(false);
  const [useAuthor, setUseAuthor] = React.useState(false);
  const [useDescription, setUseDescription] = React.useState(false);
  const [useCover, setUseCover] = React.useState(false);

  // description text per candidate index — undefined = not fetched yet,
  // null = fetched but Open Library had nothing
  const [descriptions, setDescriptions] = React.useState<
    Record<number, string | null>
  >({});
  const [descriptionLoading, setDescriptionLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setStatus("loading");
    setStreaming(true);
    setError(null);
    setCandidates([]);
    setSelectedIndex(0);
    setDescriptions({});

    const controller = new AbortController();
    let sawAny = false;

    fetch(`/api/books/${book.id}/metadata/candidates`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "No metadata found");
        }
        await readNdjsonStream<ProviderResultChunk<MetadataCandidate>>(res, (chunk) => {
          if (chunk.results.length === 0) return;
          sawAny = true;
          setCandidates((prev) => [...prev, ...chunk.results]);
          setStatus("ready");
        });
        if (!sawAny) setStatus("empty");
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError((e as Error).message);
        setStatus("error");
      })
      .finally(() => setStreaming(false));

    return () => controller.abort();
  }, [open, book.id]);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // left/right cycles through editions while the drawer is open, without
  // stealing arrow keys meant for a focused text input
  React.useEffect(() => {
    if (!open || !api) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") api.scrollPrev();
      if (e.key === "ArrowRight") api.scrollNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, api]);

  const candidate = candidates[selectedIndex];
  const candidateAuthor = candidate?.authors?.join(", ");
  const sourceLabels = React.useMemo(
    () => [...new Set(candidates.map((c) => c.sourceLabel))].join(", "),
    [candidates],
  );

  const description = candidate ? descriptions[selectedIndex] : undefined;

  React.useEffect(() => {
    if (!candidate) return;
    setUseTitle(!!candidate.title && candidate.title !== book.title);
    setUseAuthor(!!candidate.authors?.length);
    setUseCover(!!candidate.coverUrl);
  }, [candidate, book.title]);

  React.useEffect(() => {
    setUseDescription(!!description);
  }, [description]);

  React.useEffect(() => {
    if (!candidate || descriptions[selectedIndex] !== undefined) return;
    // Some editions carry their own description — use it directly instead
    // of fetching the (identical, language-independent) work-level one.
    if (candidate.description) {
      setDescriptions((prev) => ({
        ...prev,
        [selectedIndex]: candidate.description!,
      }));
      return;
    }
    // Only Open Library needs a lazy per-edition fetch — every other
    // provider already returns the full description inline (or has none).
    if (candidate.source !== "openlibrary" || !candidate.key) {
      setDescriptions((prev) => ({ ...prev, [selectedIndex]: null }));
      return;
    }
    const index = selectedIndex;
    setDescriptionLoading(true);
    fetch(`/api/metadata/description?key=${encodeURIComponent(candidate.key)}`)
      .then((res) => res.json())
      .then((data: { description: string | null }) => {
        setDescriptions((prev) => ({ ...prev, [index]: data.description }));
      })
      .catch(() => {
        setDescriptions((prev) => ({ ...prev, [index]: null }));
      })
      .finally(() => setDescriptionLoading(false));
  }, [candidate, selectedIndex, descriptions]);

  const handleApply = async () => {
    if (!candidate) return;
    setApplying(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (useTitle && candidate.title) body.title = candidate.title;
      if (useAuthor && candidateAuthor) body.author = candidateAuthor;
      if (useDescription && description) body.description = description;
      if (useCover && candidate.coverUrl) body.coverUrl = candidate.coverUrl;

      const res = await fetch(`/api/books/${book.id}/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save metadata");
      onApplied(data.book as BookRecord);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      disablePointerDismissal
    >
      <DrawerHeader>
        <DrawerTitle>Fetch Metadata</DrawerTitle>
        <DrawerDescription>
          {candidates.length > 1
            ? `${candidates.length} results from ${sourceLabels} — pick the right edition.`
            : candidates.length === 1
              ? `1 result from ${sourceLabels}.`
              : status === "empty"
                ? "No metadata found."
                : "Searching your enabled metadata providers."}
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex-1 overflow-y-auto px-4">
        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Searching metadata providers…
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2 py-6 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {status === "empty" && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <SearchX className="size-5" />
            No metadata found for this book.
          </div>
        )}

        {status === "ready" && candidates.length > 0 && (
          <div className="flex flex-col gap-4 py-4">
            <Carousel setApi={setApi} className="px-8">
              <CarouselContent>
                {candidates.map((c, i) => (
                  <CarouselItem key={i} className="basis-full">
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-4">
                      <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded border border-border bg-muted">
                        {c.coverUrl ? (
                          <Image
                            src={c.coverUrl}
                            alt={c.title ?? "Cover"}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen
                              className="size-6 text-foreground/15"
                              strokeWidth={1.5}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="line-clamp-2 text-sm font-medium">
                          {c.title ?? "Untitled"}
                        </p>
                        {c.authors && c.authors.length > 0 && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {c.authors.join(", ")}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                          <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent-foreground">
                            {c.sourceLabel}
                          </span>
                          {c.language && (
                            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                              {c.language}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-1" />
              <CarouselNext className="-right-1" />
            </Carousel>
            <p className="-mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              {selectedIndex + 1} / {candidates.length}
              {streaming && (
                <span className="flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  still searching…
                </span>
              )}
            </p>

            {candidate && (
              <div className="flex flex-col gap-3">
                {candidate.coverUrl && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Cover</p>
                      <p className="text-xs text-muted-foreground">
                        {book.hasCover
                          ? "Replaces your existing cover"
                          : "No cover set yet"}
                      </p>
                    </div>
                    <Switch checked={useCover} onCheckedChange={setUseCover} />
                  </div>
                )}

                {candidate.title && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Title</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {candidate.title}
                      </p>
                    </div>
                    <Switch checked={useTitle} onCheckedChange={setUseTitle} />
                  </div>
                )}

                {candidateAuthor && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Author</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {candidateAuthor}
                      </p>
                    </div>
                    <Switch
                      checked={useAuthor}
                      onCheckedChange={setUseAuthor}
                    />
                  </div>
                )}

                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Description</p>
                    <Switch
                      checked={useDescription}
                      onCheckedChange={setUseDescription}
                      disabled={!description}
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
                    {descriptionLoading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-3 animate-spin" />
                        Loading…
                      </span>
                    ) : description ? (
                      description
                    ) : (
                      <span className="italic">No description available</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </div>

      <DrawerFooter className="sm:flex-row sm:justify-end">
        <DrawerClose render={<Button variant="outline">Cancel</Button>} />
        <Button
          onClick={handleApply}
          disabled={status !== "ready" || applying}
          className="gap-2"
        >
          {applying && <Loader2 className="size-4 animate-spin" />}
          Apply
        </Button>
      </DrawerFooter>
    </SideDrawer>
  );
}
