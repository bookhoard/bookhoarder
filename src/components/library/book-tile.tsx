import { cn } from "@/lib/utils";
import { BookCover } from "./book-cover";

/** Inline style that staggers a tile's entrance by its position in the grid (capped so long lists don't wait). */
export function tileEntranceStyle(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, 20) * 25}ms` };
}

export function bookTileClassName(selected?: boolean) {
  return cn(
    "group w-full cursor-pointer overflow-hidden rounded-xl p-2 text-left transition-colors hover:bg-accent/60 sm:w-40 sm:shrink-0",
    // Entrance animation, staggered per-tile via an inline animation-delay
    // (see `tileEntranceDelay`) — plays once on mount, not on every
    // re-render, since CSS animations don't replay for a DOM node React
    // reuses across a stable `key`.
    "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300",
    selected && "bg-accent"
  );
}

interface BookTileProps {
  title: string;
  author: string;
  coverUrl?: string | null;
  /** Overlaid on the cover, e.g. a "read" checkmark badge. */
  badge?: React.ReactNode;
}

/** Cover + title/author block shared by every grid that displays books (library, reading now, trending). */
export function BookTile({ title, author, coverUrl, badge }: BookTileProps) {
  return (
    <>
      <div className="relative">
        <BookCover title={title} coverUrl={coverUrl} />
        {badge}
      </div>
      <p className="mt-3 line-clamp-1 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{author}</p>
    </>
  );
}
