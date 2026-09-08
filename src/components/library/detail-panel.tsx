"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  BookOpen,
  Download,
  FolderPlus,
  MoreVertical,
  Pencil,
  Sparkles,
  Search,
  Send,
  CheckCircle2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { BookCover } from "./book-cover";
import { Badge } from "@/components/ui/badge";
import { EditBookDrawer } from "./edit-book-drawer";
import { FetchMetadataDialog } from "./fetch-metadata-dialog";
import { FindSimilarDrawer } from "./find-similar-drawer";
import { RateDialog } from "./rate-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { BookReader } from "@/app/api/books/[id]/readers/route";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatAddedDate, formatBytes } from "@/lib/format";
import { useLibraryShell } from "./library-shell-context";
import { bookFileUrl, type Book, type BookRecord } from "@/lib/books/types";
import type { Shelf } from "@/lib/shelves";

interface DetailPanelProps {
  book: Book;
  shelves: Shelf[];
  onToggleShelf: (shelfId: string, bookId: string) => void;
  onClose: () => void;
  onMetadataApplied: (book: BookRecord) => void;
  onUpdateBook: (bookId: string, patch: { rating?: number; read?: boolean }) => void;
  onDeleteBook: (bookId: string) => void;
  onSendToEreader: (bookId: string) => void;
}

export function DetailPanel({
  book,
  shelves,
  onToggleShelf,
  onClose,
  onMetadataApplied,
  onUpdateBook,
  onDeleteBook,
  onSendToEreader,
}: DetailPanelProps) {
  const [editDrawerOpen, setEditDrawerOpen] = React.useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = React.useState(false);
  const [findSimilarOpen, setFindSimilarOpen] = React.useState(false);
  const [rateDialogOpen, setRateDialogOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const { activeProfile } = useLibraryShell();
  const isAdmin = activeProfile.role === "admin";

  const [readers, setReaders] = React.useState<BookReader[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/books/${book.id}/readers`)
      .then((res) => res.json())
      .then((data: { readers: BookReader[] }) => {
        if (!cancelled) setReaders(data.readers ?? []);
      })
      .catch(() => {
        if (!cancelled) setReaders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  return (
    <aside className="relative flex h-full w-full flex-col p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex gap-4 pr-8">
        <BookCover title={book.title} coverUrl={book.coverUrl} className="w-20" />
        <div className="flex flex-col justify-center gap-1.5">
          <h2 className="font-heading text-lg font-bold leading-snug text-balance">
            {book.title}
          </h2>
          <p className="text-sm text-muted-foreground">{book.author}</p>
          {book.series && (
            <p className="text-xs text-muted-foreground">
              {book.series.name} · #{book.series.position}
            </p>
          )}
          <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              Added {formatAddedDate(book.addedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              {formatBytes(book.size)}
            </span>
          </div>
        </div>
      </div>

      {!!book.tags?.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {book.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1 gap-2 rounded-full"
          render={<Link href={`/read/${book.id}?toc=1`} />}
          nativeButton={false}
        >
          <BookOpen className="size-4" />
          Chapter List
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full"
                aria-label="More options"
              >
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderPlus className="size-3.5" />
                Add to shelf
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {shelves.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    No shelves yet — create one from the sidebar.
                  </p>
                ) : (
                  shelves.map((shelf) => (
                    <DropdownMenuCheckboxItem
                      key={shelf.id}
                      checked={shelf.bookIds.includes(book.id)}
                      onCheckedChange={() => onToggleShelf(shelf.id, book.id)}
                    >
                      <span className={cn("mr-1 size-2 rounded-full", shelf.color)} />
                      {shelf.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditDrawerOpen(true)}>
              <Pencil className="size-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMetadataDialogOpen(true)}>
              <Sparkles className="size-3.5" />
              Fetch metadata
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onUpdateBook(book.id, { read: !book.read })}>
              <CheckCircle2 className="size-3.5" />
              {book.read ? "Mark as unread" : "Mark as read"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRateDialogOpen(true)}>
              <Star className="size-3.5" />
              Rate{book.rating ? ` (${book.rating}/5)` : ""}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFindSimilarOpen(true)}>
              <Search className="size-3.5" />
              Find similar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSendToEreader(book.id)}>
              <Send className="size-3.5" />
              Send to e-reader
            </DropdownMenuItem>
            <DropdownMenuItem render={<a href={bookFileUrl(book.id)} download={`${book.title}.epub`} />}>
              <Download className="size-3.5" />
              Download EPUB
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  Delete book
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
        {book.description ? (
          <p className="first-letter:float-left first-letter:mr-1 first-letter:font-heading first-letter:text-4xl first-letter:font-bold first-letter:text-foreground">
            {book.description}
          </p>
        ) : (
          <p className="text-muted-foreground/70 italic">
            No description yet — try “Fetch metadata” above.
          </p>
        )}
      </div>

      {readers.length > 0 && (
        <div className="mt-6 shrink-0 border-t border-border pt-4">
          <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground">
            WHO&rsquo;S READING
          </p>
          <div className="flex flex-col gap-2">
            {readers.map((r) => (
              <div key={r.profileId} className="flex items-center gap-2">
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback
                    className={cn(r.color, "text-[10px] font-semibold text-white")}
                  >
                    {r.name.trim().charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm">{r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {r.read
                    ? "Read"
                    : r.progress !== undefined
                      ? `${r.progress}%`
                      : r.rating
                        ? `★ ${r.rating}`
                        : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        className="mt-6 w-full rounded-full"
        size="lg"
        render={<Link href={`/read/${book.id}`} />}
        nativeButton={false}
      >
        Read Now
      </Button>

      <EditBookDrawer
        book={book}
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        onApplied={onMetadataApplied}
      />
      <FetchMetadataDialog
        book={book}
        open={metadataDialogOpen}
        onOpenChange={setMetadataDialogOpen}
        onApplied={onMetadataApplied}
      />
      <FindSimilarDrawer
        book={book}
        open={findSimilarOpen}
        onOpenChange={setFindSimilarOpen}
      />
      <RateDialog
        book={book}
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
        onRate={(rating) => onUpdateBook(book.id, { rating })}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{book.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the EPUB file and its metadata. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDeleteOpen(false);
                onDeleteBook(book.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
