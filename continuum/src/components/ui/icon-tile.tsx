import * as React from "react";
import { BedDouble, FileText, Pill, ScanLine, Scissors, Stethoscope } from "lucide-react";
import type { DocumentType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Tone = "green" | "red" | "amber" | "blue" | "violet" | "neutral";

const TONE: Record<Tone, string> = {
  green: "bg-t-green-bg text-t-green",
  red: "bg-t-red-bg text-t-red",
  amber: "bg-t-amber-bg text-t-amber",
  blue: "bg-t-blue-bg text-t-blue",
  violet: "bg-t-violet-bg text-t-violet",
  neutral: "bg-sunken text-ink-2",
};

const SIZE = { sm: "size-8 rounded-[10px] [&_svg]:size-4", md: "size-10 rounded-xl [&_svg]:size-[18px]", lg: "size-12 rounded-2xl [&_svg]:size-5" };

/** A softly tinted square holding an icon; the tint encodes the kind of thing. */
export function IconTile({ tone, size = "md", className, children }: { tone: Tone; size?: keyof typeof SIZE; className?: string; children: React.ReactNode }) {
  return <span className={cn("flex shrink-0 items-center justify-center", SIZE[size], TONE[tone], className)}>{children}</span>;
}

export const DOC_TONE: Record<DocumentType, Tone> = {
  lab_report: "green",
  consultation: "blue",
  prescription: "red",
  discharge_summary: "violet",
  imaging: "violet",
  procedure: "amber",
};

const DOC_GLYPH: Record<DocumentType, React.ComponentType<{ strokeWidth?: number }>> = {
  lab_report: FileText,
  consultation: Stethoscope,
  prescription: Pill,
  discharge_summary: BedDouble,
  imaging: ScanLine,
  procedure: Scissors,
};

export function DocTile({ type, size = "md", className }: { type: DocumentType; size?: keyof typeof SIZE; className?: string }) {
  const Glyph = DOC_GLYPH[type];
  return (
    <IconTile tone={DOC_TONE[type]} size={size} className={className}>
      <Glyph strokeWidth={1.75} />
    </IconTile>
  );
}

/** Medication tint by class: hormones and supplements warm, cardiovascular red, antibiotics violet. */
export function medTone(drugClass: string): Tone {
  const c = drugClass.toLowerCase();
  if (c.includes("statin")) return "red";
  if (c.includes("antibiotic")) return "violet";
  if (c.includes("thyroid") || c.includes("vitamin")) return "amber";
  return "green";
}
