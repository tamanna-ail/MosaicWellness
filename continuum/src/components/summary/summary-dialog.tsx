"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileHeart } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { Button, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
  { value: "3y", label: "Last 3 years" },
  { value: "all", label: "Entire history" },
  { value: "custom", label: "Custom dates" },
] as const;

export function SummaryDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<(typeof RANGES)[number]["value"]>("all");
  const [from, setFrom] = React.useState("2024-01-01");
  const [to, setTo] = React.useState(new Date().toISOString().slice(0, 10));

  const go = () => {
    setOpen(false);
    router.push(range === "custom" ? `/summary?range=custom&from=${from}&to=${to}` : `/summary?range=${range}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="primary">
            <FileHeart /> Create Medical Summary
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="Create medical summary" className="max-w-md">
        <div className="p-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <FileHeart className="size-5" />
          </div>
          <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Create a medical summary</h2>
          <p className="mt-1 text-[13.5px] text-ink-2">A doctor-ready overview of your records. Every line links back to its source document.</p>

          <div className="mt-5 space-y-1.5" role="radiogroup">
            {RANGES.map((r) => (
              <button
                key={r.value}
                role="radio"
                aria-checked={range === r.value}
                onClick={() => setRange(r.value)}
                className={cn("flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[14px] transition-colors", range === r.value ? "border-ink bg-surface-2" : "border-line hover:border-ink-4")}
              >
                <span className={cn("flex size-4 items-center justify-center rounded-full border", range === r.value ? "border-ink" : "border-ink-4")}>{range === r.value && <span className="size-2 rounded-full bg-ink" />}</span>
                {r.label}
              </button>
            ))}
          </div>

          {range === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-3 animate-fade-in">
              <label className="text-[12px] text-ink-3">
                From
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
              </label>
              <label className="text-[12px] text-ink-3">
                To
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
              </label>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={go}>
              Generate summary
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
