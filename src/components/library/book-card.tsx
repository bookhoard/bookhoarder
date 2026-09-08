"use client";

import * as React from "react";
import {
  Check,
  FolderPlus,
  CheckCircle2,
  Pencil,
  Star,
  Sparkles,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { BookTile, bookTileClassName } from "./book-tile";
import { EditBookDrawer } from "./edit-book-drawer";
import { RateDialog } from "./rate-dialog";
import { FetchMetadataDialog } from "./fetch-metadata-dialog";
import { FindSimilarDrawer } from "./find-similar-drawer";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { BOOK_DRAG_MIME } from "@/lib/dnd";
import { useLibraryShell } from "./library-shell-context";
import type { Book, BookRecord } from "@/lib/books/types";
import type { Shelf } from "@/lib/shelves";

export interface BookCardActions {
  shelves: Shelf[];
  onToggleShelf: (shelfId: string, bookId: string) => void;
  onUpdateBook: (bookId: string, patch: { rating?: number; read?: boolean }) => void;
  onMetadataApplied: (book: BookRecord) => void;
  onDeleteBook: (bookId: string) => void;
  onSendToEreader: (bookId: string) => void;
}

interface BookCardProps {
  book: Book;
  selected?: boolean;
  onSelect: (book: Book) => void;
  actions: BookCardActions;
}

export function BookCard({ book, selected, onSelect, actions }: BookCardProps) {
  const {
    shelves,
    onToggleShelf,
    onUpdateBook,
    onMetadataApplied,
    onDeleteBook,
    onSendToEreader,
  } = actions;
  const [editDrawerOpen, setEditDrawerOpen] = React.useState(false);
  const [rateDialogOpen, setRateDialogOpen] = React.useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = React.useState(false);
  const [findSimilarOpen, setFindSimilarOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const { activeProfile } = useLibraryShell();
  const isAdmin = activeProfile.role === "admin";

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(BOOK_DRAG_MIME, book.id);
              e.dataTransfer.effectAllowed = "copy";
              // The card's own DOM node, as-rendered, so the drag ghost shows
              // the whole card (cover + title + author) instead of whatever
              // partial snapshot the browser would otherwise guess at.
              e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
            }}
            onClick={() => onSelect(book)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(book);
              }
            }}
            className={bookTileClassName(selected)}
          />
        }
      >
        <BookTile
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          badge={
            book.read && (
              <span
                title="Read"
                className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            )
          }
        />
      </ContextMenuTrigger>

      <ContextMenuContent className="w-44">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderPlus className="size-3.5" />
            Add to shelf
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {shelves.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No shelves yet — create one from the sidebar.
              </p>
            ) : (
              shelves.map((shelf) => (
                <ContextMenuCheckboxItem
                  key={shelf.id}
                  checked={shelf.bookIds.includes(book.id)}
                  onCheckedChange={() => onToggleShelf(shelf.id, book.id)}
                >
                  <span className={cn("mr-1 size-2 rounded-full", shelf.color)} />
                  {shelf.name}
                </ContextMenuCheckboxItem>
              ))
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setEditDrawerOpen(true)}>
          <Pencil className="size-3.5" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setMetadataDialogOpen(true)}>
          <Sparkles className="size-3.5" />
          Fetch metadata
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onUpdateBook(book.id, { read: !book.read })}>
          <CheckCircle2 className="size-3.5" />
          {book.read ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setRateDialogOpen(true)}>
          <Star className="size-3.5" />
          Rate{book.rating ? ` (${book.rating}/5)` : ""}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setFindSimilarOpen(true)}>
          <Search className="size-3.5" />
          Find similar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onSendToEreader(book.id)}>
          <Send className="size-3.5" />
          Send to e-reader
        </ContextMenuItem>
        {isAdmin && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
              Delete book
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>

      <EditBookDrawer
        book={book}
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        onApplied={onMetadataApplied}
      />
      <RateDialog
        book={book}
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
        onRate={(rating) => onUpdateBook(book.id, { rating })}
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
    </ContextMenu>
  );
}
