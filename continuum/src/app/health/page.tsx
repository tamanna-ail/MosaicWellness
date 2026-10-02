"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertOctagon, Search } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { ChangeChip, SectionLabel, Sparkline } from "@/components/health/bits";
import { TrendChart } from "@/components/health/trend-chart";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { Badge, Card, Input, PageHeader, Segmented } from "@/components/ui/primitives";
import { formatValue } from "@/lib/health/biomarkers";
import { displayDrug } from "@/lib/health/describe";
import { allBiomarkerSeries, allergies, conditionSummaries, fmtDate, getDocument, vitalSeries } from "@/lib/health/selectors";
import { cn } from "@/lib/utils";

type Tab = "biomarkers" | "conditions" | "vitals";

export default function HealthPage() {
  return (
    <React.Suspense>
      <Health />
    </React.Suspense>
  );
}

function Health() {
  const params = useSearchParams();
  const [tab, setTab] = React.useState<Tab>((params.get("tab") as Tab) || "biomarkers");
  return (
    <div>
      <PageHeader title="Health Data" subtitle="See how your health has changed over time." />
      <Segmented
        options={[
          { value: "biomarkers", label: "Biomarkers" },
          { value: "conditions", label: "Conditions" },
          { value: "vitals", label: "Vitals" },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-8"
      />
      {tab === "biomarkers" && <Biomarkers />}
      {tab === "conditions" && <Conditions />}
      {tab === "vitals" && <Vitals />}
    </div>
  );
}

function Biomarkers() {
  const s = useSnapshot();
  const [q, setQ] = React.useState("");
  const all = allBiomarkerSeries(s);
  const list = all.filter((x) => !q || x.def.shortName.toLowerCase().includes(q.toLowerCase()) || x.def.name.toLowerCase().includes(q.toLowerCase()) || x.def.group.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="animate-fade-in">
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search biomarkers..." className="pl-9" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ def, latest, previous, changePct, points }) => (
          <Link key={def.code} href={`/health/${def.code.toLowerCase()}`} className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-ink">{def.shortName}</div>
                <div className="text-[11.5px] text-ink-3">{def.group}</div>
              </div>
              {latest && latest.flag !== "normal" && latest.flag !== "unknown" && <Badge tone={latest.flag === "high" ? "high" : "low"}>{latest.flag === "high" ? "High" : "Low"}</Badge>}
            </div>
            {latest && (
              <>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[28px] font-semibold tracking-[-0.02em] tabular text-ink">{formatValue(latest.canonicalValue!, def.decimals)}</span>
                  <span className="text-[13px] text-ink-3">{def.canonicalUnit}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-ink-3">{fmtDate(latest.date)}</div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <ChangeChip pct={changePct} decimals={def.decimals} />
                  <Sparkline values={points.map((p) => p.canonicalValue!)} flags={points.map((p) => p.flag)} className="h-9 w-28" />
                </div>
                {previous === undefined && <span className="sr-only">Single result</span>}
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Conditions() {
  const s = useSnapshot();
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const conds = conditionSummaries(s).filter((c) => c.condition.id !== "drug_rash");
  const active = conds.filter((c) => c.condition.status === "active");
  const past = conds.filter((c) => c.condition.status === "resolved");
  const alg = allergies(s);

  const item = (c: (typeof conds)[number]) => (
    <Card key={c.condition.id} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{c.condition.name}</h3>
        <Badge tone={c.condition.status === "active" ? "accent" : "neutral"}>{c.condition.status === "active" ? "Active" : "Resolved"}</Badge>
      </div>
      {c.condition.description && <p className="mt-1 text-[13px] text-ink-3">{c.condition.description}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-[11.5px] text-ink-3">First recorded</dt>
          <dd className="mt-0.5 font-medium text-ink">{c.firstRecorded ? fmtDate(c.firstRecorded, "month") : "—"}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-ink-3">Last recorded</dt>
          <dd className="mt-0.5 font-medium text-ink">{c.lastRecorded ? fmtDate(c.lastRecorded, "month") : "—"}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-ink-3">Associated records</dt>
          <dd className="mt-0.5 font-medium tabular text-ink">{c.documentIds.length}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-ink-3">Associated medications</dt>
          <dd className="mt-0.5 font-medium text-ink">{c.medications.length ? [...new Set(c.medications.map(displayDrug))].join(", ") : "—"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line-2 pt-3">
        {c.documentIds
          .map((id) => getDocument(s, id)!)
          .sort((a, b) => a.clinicalDate.localeCompare(b.clinicalDate))
          .map((d) => (
            <button key={d.id} onClick={() => setDrawer(d.id)} className="rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-2 transition-colors hover:border-ink-4 hover:text-ink">
              {fmtDate(d.clinicalDate, "monthShort")} · {d.type === "prescription" ? "Prescription" : d.title}
            </button>
          ))}
      </div>
    </Card>
  );

  return (
    <div className="space-y-10 animate-fade-in">
      {alg.length > 0 && (
        <section>
          <SectionLabel className="mb-3">Allergies</SectionLabel>
          {alg.map((a) => (
            <button key={a.id} onClick={() => setDrawer(a.documentId)} className="flex w-full items-center gap-4 rounded-2xl border border-danger/15 bg-danger-soft/50 px-5 py-4 text-left transition-colors hover:bg-danger-soft">
              <AlertOctagon className="size-5 text-danger" />
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-danger">{a.substance}</div>
                <div className="text-[13px] text-ink-2">
                  {a.reaction} · {a.severity} · recorded {fmtDate(a.date, "long")}
                </div>
              </div>
            </button>
          ))}
        </section>
      )}
      <section>
        <SectionLabel className="mb-3">Active conditions</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">{active.map(item)}</div>
      </section>
      <section>
        <SectionLabel className="mb-3">Past conditions</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">{past.map(item)}</div>
      </section>
      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function Vitals() {
  const s = useSnapshot();
  const weight = vitalSeries(s, "weight");
  const bp = vitalSeries(s, "bp");
  const hr = vitalSeries(s, "heart_rate");
  const bmi = weight.map((w) => ({ ...w, value: +(w.value / (s.patient.heightCm! / 100) ** 2).toFixed(1) }));

  const blocks = [
    { title: "Weight", unit: "kg", decimals: 1, pts: weight.map((p) => ({ date: p.date, value: p.value, flag: "unknown" as const, documentId: p.documentId, label: getDocument(s, p.documentId)?.title })) },
    { title: "Systolic blood pressure", unit: "mmHg", decimals: 0, pts: bp.map((p) => ({ date: p.date, value: p.value, flag: (p.value >= 130 ? "high" : "normal") as "high" | "normal", refLow: 90, refHigh: 129, documentId: p.documentId, label: `${p.value}/${p.value2} mmHg · ${getDocument(s, p.documentId)?.title}` })) },
    { title: "Resting pulse", unit: "bpm", decimals: 0, pts: hr.map((p) => ({ date: p.date, value: p.value, flag: "unknown" as const, documentId: p.documentId, label: getDocument(s, p.documentId)?.title })) },
    { title: "BMI (from weight & height)", unit: "kg/m²", decimals: 1, pts: bmi.map((p) => ({ date: p.date, value: p.value, flag: "unknown" as const, documentId: p.documentId, label: "Calculated" })) },
  ];

  return (
    <div className="animate-fade-in">
      <p className="mb-5 max-w-2xl text-[13.5px] text-ink-2">Vitals are taken from measurements recorded during your consultations. Readings taken while unwell (for example during the 2024 pneumonia) are included as recorded.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map((b) => {
          const last = b.pts.at(-1);
          return (
            <Card key={b.title} className="p-5">
              <div className="flex items-baseline justify-between">
                <div className="text-[14px] font-semibold text-ink">{b.title}</div>
                {last && (
                  <div className="text-right">
                    <span className={cn("text-[20px] font-semibold tabular")}>{b.title.startsWith("Systolic") ? bp.at(-1) && `${bp.at(-1)!.value}/${bp.at(-1)!.value2}` : formatValue(last.value, b.decimals)}</span> <span className="text-[12px] text-ink-3">{b.unit}</span>
                    <div className="text-[11.5px] text-ink-3">{fmtDate(last.date)}</div>
                  </div>
                )}
              </div>
              <div className="mt-2">{b.pts.length > 1 ? <TrendChart points={b.pts} unit={b.unit} decimals={b.decimals} height={200} compact /> : <div className="py-10 text-center text-sm text-ink-3">Not enough readings yet.</div>}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
