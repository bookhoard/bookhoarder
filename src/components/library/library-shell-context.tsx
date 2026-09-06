"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { useShelves } from "@/hooks/use-shelves";
import { bookCoverUrl, toLibraryBook, type Book, type BookRecord } from "@/lib/books/types";
import type { Shelf } from "@/lib/shelves";
import { computeSmartShelves, type SmartShelf } from "@/lib/shelves/smart";
import type { PublicProfile } from "@/lib/profiles/types";
import type { PublicAppSettings } from "@/lib/settings/types";
import type { BookCardActions } from "./book-card";

interface LibraryShellContextValue {
  books: Book[];
  selected: Book | null;
  setSelected: (book: Book | null) => void;
  displayedBook: Book | null;
  shelves: Shelf[];
  smartShelves: SmartShelf[];
  createShelf: (name: string, color: string) => void;
  renameShelf: (id: string, name: string) => void;
  recolorShelf: (id: string, color: string) => void;
  deleteShelf: (id: string) => void;
  addBookToShelf: (shelfId: string, bookId: string) => void;
  bookCardActions: BookCardActions;
  profiles: PublicProfile[];
  activeProfileId: string;
  activeProfile: PublicProfile;
  settings: PublicAppSettings;
  uploading: boolean;
  uploadFile: (file: File) => Promise<void>;
}

const LibraryShellContext = React.createContext<LibraryShellContextValue | null>(null);

export function useLibraryShell(): LibraryShellContextValue {
  const ctx = React.useContext(LibraryShellContext);
  if (!ctx) throw new Error("useLibraryShell must be used within LibraryShellProvider");
  return ctx;
}

interface LibraryShellProviderProps {
  initialBooks: Book[];
  profiles: PublicProfile[];
  activeProfileId: string;
  settings: PublicAppSettings;
  children: React.ReactNode;
}

export function LibraryShellProvider({
  initialBooks,
  profiles,
  activeProfileId,
  settings,
  children,
}: LibraryShellProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [books, setBooks] = React.useState<Book[]>(initialBooks);

  // The drawer's open/closed state (and which book it shows) lives on the
  // URL — ?book=<id> — rather than in local state, so it's shareable,
  // survives a refresh, and the browser back button closes it.
  const urlSelectedId = searchParams.get("book");
  // router.replace/push is async — a swipe-to-close needs `open` to flip to
  // false in the same tick it's requested, or Base UI's release animation
  // sees "still open" for a frame and snaps back before the URL catches up
  // and it closes for real, reading as a jump-then-close glitch. This mirrors
  // a close locally the instant it's requested; the effect below clears it
  // once the URL actually reflects the close (a no-op by then).
  const [closingOverride, setClosingOverride] = React.useState(false);
  const selectedId = closingOverride ? null : urlSelectedId;
  const selected = books.find((b) => b.id === selectedId) ?? null;
  React.useEffect(() => {
    if (closingOverride && urlSelectedId === null) setClosingOverride(false);
  }, [closingOverride, urlSelectedId]);

  // kept around during the close transition so the panel doesn't blank out
  // while it's sliding off-screen
  const [displayedBook, setDisplayedBook] = React.useState<Book | null>(null);
  const {
    shelves,
    createShelf,
    renameShelf,
    recolorShelf,
    deleteShelf,
    toggleBookInShelf,
    addBookToShelf,
  } = useShelves(activeProfileId);

  // Computed, non-persisted views (Unread/Currently Reading/Finished/5-Star)
  // — kept separate from `shelves` since they're not CRUD-able or a valid
  // drag-and-drop target for "add to shelf".
  const smartShelves = React.useMemo(() => computeSmartShelves(books), [books]);

  React.useEffect(() => {
    if (selected) setDisplayedBook(selected);
  }, [selected]);

  const setBookParam = React.useCallback(
    (id: string | null, opts?: { replace?: boolean }) => {
      setClosingOverride(id === null);
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("book", id);
      else params.delete("book");
      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Opening pushes a new history entry (so the back button closes the
  // drawer); closing replaces instead of stacking a redundant "closed" entry.
  const setSelected = React.useCallback(
    (book: Book | null) => setBookParam(book?.id ?? null, { replace: book === null }),
    [setBookParam]
  );

  React.useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, setSelected]);

  const [uploading, setUploading] = React.useState(false);

  const handleUploaded = (record: BookRecord) => {
    const book = toLibraryBook(record);
    setBooks((prev) => [...prev.filter((b) => b.id !== book.id), book]);
  };

  const uploadFile = React.useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".epub")) {
      toast.add({ title: "Only .epub files are supported", type: "error" });
      return;
    }
    if (file.size > settings.uploadMaxSizeMb * 1024 * 1024) {
      toast.add({
        title: "File too large",
        description: `Larger than the ${settings.uploadMaxSizeMb}MB upload limit (Settings → Library)`,
        type: "error",
      });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/books", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.add({ title: "Upload failed", description: data.error, type: "error" });
      } else if (data.duplicate) {
        toast.add({
          title: "Already in your library",
          description: `"${data.book.title}" is already here`,
          type: "info",
        });
      } else {
        toast.add({
          title: "Book added",
          description: `"${data.book.title}" was added to your library`,
          type: "success",
        });
        handleUploaded(data.book as BookRecord);
      }
    } catch {
      toast.add({ title: "Upload failed", type: "error" });
    } finally {
      setUploading(false);
    }
  }, [settings.uploadMaxSizeMb]);

  // Merges the record onto the existing Book rather than replacing it: a
  // plain metadata refresh returns a bare BookRecord with no reading state,
  // and blindly swapping the book would wipe its rating/progress/read flag
  // out of local state until the next full page load. A PATCH response
  // (rating/read/progress) already carries the fresh values and simply
  // overwrites them here as intended. `selected` re-derives from `books`
  // automatically, so only `displayedBook` needs an explicit nudge.
  const handleMetadataApplied = (record: BookRecord) => {
    const merge = (prev: Book): Book => ({ ...prev, ...record, coverUrl: bookCoverUrl(record) });
    setBooks((prev) => prev.map((b) => (b.id === record.id ? merge(b) : b)));
    setDisplayedBook((prev) => (prev && prev.id === record.id ? merge(prev) : prev));
  };

  const handleUpdateBook = async (
    bookId: string,
    patch: { rating?: number; read?: boolean }
  ) => {
    const res = await fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const data = await res.json();
    handleMetadataApplied(data.book as BookRecord);
  };

  const handleDeleteBook = async (bookId: string) => {
    const title = books.find((b) => b.id === bookId)?.title;
    const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.add({ title: "Failed to delete book", type: "error" });
      return;
    }
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (selectedId === bookId) setBookParam(null, { replace: true });
    toast.add({
      title: "Book deleted",
      description: title ? `"${title}" was removed from your library` : undefined,
      type: "success",
    });
  };

  const handleSendToEreader = async (bookId: string) => {
    const title = books.find((b) => b.id === bookId)?.title;
    const res = await fetch(`/api/books/${bookId}/send-to-ereader`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.add({
        title: "Couldn't send to e-reader",
        description: data.error,
        type: "error",
      });
      return;
    }
    toast.add({
      title: "Sent to e-reader",
      description: title ? `"${title}" was emailed to ${data.sentTo}` : undefined,
      type: "success",
    });
  };

  const bookCardActions: BookCardActions = {
    shelves,
    onToggleShelf: toggleBookInShelf,
    onUpdateBook: handleUpdateBook,
    onMetadataApplied: handleMetadataApplied,
    onDeleteBook: handleDeleteBook,
    onSendToEreader: handleSendToEreader,
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  const value: LibraryShellContextValue = {
    books,
    selected,
    setSelected,
    displayedBook,
    shelves,
    smartShelves,
    createShelf,
    renameShelf,
    recolorShelf,
    deleteShelf,
    addBookToShelf,
    bookCardActions,
    profiles,
    activeProfileId,
    activeProfile,
    settings,
    uploading,
    uploadFile,
  };

  return <LibraryShellContext.Provider value={value}>{children}</LibraryShellContext.Provider>;
}
