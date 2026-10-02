import * as React from "react";
import { ArrowDownRight, ArrowUpRight, FileImage, FileText, FlaskConical, Hospital, Minus, Pill, ScanLine, Scissors, Stethoscope } from "lucide-react";
import type { DocumentType, Flag } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function FlagBadge({ flag, className }: { flag: Flag; className?: string }) {
  if (flag === "high") return <Badge tone="high" className={className}>High</Badge>;
  if (flag === "low") return <Badge tone="low" className={className}>Low</Badge>;
  if (flag === "normal") return <Badge tone="ok" className={className}>In range</Badge>;
  return <Badge className={className}>No range</Badge>;
}

export const DOC_ICON: Record<DocumentType, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  lab_report: FlaskConical,
  prescription: Pill,
  consultation: Stethoscope,
  imaging: ScanLine,
  discharge_summary: Hospital,
  procedure: Scissors,
};

export function DocTypeIcon({ type, className }: { type: DocumentType; className?: string }) {
  const Icon = DOC_ICON[type];
  return <Icon className={cn("size-4", className)} strokeWidth={1.75} />;
}

export function FileGlyph({ mimeType, className }: { mimeType: string; className?: string }) {
  const Icon = mimeType.startsWith("image/") ? FileImage : FileText;
  return <Icon className={cn("size-4", className)} strokeWidth={1.6} />;
}

/** Neutral change indicator: direction only, no good/bad judgement. */
export function ChangeChip({ pct, from, decimals = 1, unit, className }: { pct?: number; from?: number; decimals?: number; unit?: string; className?: string }) {
  if (pct === undefined) return <span className={cn("text-[12px] text-ink-3", className)}>First result</span>;
  const Icon = Math.abs(pct) < 0.5 ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] text-ink-3 tabular", className)}>
      <Icon className="size-3.5" />
      {from !== undefined ? (
        <>
          {pct > 0 ? "up" : "down"} from {from.toFixed(decimals)}
          {unit ? ` ${unit}` : ""}
        </>
      ) : (
        <>
          {Math.abs(pct).toFixed(1)}% {pct > 0 ? "up" : "down"} from previous test
        </>
      )}
    </span>
  );
}

/** Tiny SVG sparkline with the last point emphasised. */
export function Sparkline({ values, flags, className, height = 36, width = 120 }: { values: number[]; flags?: Flag[]; className?: string; height?: number; width?: number }) {
  const id = React.useId();
  if (values.length < 2) return <div className={className} style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.18 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => 3 + (i * (width - 6)) / (values.length - 1);
  const y = (v: number) => 3 + (1 - (v - lo) / (hi - lo)) * (height - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  const lastFlag = flags?.[last];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} width={width} height={height} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${x(last)},${height} L${x(0)},${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last])} r="3" fill={lastFlag === "high" ? "var(--high)" : lastFlag === "low" ? "var(--low)" : "var(--accent)"} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3", className)}>{children}</div>;
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 93 ? "bg-ok" : pct >= 85 ? "bg-accent" : "bg-high";
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-ink-2 tabular">
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-sunken">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}
