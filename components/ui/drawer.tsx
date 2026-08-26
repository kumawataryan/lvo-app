"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

const Drawer = DrawerPrimitive.Root;
const DrawerTitle = DrawerPrimitive.Title;
const DrawerDescription = DrawerPrimitive.Description;

const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof DrawerPrimitive.Popup>
>(({ className = "", ...props }, ref) => (
  <DrawerPrimitive.Portal>
    <DrawerPrimitive.Backdrop className="fixed inset-0 z-[2100] min-h-dvh bg-black/30 backdrop-blur-md transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
    <DrawerPrimitive.Viewport className="fixed inset-0 z-[2101] flex items-end justify-center">
      <DrawerPrimitive.Popup
        ref={ref}
        className={`w-full max-w-[430px] max-h-[78dvh] overflow-y-auto overscroll-contain rounded-t-[24px] bg-white px-5 pb-6 pt-3 text-black outline-none shadow-[0_-18px_45px_rgba(0,0,0,0.2)] touch-auto [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-[swiping]:select-none data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*400ms)] ${className}`}
        {...props}
      />
    </DrawerPrimitive.Viewport>
  </DrawerPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

export { Drawer, DrawerContent, DrawerDescription, DrawerTitle };
