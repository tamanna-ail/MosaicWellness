"use client";

/** Dialog + side Sheet built on Radix Dialog (the same base shadcn/ui uses). */
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

function Overlay() {
  return <D.Overlay className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />;
}

export function DialogContent({ className, children, title, description, hideClose }: { className?: string; children: React.ReactNode; title: string; description?: string; hideClose?: boolean }) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-fade-up",
          className,
        )}
      >
        <D.Title className="sr-only">{title}</D.Title>
        {description && <D.Description className="sr-only">{description}</D.Description>}
        {children}
        {!hideClose && (
          <D.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}

export function Sheet({ open, onOpenChange, children, title, side = "right", className }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode; title: string; side?: "right" | "left"; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <Overlay />
        <D.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-0 z-50 flex h-full w-full flex-col bg-surface shadow-pop outline-none transition-transform",
            side === "right" ? "right-0 max-w-[560px] border-l border-line data-[state=open]:animate-[sheet-in-right_0.32s_cubic-bezier(0.2,0.8,0.2,1)]" : "left-0 max-w-[300px] border-r border-line data-[state=open]:animate-[sheet-in-left_0.28s_cubic-bezier(0.2,0.8,0.2,1)]",
            className,
          )}
        >
          <D.Title className="sr-only">{title}</D.Title>
          {children}
          <D.Close className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </D.Content>
      </D.Portal>
      <style>{`@keyframes sheet-in-right{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}@keyframes sheet-in-left{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </D.Root>
  );
}
