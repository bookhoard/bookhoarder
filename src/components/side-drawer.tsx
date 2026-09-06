"use client";

import * as React from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

type SideDrawerProps = Omit<React.ComponentProps<typeof Drawer>, "children"> & {
  /** Extra classes merged onto DrawerContent, e.g. to widen a specific drawer. */
  contentClassName?: string;
  children?: React.ReactNode;
};

/**
 * Shared shell for every right-side panel drawer in the app. Swipe
 * direction, the swipe handle, and the panel width are set once here so
 * changing any of them updates every drawer at once instead of needing an
 * edit in each file.
 */
export function SideDrawer({
  children,
  contentClassName,
  swipeDirection = "right",
  showSwipeHandle = true,
  ...props
}: SideDrawerProps) {
  return (
    <Drawer
      swipeDirection={swipeDirection}
      showSwipeHandle={showSwipeHandle}
      {...props}
    >
      <DrawerContent
        className={cn(
          "my-3 border-t border-b data-[swipe-axis=x]:[--drawer-content-width:94vw]! data-[swipe-axis=x]:sm:[--drawer-content-width:min(36rem,92vw)]!",
          contentClassName,
        )}
      >
        {children}
      </DrawerContent>
    </Drawer>
  );
}
