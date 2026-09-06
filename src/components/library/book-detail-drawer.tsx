"use client";

import { SideDrawer } from "@/components/side-drawer";
import { DetailPanel } from "./detail-panel";
import { useLibraryShell } from "./library-shell-context";

export function BookDetailDrawer() {
  const { selected, displayedBook, setSelected, bookCardActions } =
    useLibraryShell();

  return (
    <SideDrawer
      open={!!selected}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
      modal={false}
    >
      {displayedBook && (
        <DetailPanel
          book={displayedBook}
          onClose={() => setSelected(null)}
          {...bookCardActions}
        />
      )}
    </SideDrawer>
  );
}
