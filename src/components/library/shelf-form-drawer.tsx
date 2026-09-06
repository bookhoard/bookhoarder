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
import { cn } from "@/lib/utils";
import { SHELF_COLORS, nextShelfColor, type Shelf } from "@/lib/shelves";

interface ShelfFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCount: number;
  /** present -> edit this shelf; absent -> create a new one */
  editingShelf?: Shelf | null;
  onCreate: (name: string, color: string) => void;
  onEdit?: (id: string, name: string, color: string) => void;
}

export function ShelfFormDrawer({
  open,
  onOpenChange,
  existingCount,
  editingShelf,
  onCreate,
  onEdit,
}: ShelfFormDrawerProps) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(SHELF_COLORS[0]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isEditing = !!editingShelf;

  React.useEffect(() => {
    if (!open) return;
    setName(editingShelf?.name ?? "");
    setColor(editingShelf?.color ?? nextShelfColor(existingCount));
    requestAnimationFrame(() => inputRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingShelf?.id, existingCount]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isEditing && editingShelf) {
      onEdit?.(editingShelf.id, trimmed, color);
    } else {
      onCreate(trimmed, color);
    }
    onOpenChange(false);
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      disablePointerDismissal
    >
      <DrawerHeader>
        <DrawerTitle>{isEditing ? "Edit Shelf" : "New Shelf"}</DrawerTitle>
        <DrawerDescription>
          Give it a name and a color to spot it by.
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="shelf-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="shelf-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="e.g. Summer Reading"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Color</p>
          <div className="flex flex-wrap gap-2">
            {SHELF_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110",
                  c,
                  color === c &&
                    "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <DrawerFooter className="sm:flex-row sm:justify-end">
        <DrawerClose render={<Button variant="outline">Cancel</Button>} />
        <Button onClick={handleSubmit} disabled={!name.trim()}>
          {isEditing ? "Save changes" : "Create shelf"}
        </Button>
      </DrawerFooter>
    </SideDrawer>
  );
}
