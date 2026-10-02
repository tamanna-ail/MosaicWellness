"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, CalendarDays, ChevronRight, FileText, Heart, Pill, Plus, TriangleAlert } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSnapshot } from "@/components/providers/health-store";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { SummaryDialog } from "@/components/summary/summary-dialog";
import { Card } from "@/components/ui/primitives";
import { DocTile, IconTile, medTone } from "@/components/ui/icon-tile";
import { formatValue, getBiomarker } from "@/lib/health/biomarkers";
import { displayDrug, documentHighlights, documentSubtitle } from "@/lib/health/describe";
import { activeMedications, allergies, biomarkerSeries, conditionSummaries, fmtDate, getProvider, sortedDocuments, TIMELINE_CATEGORY, todayISO, upcomingAppointments } from "@/lib/health/selectors";
import type { HealthSnapshot, MedicalDocument } from "@/lib/types";
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

/** Misty hills and a low sun: calm, and a quiet nod to the long view of a health history. */
function Horizon() {
  const id = React.useId();
  return (
    <svg viewBox="0 0 640 200" preserveAspectRatio="xMidYMax meet" className="h-full w-full" aria-hidden>
      <defs>
        {[1, 2, 3].map((n) => (
          <linearGradient key={n} id={`${id}-h${n}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: `var(--hill-${n})` }} stopOpacity="1" />
            <stop offset="1" style={{ stopColor: "var(--bg)" }} stopOpacity="1" />
          </linearGradient>
        ))}
        <linearGradient id={`${id}-fade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.85" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-m`}>
          <rect width="640" height="200" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-m)`}>
        <circle cx="330" cy="62" r="28" style={{ fill: "var(--sun)" }} />
        <path d="M0 120 C70 95 120 70 190 82 C250 92 280 60 340 66 C410 74 450 104 520 92 C570 84 610 96 640 104 V200 H0Z" fill={`url(#${id}-h1)`} />
        <path d="M0 146 C60 128 110 112 170 120 C240 130 270 104 330 108 C400 113 430 138 500 130 C560 124 600 134 640 140 V200 H0Z" fill={`url(#${id}-h2)`} />
        <path d="M0 172 C80 158 140 148 220 156 C300 164 340 146 410 150 C480 154 540 168 640 164 V200 H0Z" fill={`url(#${id}-h3)`} />
      </g>
    </svg>
  );
}

function KeyInfo({ s }: { s: HealthSnapshot }) {
  const stats = [
    { tone: "green" as const, icon: <Pill />, value: activeMedications(s).length, label: "Active medications", href: "/medications" },
    { tone: "red" as const, icon: <Heart />, value: conditionSummaries(s).filter((c) => c.condition.status === "active").length, label: "Known conditions", href: "/health?tab=conditions" },
    { tone: "amber" as const, icon: <TriangleAlert />, value: allergies(s).length, label: allergies(s).length === 1 ? "Allergy" : "Allergies", href: "/health?tab=conditions" },
    { tone: "blue" as const, icon: <FileText />, value: s.documents.length, label: "Total records", href: "/records" },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="text-[17px] font-medium text-ink">Your key health information</h2>
        <Link href="/health" className="rounded-lg p-1 text-ink-3 hover:text-ink" aria-label="Open health data">
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-y-5 px-6 pb-6 pt-5 sm:grid-cols-4">
        {stats.map((st, i) => (
          <Link key={st.label} href={st.href} className={cn("group flex items-start gap-3.5 px-1 sm:px-4", i > 0 && "sm:border-l sm:border-line-2", i === 0 && "sm:pl-0")}>
            <IconTile tone={st.tone} size="lg">
              {st.icon}
            </IconTile>
            <span className="min-w-0">
              <span className="block font-serif text-[30px] font-semibold leading-none tabular text-ink">{st.value}</span>
              <span className="mt-1.5 block text-[13.5px] leading-snug text-ink-3 group-hover:text-ink-2">{st.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

const DOT: Record<string, string> = {
  diagnostic: "bg-ink-4",
  consultation: "bg-t-green",
  medication: "bg-t-red",
  hospitalization: "bg-t-violet",
  procedure: "bg-t-amber",
};

function activityTitle(d: MedicalDocument) {
  return d.type === "prescription" ? "Prescription" : d.type === "discharge_summary" ? "Hospitalization" : d.title;
}

function RecentActivity({ s, open }: { s: HealthSnapshot; open: (id: string) => void }) {
  // One lab report per day keeps a multi-panel blood draw from crowding out everything else.
  const seen = new Set<string>();
  const rows = sortedDocuments(s)
    .filter((d) => d.status !== "failed")
    .filter((d) => {
      if (d.type !== "lab_report") return true;
      const k = d.clinicalDate;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);

  return (
    <Card>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="text-[17px] font-medium text-ink">Recent activity</h2>
        <Link href="/timeline" className="inline-flex items-center gap-1.5 text-[14px] text-ink-2 hover:text-ink">
          View all <ArrowRight className="size-4" />
        </Link>
      </div>
      <ol className="px-6 pt-3">
        {rows.map((d, i) => {
          const lab = d.type === "lab_report" ? documentHighlights(s, d, 1)[0] : undefined;
          const sub = d.type === "prescription" ? (d.extracted.medications ?? []).filter((m) => m.action !== "stopped").map((m) => `${displayDrug(m.drug)} ${m.strength}`).join(", ") : documentSubtitle(s, d);
          return (
            <li key={d.id} className="grid grid-cols-[50px_16px_1fr] items-stretch sm:grid-cols-[104px_24px_1fr]">
              <div className="pt-[22px] text-[13px] tabular text-ink-3 sm:text-[13.5px]">
                <span className="sm:hidden">{fmtDate(d.clinicalDate).slice(0, 6)}</span>
                <span className="hidden sm:inline">{fmtDate(d.clinicalDate)}</span>
              </div>
              <div className="relative flex justify-center">
                <span className={cn("absolute w-px bg-line", i === 0 ? "top-7" : "top-0", i === rows.length - 1 ? "h-7" : "bottom-0")} />
                <span className={cn("relative mt-[26px] size-2 rounded-full ring-4 ring-surface", DOT[TIMELINE_CATEGORY[d.type]])} />
              </div>
              <button onClick={() => open(d.id)} className={cn("group ml-2 flex min-w-0 items-center gap-3 py-3.5 text-left sm:ml-4 sm:gap-4", i < rows.length - 1 && "border-b border-line-2")}>
                <DocTile type={d.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{activityTitle(d)}</span>
                  <span className="block truncate text-[13.5px] text-ink-3">{sub}</span>
                </span>
                {lab && (
                  <span className={cn("hidden shrink-0 rounded-lg bg-sunken px-3 py-1.5 text-[13px] tabular sm:block", lab.flag === "high" ? "text-high" : lab.flag === "low" ? "text-low" : "text-ink-2")}>
                    {lab.text}
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="px-6 pb-6 pt-3">
        <Link href="/records?upload=1" className="group flex items-center gap-4 rounded-2xl bg-sunken/80 px-4 py-3.5 transition-colors hover:bg-sunken">
          <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-ink-2 shadow-card">
            <Plus className="size-4" />
          </span>
          <span className="flex-1 text-[14.5px] font-medium text-ink">Add more records</span>
          <span className="hidden text-[13px] text-ink-3 sm:block">PDF, JPG, PNG supported</span>
          <ChevronRight className="size-4 text-ink-3" />
        </Link>
      </div>
    </Card>
  );
}

const RANGES = [
  { v: "6m", label: "6M", months: 6 },
  { v: "1y", label: "1Y", months: 12 },
  { v: "3y", label: "3Y", months: 36 },
  { v: "all", label: "All", months: 0 },
] as const;
const MARKERS = ["TSH", "LDL", "HBA1C", "VITD"];

function monthsAgo(n: number) {
  const d = new Date(todayISO() + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

function HealthTrends({ s }: { s: HealthSnapshot }) {
  const [range, setRange] = React.useState<(typeof RANGES)[number]["v"]>("all");
  const [code, setCode] = React.useState("TSH");
  const id = React.useId();
  const ser = biomarkerSeries(s, code);
  const def = getBiomarker(code)!;
  const r = RANGES.find((x) => x.v === range)!;
  const pts = (ser?.points ?? []).filter((p) => !r.months || p.date >= monthsAgo(r.months));
  const data = pts.map((p) => ({ t: new Date(p.date + "T00:00:00Z").getTime(), value: p.canonicalValue!, date: p.date, flag: p.flag }));
  const latest = ser?.latest;
  const years = [...new Set(pts.map((p) => p.date.slice(0, 4)))];

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-6 pt-6">
        <h2 className="text-[17px] font-medium text-ink">Health trends</h2>
        <div className="flex items-center gap-0.5">
          {RANGES.map((x) => (
            <button key={x.v} onClick={() => setRange(x.v)} className={cn("h-8 min-w-9 rounded-lg px-2 text-[12.5px] font-medium transition-colors", range === x.v ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink")}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {MARKERS.map((c) => (
            <button key={c} onClick={() => setCode(c)} className={cn("rounded-full px-2.5 py-0.5 text-[12.5px] transition-colors", c === code ? "bg-ink text-on-ink" : "text-ink-2 ring-1 ring-line hover:text-ink")}>
              {getBiomarker(c)!.shortName}
            </button>
          ))}
        </div>
        {latest && (
          <Link href={`/health/${code.toLowerCase()}`} className="group mt-4 block">
            <span className="flex items-baseline gap-2">
              <span className="font-serif text-[42px] font-semibold leading-none tabular text-ink">{formatValue(latest.canonicalValue!, def.decimals)}</span>
              <span className="text-[15px] text-ink-2">{def.canonicalUnit}</span>
              {latest.flag !== "normal" && latest.flag !== "unknown" && <span className="ml-1 rounded-md bg-high-soft px-1.5 py-0.5 text-[11.5px] font-medium text-high">{latest.flag === "high" ? "Above range" : "Below range"}</span>}
            </span>
            {ser?.changePct !== undefined && (
              <span className="mt-2 flex items-center gap-1.5 text-[13.5px]">
                <span className="inline-flex items-center gap-0.5 font-medium text-accent">
                  {ser.changePct < 0 ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                  {Math.abs(ser.changePct).toFixed(1)}%
                </span>
                <span className="text-ink-3">from previous · {fmtDate(latest.date)}</span>
              </span>
            )}
          </Link>
        )}
      </div>
      <div className="h-[190px] px-3 pb-4 pt-3">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" style={{ stopColor: "var(--accent)" }} stopOpacity={0.22} />
                  <stop offset="1" style={{ stopColor: "var(--accent)" }} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line-2)" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={years.length > 1 ? years.map((y) => new Date(`${y}-01-01T00:00:00Z`).getTime()).filter((t) => t >= data[0].t) : data.map((d) => d.t)}
                tickFormatter={(t) => (years.length > 1 ? String(new Date(t).getUTCFullYear()) : fmtDate(new Date(t).toISOString(), "monthShort"))}
                tick={{ fill: "var(--ink-3)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tick={{ fill: "var(--ink-3)", fontSize: 12 }} tickLine={false} axisLine={false} width={40} domain={[0, "auto"]} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: "var(--ink-4)", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload;
                  if (!p) return null;
                  return (
                    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-pop">
                      <div className="text-ink-3">{fmtDate(p.date, "long")}</div>
                      <div className="font-semibold tabular text-ink">
                        {formatValue(p.value, def.decimals)} {def.canonicalUnit}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                fill={`url(#${id}-g)`}
                dot={(props) => {
                  const { cx, cy, index, payload } = props as { cx: number; cy: number; index: number; payload: { flag: string } };
                  return <circle key={index} cx={cx} cy={cy} r={3.5} fill={payload.flag === "high" || payload.flag === "low" ? "var(--high)" : "var(--accent)"} stroke="var(--surface)" strokeWidth={1.5} />;
                }}
                activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-3">{data.length ? "Only one result in this period." : "No results in this period."}</div>
        )}
      </div>
    </Card>
  );
}

function CurrentMeds({ s }: { s: HealthSnapshot }) {
  const meds = activeMedications(s);
  return (
    <Card>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="text-[17px] font-medium text-ink">Current medications</h2>
        <Link href="/medications" className="inline-flex items-center gap-1.5 text-[14px] text-ink-2 hover:text-ink">
          View all <ArrowRight className="size-4" />
        </Link>
      </div>
      <ul className="px-6 pb-4 pt-2">
        {meds.map((m, i) => (
          <li key={m.key}>
            <Link href="/medications" className={cn("group flex items-center gap-4 py-3.5", i < meds.length - 1 && "border-b border-line-2")}>
              <IconTile tone={medTone(m.current.drugClass)}>
                <Pill strokeWidth={1.75} />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{displayDrug(m.current.drug)}</span>
                <span className="block truncate text-[13.5px] text-ink-3">{[m.current.strength, m.current.frequency, m.current.instructions?.split(",")[0]].filter(Boolean).join(" · ")}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
        {!meds.length && <li className="py-3 text-[13.5px] text-ink-3">No active medications in your records.</li>}
      </ul>
    </Card>
  );
}

function Upcoming({ s, open }: { s: HealthSnapshot; open: (id: string) => void }) {
  const items = upcomingAppointments(s).slice(0, 2);
  return (
    <Card>
      <div className="flex items-center justify-between px-6 pt-6">
        <h2 className="text-[17px] font-medium text-ink">Upcoming</h2>
        <Link href="/timeline" className="inline-flex items-center gap-1.5 text-[14px] text-ink-2 hover:text-ink">
          View all <ArrowRight className="size-4" />
        </Link>
      </div>
      <ul className="px-6 pb-4 pt-2">
        {items.map((a, i) => (
          <li key={a.id}>
            <button onClick={() => a.sourceDocumentId && open(a.sourceDocumentId)} className={cn("group flex w-full items-center gap-4 py-3.5 text-left", i < items.length - 1 && "border-b border-line-2")}>
              <IconTile tone="green">
                <CalendarDays strokeWidth={1.75} />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] tabular text-ink-3">{fmtDate(a.date)}</span>
                <span className="block truncate text-[15px] font-medium text-ink">{a.title}</span>
                <span className="block truncate text-[13.5px] text-ink-3">{getProvider(s, a.clinicianId)?.name ?? getProvider(s, a.providerId)?.name}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
        {!items.length && <li className="py-3 text-[13.5px] text-ink-3">Nothing scheduled. Follow-ups mentioned in your notes will appear here.</li>}
      </ul>
    </Card>
  );
}

export default function HomePage() {
  const s = useSnapshot();
  const greeting = useGreeting();
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const review = s.documents.filter((d) => d.status === "needs_review");

  return (
    <div className="space-y-6">
      <header className="relative -mt-2 grid min-h-[176px] items-end gap-6 pb-2 md:grid-cols-[1fr_auto]">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] md:block">
          <Horizon />
        </div>
        <div className="relative animate-fade-up">
          <div className="text-[12px] font-medium uppercase tracking-[0.42em] text-ink-3">{greeting}</div>
          <h1 className="mt-3 font-serif text-[56px] font-semibold leading-[0.95] tracking-[-0.01em] text-ink sm:text-[68px]">{s.patient.firstName},</h1>
          <p className="mt-3 text-[17px] text-ink-2">Your health history, organized and at your fingertips.</p>
          <SummaryDialog
            trigger={
              <button className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:text-accent-ink">
                Create a summary for your doctor <ArrowRight className="size-3.5" />
              </button>
            }
          />
        </div>
        <blockquote className="relative hidden max-w-[190px] self-center pb-6 font-serif text-[21px] italic leading-snug text-ink-2 md:block">
          “A clearer view of your health journey.”
          <span className="mt-4 block h-px w-8 bg-ink-4" />
        </blockquote>
      </header>

      {review.length > 0 && (
        <Link href="/records?status=review" className="flex items-center gap-2 rounded-2xl bg-high-soft px-5 py-3 text-[13.5px] text-high">
          <AlertCircle className="size-4" />
          {review.length} uploaded {review.length === 1 ? "record needs" : "records need"} a quick review before {review.length === 1 ? "it’s" : "they’re"} added to your history.
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <KeyInfo s={s} />
          <RecentActivity s={s} open={setDrawer} />
        </div>
        <div className="min-w-0 space-y-6">
          <HealthTrends s={s} />
          <CurrentMeds s={s} />
          <Upcoming s={s} open={setDrawer} />
        </div>
      </div>

      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
