"use client";

import * as React from "react";
import {
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { SideDrawer } from "@/components/side-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookCover } from "./book-cover";
import { TagInput } from "./tag-input";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { Book, BookRecord } from "@/lib/books/types";

interface EditBookDrawerProps {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (book: BookRecord) => void;
}

export function EditBookDrawer({
  book,
  open,
  onOpenChange,
  onApplied,
}: EditBookDrawerProps) {
  const [title, setTitle] = React.useState(book.title);
  const [author, setAuthor] = React.useState(book.author);
  const [description, setDescription] = React.useState(book.description ?? "");
  const [tags, setTags] = React.useState<string[]>(book.tags ?? []);
  const [seriesName, setSeriesName] = React.useState(book.series?.name ?? "");
  const [seriesPosition, setSeriesPosition] = React.useState(
    book.series ? String(book.series.position) : "",
  );
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = React.useState<string | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description ?? "");
    setTags(book.tags ?? []);
    setSeriesName(book.series?.name ?? "");
    setSeriesPosition(book.series ? String(book.series.position) : "");
    setCoverFile(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, book]);

  React.useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.add({ title: "Cover must be an image file", type: "error" });
      return;
    }
    setCoverFile(file);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();
    if (!trimmedTitle || !trimmedAuthor) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("title", trimmedTitle);
      form.set("author", trimmedAuthor);
      form.set("description", description.trim());
      form.set("tags", JSON.stringify(tags));
      form.set("seriesName", seriesName.trim());
      form.set("seriesPosition", seriesPosition);
      if (coverFile) form.set("cover", coverFile);

      const res = await fetch(`/api/books/${book.id}/metadata`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save book");
      onApplied(data.book as BookRecord);
      onOpenChange(false);
    } catch (e) {
      toast.add({
        title: "Couldn't save book",
        description: (e as Error).message,
        type: "error",
      });
    } finally {
      setSaving(false);
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
        <DrawerTitle>Edit Book</DrawerTitle>
        <DrawerDescription>
          Update this book&rsquo;s cover, title, author, description, tags, and
          series.
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pt-6">
        <div className="flex flex-col items-center gap-2">
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            aria-label="Change cover"
            className="group relative w-32 shrink-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {coverPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreviewUrl}
                alt="New cover preview"
                className="aspect-[2/3] w-full rounded-lg border border-border object-cover"
              />
            ) : (
              <BookCover
                title={book.title}
                coverUrl={book.coverUrl}
                className="w-32"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
              <ImageUp className="size-6 text-white" strokeWidth={1.75} />
            </div>
          </button>
          {coverFile && (
            <button
              type="button"
              onClick={() => setCoverFile(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Undo
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="book-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="book-title"
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dracula"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="book-author" className="text-sm font-medium">
            Author
          </label>
          <Input
            id="book-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. Bram Stoker"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="book-description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="book-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this book about?"
            rows={6}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Tags</label>
          <TagInput value={tags} onChange={setTags} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="book-series" className="text-sm font-medium">
            Series
          </label>
          <div className="flex gap-2">
            <Input
              id="book-series"
              value={seriesName}
              onChange={(e) => setSeriesName(e.target.value)}
              placeholder="e.g. The Dracula Chronicles"
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              value={seriesPosition}
              onChange={(e) => setSeriesPosition(e.target.value)}
              placeholder="#"
              className="w-16"
              aria-label="Position in series"
            />
          </div>
        </div>
      </div>

      <DrawerFooter className="sm:flex-row sm:justify-end">
        <DrawerClose render={<Button variant="outline">Cancel</Button>} />
        <Button
          onClick={handleSubmit}
          disabled={!title.trim() || !author.trim() || saving}
          className="gap-2"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </DrawerFooter>
    </SideDrawer>
  );
}
