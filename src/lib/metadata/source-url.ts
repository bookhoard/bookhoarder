import type { DiscoveredBook } from "./types";

/** Where to send the user to see a discovered book on its origin site. */
export function discoveredBookUrl(book: DiscoveredBook): string {
  switch (book.source) {
    case "google":
      return `https://books.google.com/books?id=${book.key}`;
    default:
      return `https://openlibrary.org${book.key}`;
  }
}
