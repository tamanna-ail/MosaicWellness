"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Calculator, FileText, Lightbulb, SearchX } from "lucide-react";
import type { AiAnswer, AnswerItem } from "@/lib/ai/types";
import { TrendChart } from "@/components/health/trend-chart";
import { Button } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/health/selectors";
import { cn } from "@/lib/utils";

function SourceChips({ ids, index, onOpen }: { ids?: string[]; index: Map<string, number>; onOpen: (id: string) => void }) {
  if (!ids?.length) return null;
  const nums = [...new Set(ids)].map((id) => [id, index.get(id)] as const).filter(([, n]) => n !== undefined);
  return (
    <span className="ml-1 inline-flex flex-wrap gap-0.5 align-baseline">
      {nums.map(([id, n]) => (
        <button key={id} onClick={() => onOpen(id)} className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-sunken px-1 text-[10.5px] font-semibold tabular text-ink-2 transition-colors hover:bg-accent hover:text-white" title="Open source record">
          {n}
        </button>
      ))}
    </span>
  );
}

function Section({ kind, items, index, onOpen }: { kind: "facts" | "calculations" | "interpretation"; items: AnswerItem[]; index: Map<string, number>; onOpen: (id: string) => void }) {
  if (!items.length) return null;
  const meta = {
    facts: { label: "From your records", icon: FileText, cls: "", dot: "bg-ink" },
    calculations: { label: "Calculated comparisons", icon: Calculator, cls: "", dot: "bg-accent" },
    interpretation: { label: "AI interpretation", icon: Lightbulb, cls: "rounded-xl bg-accent-soft/60 p-4 ring-1 ring-accent/10", dot: "bg-accent" },
  }[kind];
  const Icon = meta.icon;
  return (
    <div className={meta.cls}>
      <div className={cn("mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em]", kind === "interpretation" ? "text-accent-ink" : "text-ink-3")}>
        <Icon className="size-3.5" /> {meta.label}
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
            <span className={cn("mt-[9px] size-1.5 shrink-0 rounded-full", meta.dot, kind === "calculations" && "rounded-[2px]")} />
            <span>
              {it.text}
              <SourceChips ids={it.sources} index={index} onOpen={onOpen} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnswerView({ answer, onOpen, onFollowUp }: { answer: AiAnswer; onOpen: (id: string) => void; onFollowUp: (q: string) => void }) {
  const index = React.useMemo(() => new Map(answer.sources.map((c, i) => [c.documentId, i + 1])), [answer.sources]);
  return (
    <div className="space-y-6">
      <p className="text-[16px] leading-[1.65] text-ink">{answer.summary}</p>

      {answer.chart && answer.chart.points.length > 1 && (
        <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[13px] font-semibold text-ink">
              {answer.chart.label} <span className="font-normal text-ink-3">· {answer.chart.unit}</span>
            </span>
            <span className="text-[11px] text-ink-3">Shaded: each report’s reference range</span>
          </div>
          <TrendChart points={answer.chart.points} unit={answer.chart.unit} decimals={answer.chart.decimals} height={220} compact onPointClick={(p) => p.documentId && onOpen(p.documentId)} />
        </div>
      )}

      {answer.table && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                {answer.table.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.table.rows.map((r, i) => (
                <tr key={i} onClick={() => r.documentId && onOpen(r.documentId)} className={cn("border-t border-line-2", r.documentId && "cursor-pointer hover:bg-surface-2")}>
                  {r.cells.map((c, j) => (
                    <td key={j} className={cn("px-3 py-2", j === 0 ? "whitespace-nowrap tabular text-ink-2" : "text-ink")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Section kind="facts" items={answer.facts} index={index} onOpen={onOpen} />
      <Section kind="calculations" items={answer.calculations} index={index} onOpen={onOpen} />
      <Section kind="interpretation" items={answer.interpretation} index={index} onOpen={onOpen} />

      {answer.gaps.length > 0 && (
        <div className="rounded-xl border border-dashed border-ink-4/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3">
            <SearchX className="size-3.5" /> Not in your records
          </div>
          <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
            {answer.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {answer.sources.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3">Sources</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {answer.sources.map((c, i) => (
              <button key={c.documentId} onClick={() => onOpen(c.documentId)} className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition-all hover:border-ink-4 hover:shadow-card">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-sunken text-[10.5px] font-semibold tabular text-ink-2 group-hover:bg-accent group-hover:text-white">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {c.title} — {fmtDate(c.date)}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-3">{c.provider}</span>
                </span>
                <ArrowRight className="size-3.5 text-ink-4 group-hover:text-accent" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {answer.action && (
          <Button asChild size="sm" variant="primary">
            <Link href={answer.action.href}>{answer.action.label}</Link>
          </Button>
        )}
        {answer.followUps.map((f) => (
          <button key={f} onClick={() => onFollowUp(f)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-ink-4 hover:text-ink">
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
