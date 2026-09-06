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
import {
  PROFILE_COLORS,
  type ProfileRole,
  type PublicProfile,
} from "@/lib/profiles/types";

interface EditProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: PublicProfile | null;
  isActive: boolean;
  onSave: (
    id: string,
    patch: { name: string; color: string; role: ProfileRole },
  ) => void;
}

export function EditProfileDrawer({
  open,
  onOpenChange,
  profile,
  isActive,
  onSave,
}: EditProfileDrawerProps) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string>(PROFILE_COLORS[0]);
  const [role, setRole] = React.useState<ProfileRole>("reader");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || !profile) return;
    setName(profile.name);
    setColor(profile.color);
    setRole(profile.role);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, profile]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || !profile) return;
    onSave(profile.id, { name: trimmed, color, role });
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
        <DrawerTitle>Edit Profile</DrawerTitle>
        <DrawerDescription>
          Update this profile&rsquo;s name, color, and role.
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="profile-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="profile-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="e.g. Alex"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Color</p>
          <div className="flex flex-wrap gap-2">
            {PROFILE_COLORS.map((c) => (
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

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Role</p>
          <div className="flex gap-2">
            {(["admin", "reader"] as ProfileRole[]).map((r) => (
              <button
                key={r}
                type="button"
                disabled={isActive}
                onClick={() => setRole(r)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors",
                  role === r
                    ? "border-foreground bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                  isActive && "pointer-events-none opacity-50",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {isActive && (
            <p className="text-xs text-muted-foreground">
              You can&rsquo;t change your own role.
            </p>
          )}
        </div>
      </div>

      <DrawerFooter className="sm:flex-row sm:justify-end">
        <DrawerClose render={<Button variant="outline">Cancel</Button>} />
        <Button onClick={handleSubmit} disabled={!name.trim()}>
          Save changes
        </Button>
      </DrawerFooter>
    </SideDrawer>
  );
}
