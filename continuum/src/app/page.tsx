"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { GlobalSearch } from "@/components/search/global-search";
import { SummaryDialog } from "@/components/summary/summary-dialog";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { Card, CardHeader } from "@/components/ui/primitives";
import { ChangeChip, DocTypeIcon, Sparkline } from "@/components/health/bits";
import { formatValue } from "@/lib/health/biomarkers";
import { displayDrug, documentHighlights, documentSubtitle } from "@/lib/health/describe";
import { activeMedications, allergies, biomarkerSeries, conditionSummaries, DOC_TYPE_LABEL, fmtDate, sortedDocuments } from "@/lib/health/selectors";
import { cn } from "@/lib/utils";

function useGreeting() {
  const [g, setG] = React.useState("Good morning");
  React.useEffect(() => {
    const h = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depends on the viewer's clock, unknown at prerender
    setG(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return g;
}

const TREND_CODES = ["TSH", "HBA1C", "LDL", "VITD"];

export default function HomePage() {
  const s = useSnapshot();
  const greeting = useGreeting();
  const [drawer, setDrawer] = React.useState<string | null>(null);

  const meds = activeMedications(s);
  const conds = conditionSummaries(s).filter((c) => c.condition.status === "active");
  const alg = allergies(s);
  const docs = sortedDocuments(s).filter((d) => d.status !== "failed");
  const recent = docs.slice(0, 6);
  const review = s.documents.filter((d) => d.status === "needs_review");

  const stats = [
    { label: "Active Medications", value: meds.length, href: "/medications" },
    { label: "Known Conditions", value: conds.length, href: "/health?tab=conditions" },
    { label: "Allergies", value: alg.length, href: "/health?tab=conditions" },
    { label: "Records", value: s.documents.length, href: "/records" },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-fade-up">
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-ink sm:text-[48px]">
            {greeting}, {s.patient.firstName}
          </h1>
          <p className="mt-2 text-[15px] text-ink-2">Here’s your health history at a glance.</p>
        </div>
        <SummaryDialog />
      </header>

      <section className="animate-fade-up [animation-delay:60ms]">
        <GlobalSearch />
      </section>

      {/* Health snapshot — present, not dominant */}
      <section className="animate-fade-up [animation-delay:100ms]">
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-card sm:grid-cols-4">
          {stats.map((st, i) => (
            <Link key={st.label} href={st.href} className={cn("group px-5 py-4 transition-colors hover:bg-surface-2", i % 2 === 1 && "border-l border-line-2", i >= 2 && "border-t border-line-2 sm:border-t-0", i === 2 && "sm:border-l")}>
              <div className="text-[12px] text-ink-3">{st.label}</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-[26px] font-semibold tracking-[-0.02em] tabular text-ink">{st.value}</span>
                <ChevronRight className="size-4 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          ))}
        </div>
        {review.length > 0 && (
          <Link href="/records?status=review" className="mt-3 flex items-center gap-2 rounded-xl bg-high-soft px-4 py-2.5 text-[13px] text-high ring-1 ring-high/10">
            <AlertCircle className="size-4" />
            {review.length} uploaded {review.length === 1 ? "record needs" : "records need"} a quick review before {review.length === 1 ? "it’s" : "they’re"} added to your history.
            <ArrowRight className="ml-auto size-4" />
          </Link>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Recent activity */}
        <Card className="animate-fade-up [animation-delay:140ms]">
          <CardHeader
            title="Recent health activity"
            action={
              <Link href="/timeline" className="text-[13px] font-medium text-ink-3 hover:text-ink">
                Timeline →
              </Link>
            }
          />
          <ul className="px-2 pb-2">
            {recent.map((d) => {
              const hl = documentHighlights(s, d, 1)[0];
              return (
                <li key={d.id}>
                  <button onClick={() => setDrawer(d.id)} className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-2">
                    <div className="w-[52px] shrink-0 text-right">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{fmtDate(d.clinicalDate, "dayMonth").split(" ")[0]}</div>
                      <div className="text-[17px] font-semibold leading-tight tabular text-ink">{d.clinicalDate.slice(8, 10)}</div>
                    </div>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink-2">
                      <DocTypeIcon type={d.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">{d.type === "prescription" ? "Prescription" : d.title}</div>
                      <div className="truncate text-[12.5px] text-ink-3">{documentSubtitle(s, d) || DOC_TYPE_LABEL[d.type]}</div>
                    </div>
                    {hl && (
                      <div className={cn("hidden shrink-0 text-right text-[13px] tabular sm:block", hl.flag === "high" ? "text-high" : hl.flag === "low" ? "text-low" : "text-ink-2")}>{hl.text.length > 34 ? hl.text.slice(0, 32) + "…" : hl.text}</div>
                    )}
                    {d.status === "needs_review" && <span className="size-2 rounded-full bg-high" title="Needs review" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          {/* Current medications */}
          <Card className="animate-fade-up [animation-delay:180ms]">
            <CardHeader
              title="Current medications"
              action={
                <Link href="/medications" className="text-[13px] font-medium text-ink-3 hover:text-ink">
                  All →
                </Link>
              }
            />
            <ul className="px-5 pb-4">
              {meds.map((m) => (
                <li key={m.key} className="flex items-baseline justify-between gap-3 border-t border-line-2 py-3 first:border-t-0 first:pt-1">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-ink">{displayDrug(m.current.drug)}</div>
                    <div className="text-[12.5px] text-ink-3">{m.current.frequency}</div>
                  </div>
                  <div className="shrink-0 text-[13px] font-medium tabular text-ink-2">{m.current.strength}</div>
                </li>
              ))}
              {!meds.length && <li className="py-3 text-[13px] text-ink-3">No active medications in your records.</li>}
            </ul>
          </Card>

          <Link href="/ask" className="group flex items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-accent-soft to-surface p-5 shadow-card transition-shadow hover:shadow-pop animate-fade-up [animation-delay:220ms]">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-on-accent">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">Ask your health history</div>
              <div className="text-[13px] text-ink-2">“When did my TSH first become abnormal?”</div>
            </div>
            <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Health trends */}
      <section className="animate-fade-up [animation-delay:240ms]">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Health trends</h2>
          <Link href="/health" className="text-[13px] font-medium text-ink-3 hover:text-ink">
            All biomarkers →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TREND_CODES.map((code) => {
            const ser = biomarkerSeries(s, code);
            if (!ser?.latest) return null;
            const { def, latest, previous } = ser;
            return (
              <Link key={code} href={`/health/${code.toLowerCase()}`} className="group rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink-2">{def.shortName}</span>
                  {latest.flag !== "normal" && latest.flag !== "unknown" && <span className={cn("size-1.5 rounded-full", latest.flag === "high" ? "bg-high" : "bg-low")} title={latest.flag} />}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[24px] font-semibold tracking-[-0.02em] tabular text-ink">{formatValue(latest.canonicalValue!, def.decimals)}</span>
                  <span className="text-[12px] text-ink-3">{def.canonicalUnit}</span>
                </div>
                <ChangeChip pct={ser.changePct} from={previous?.canonicalValue ?? undefined} decimals={def.decimals} />
                <Sparkline values={ser.points.map((p) => p.canonicalValue!)} flags={ser.points.map((p) => p.flag)} className="mt-3 h-10 w-full" />
                <div className="mt-2 text-[11.5px] text-ink-3">{fmtDate(latest.date)}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
