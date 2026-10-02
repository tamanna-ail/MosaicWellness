"use client";

import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;

export function PopoverContent({ className, align = "end", children }: { className?: string; align?: "start" | "center" | "end"; children: React.ReactNode }) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={10} className={cn("z-50 w-80 rounded-2xl border border-line bg-surface p-2 shadow-pop outline-none data-[state=open]:animate-fade-up", className)}>
        {children}
      </P.Content>
    </P.Portal>
  );
}
