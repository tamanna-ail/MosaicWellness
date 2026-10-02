"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Info, Pill, Sparkles, TriangleAlert } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { ChangeChip, FlagBadge, SectionLabel } from "@/components/health/bits";
import { TrendChart } from "@/components/health/trend-chart";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { BIOMARKER_CONDITIONS, formatValue, getBiomarker } from "@/lib/health/biomarkers";
import { displayDrug } from "@/lib/health/describe";
import { biomarkerSeries, documentFacilityName, fmtDate, getDocument, medicationEvents, monthsBetween } from "@/lib/health/selectors";

export function BiomarkerDetail({ code }: { code: string }) {
  const s = useSnapshot();
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const def = getBiomarker(code);
  const series = def ? biomarkerSeries(s, def.code) : undefined;

  if (!def || !series || (!series.points.length && !series.excluded.length)) {
    return <EmptyState title="No results for this biomarker yet" body="Add a lab report that includes it and it will appear here." action={<Button asChild><Link href="/health">Back to Health Data</Link></Button>} />;
  }
  const { points, latest, previous, changePct, excluded } = series;
  const ranges = [...new Set(points.map((p) => p.refText).filter(Boolean))];
  const treatments = medicationEvents(s).filter((e) => e.reasonConditionId && BIOMARKER_CONDITIONS[def.code]?.includes(e.reasonConditionId) && e.action !== "one_off" && e.action !== "continued");
  const gaps = points.slice(1).map((p, i) => ({ from: points[i].date, to: p.date, months: monthsBetween(points[i].date, p.date) })).filter((g) => g.months > 12);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6">
        <Link href="/health">
          <ArrowLeft /> Health Data
        </Link>
      </Button>

      <div className="mb-8 animate-fade-up">
        <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{def.group}</div>
        <h1 className="mt-1 font-serif text-[44px] leading-none text-ink">{def.shortName}</h1>
        <p className="mt-2 max-w-xl text-[14px] text-ink-2">
          {def.name}. {def.description}
        </p>
      </div>

      {latest && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="text-[12px] text-ink-3">Latest measurement</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[32px] font-semibold tracking-[-0.02em] tabular">{formatValue(latest.canonicalValue!, def.decimals)}</span>
              <span className="text-[14px] text-ink-3">{def.canonicalUnit}</span>
              <FlagBadge flag={latest.flag} className="ml-1" />
            </div>
            <div className="mt-1 text-[12.5px] text-ink-3">{fmtDate(latest.date, "long")}</div>
          </Card>
          <Card className="p-5">
            <div className="text-[12px] text-ink-3">Reference range (latest report)</div>
            <div className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em] tabular">
              {latest.refText ?? "Not printed"} <span className="text-[14px] font-normal text-ink-3">{latest.unit}</span>
            </div>
            <div className="mt-1 text-[12.5px] text-ink-3">{documentFacilityName(s, getDocument(s, latest.documentId)!)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-[12px] text-ink-3">Change from previous</div>
            <div className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em] tabular">
              {previous ? `${latest.canonicalValue! - previous.canonicalValue! >= 0 ? "+" : "−"}${formatValue(Math.abs(latest.canonicalValue! - previous.canonicalValue!), def.decimals)}` : "—"}
              <span className="ml-1 text-[14px] font-normal text-ink-3">{previous ? def.canonicalUnit : ""}</span>
            </div>
            <ChangeChip pct={changePct} className="mt-1" />
          </Card>
        </div>
      )}

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[14px] font-semibold">{def.shortName} over time</div>
          <div className="flex items-center gap-4 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-ok/15 ring-1 ring-ok/20" /> Each report’s reference range
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-high" /> Outside range
            </span>
          </div>
        </div>
        <TrendChart
          points={points.map((p) => ({ date: p.date, value: p.canonicalValue!, refLow: p.converted && p.refLow !== undefined ? (p.refLow * p.canonicalValue!) / p.value : p.refLow, refHigh: p.converted && p.refHigh !== undefined ? (p.refHigh * p.canonicalValue!) / p.value : p.refHigh, flag: p.flag, label: p.documentTitle, provider: documentFacilityName(s, getDocument(s, p.documentId)!), converted: p.converted, documentId: p.documentId }))}
          unit={def.canonicalUnit}
          decimals={def.decimals}
          height={340}
          onPointClick={(p) => p.documentId && setDrawer(p.documentId)}
        />
        {treatments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line-2 pt-4">
            {treatments.map((t) => (
              <button key={t.id} onClick={() => setDrawer(t.documentId)} className="inline-flex items-center gap-1.5 rounded-full bg-low-soft px-2.5 py-1 text-[12px] text-low transition-opacity hover:opacity-80">
                <Pill className="size-3" /> {fmtDate(t.date, "monthShort")} · {displayDrug(t.drug)} {t.strength} {t.action === "started" ? "started" : t.action === "dose_changed" ? "(dose changed)" : t.action}
              </button>
            ))}
          </div>
        )}
      </Card>

      {(ranges.length > 1 || excluded.length > 0 || gaps.length > 0 || points.some((p) => p.converted)) && (
        <div className="mt-4 space-y-2">
          {ranges.length > 1 && (
            <div className="flex gap-3 rounded-xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>Labs printed different reference ranges ({ranges.join("; ")}). Each result is flagged against the range on its own report.</span>
            </div>
          )}
          {points.some((p) => p.converted) && (
            <div className="flex gap-3 rounded-xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                {points.filter((p) => p.converted).length} result was reported in {points.find((p) => p.converted)!.unit} and converted to {def.canonicalUnit} with a standard factor so it can be compared. The original value is kept in the table below.
              </span>
            </div>
          )}
          {excluded.length > 0 && (
            <div className="flex gap-3 rounded-xl bg-high-soft px-4 py-3 text-[13px] text-high ring-1 ring-high/10">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{excluded.length} result uses a unit with no safe conversion ({excluded.map((e) => e.unit).join(", ")}), so it isn’t plotted. It’s listed below.</span>
            </div>
          )}
          {gaps.map((g) => (
            <div key={g.from} className="flex gap-3 rounded-xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ink-3" />
              <span>
                No {def.shortName} results between {fmtDate(g.from, "month")} and {fmtDate(g.to, "month")} ({g.months} months).
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Measurement history</SectionLabel>
          <Link href={`/ask?q=${encodeURIComponent(`How has my ${def.shortName} changed over time?`)}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-ink">
            <Sparkles className="size-3.5" /> Ask about this trend
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-line-2 bg-surface-2 text-left text-[11px] uppercase tracking-[0.07em] text-ink-3">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Result</th>
                <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Reference Range</th>
                <th className="px-5 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {[...points, ...excluded].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
                <tr key={p.id} className="border-b border-line-2 last:border-b-0">
                  <td className="px-5 py-3 tabular text-ink-2">{fmtDate(p.date)}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className={`font-semibold tabular ${p.flag === "high" ? "text-high" : p.flag === "low" ? "text-low" : "text-ink"}`}>{formatValue(p.value, def.decimals)}</span>
                      <span className="text-[12px] text-ink-3">{p.unit}</span>
                      {p.flag !== "normal" && <FlagBadge flag={p.flag} />}
                    </span>
                    {p.converted && <div className="text-[11.5px] text-ink-3">≈ {formatValue(p.canonicalValue!, def.decimals)} {def.canonicalUnit}</div>}
                    {p.edited && <div className="text-[11px] text-accent">Corrected by you</div>}
                  </td>
                  <td className="hidden px-5 py-3 tabular text-ink-3 sm:table-cell">{p.refText ?? "—"}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setDrawer(p.documentId)} className="text-left font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">
                      {p.documentTitle}
                    </button>
                    <div className="text-[12px] text-ink-3">{documentFacilityName(s, getDocument(s, p.documentId)!)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
