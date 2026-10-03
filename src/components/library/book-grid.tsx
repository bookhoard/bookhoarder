"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, LibraryBig } from "lucide-react";
import { BookCard, type BookCardActions } from "./book-card";
import { useLibraryShell } from "./library-shell-context";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import type { Book } from "@/lib/books/types";

/** Grid wrapper shared by every view that lays out book tiles (library, reading now, trending). */
export function BookGridLayout({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap">{children}</div>;
}

interface BookGridProps {
  title: string;
  books: Book[];
  selectedId?: string;
  onSelect: (book: Book) => void;
  actions: BookCardActions;
  emptyIcon?: React.ElementType;
  emptyTitle: string;
  emptyMessage: string;
  /** Extra tile shown before the book cards, e.g. an upload drop placeholder. */
  leadingSlot?: React.ReactNode;
  /** Extra controls shown next to the title, e.g. a sort menu. */
  titleActions?: React.ReactNode;
}

export function BookGrid({
  title,
  books,
  selectedId,
  onSelect,
  actions,
  emptyIcon: EmptyIcon = LibraryBig,
  emptyTitle,
  emptyMessage,
  leadingSlot,
  titleActions,
}: BookGridProps) {
  const { settings } = useLibraryShell();
  const [page, setPage] = React.useState(1);
  const perPage = settings.booksPerPage;
  const totalPages = Math.max(1, Math.ceil(books.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageBooks = books.slice(start, start + perPage);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate font-heading text-lg font-bold tracking-tight">
          {title}
        </h2>
        {titleActions}
      </div>
      {books.length === 0 && !leadingSlot ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-full">
              <EmptyIcon />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyMessage}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <BookGridLayout>
            {currentPage === 1 && leadingSlot}
            {pageBooks.map((book, index) => (
              <BookCard
                key={book.id}
                book={book}
                selected={book.id === selectedId}
                onSelect={onSelect}
                actions={actions}
                index={index}
              />
            ))}
          </BookGridLayout>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="group flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowLeft className="size-5 transition-transform duration-200 ease-out group-hover:-translate-x-px" />
              </button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="group flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowRight className="size-5 transition-transform duration-200 ease-out group-hover:translate-x-px" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
