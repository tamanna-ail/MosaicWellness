"use client";

/**
 * Doctor-ready medical summary. Every line carries numbered references to
 * the source documents listed at the end, so a clinician can verify it.
 */
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/primitives";
import { formatValue } from "@/lib/health/biomarkers";
import { displayDrug } from "@/lib/health/describe";
import {
  activeMedications,
  ageFrom,
  allergies,
  biomarkerSeries,
  conditionSummaries,
  DOC_TYPE_LABEL,
  documentFacilityName,
  documentSourceName,
  fmtDate,
  getDocument,
  isUsable,
  medicationCourses,
  sortedDocuments,
  todayISO,
} from "@/lib/health/selectors";
import { cn } from "@/lib/utils";

const RANGE_LABEL: Record<string, string> = { "6m": "Last 6 months", "1y": "Last year", "3y": "Last 3 years", all: "Entire history", custom: "Custom period" };

function rangeBounds(range: string, from?: string | null, to?: string | null) {
  const today = todayISO();
  const back = (months: number) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - months);
    return d.toISOString().slice(0, 10);
  };
  if (range === "6m") return { from: back(6), to: today };
  if (range === "1y") return { from: back(12), to: today };
  if (range === "3y") return { from: back(36), to: today };
  if (range === "custom" && from && to) return { from, to };
  return { from: "0000-01-01", to: today };
}

function H({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-9 flex items-baseline gap-3 border-b border-line pb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
      <span className="tabular text-ink-4">{String(n).padStart(2, "0")}</span>
      {children}
    </h2>
  );
}

function None({ children = "None recorded in this period." }: { children?: React.ReactNode }) {
  return <p className="text-[13.5px] text-ink-3">{children}</p>;
}

export default function SummaryPage() {
  return (
    <React.Suspense>
      <Summary />
    </React.Suspense>
  );
}

function Summary() {
  const s = useSnapshot();
  const params = useSearchParams();
  const range = params.get("range") ?? "all";
  const { from, to } = rangeBounds(range, params.get("from"), params.get("to"));
  const inRange = (d: string) => d >= from && d <= to;

  // Reference registry: first citation gets [1], and so on.
  const refs: string[] = [];
  const ref = (...ids: string[]) => {
    const nums = [...new Set(ids)].map((id) => {
      let i = refs.indexOf(id);
      if (i === -1) i = refs.push(id) - 1;
      return i + 1;
    });
    return <sup className="ml-0.5 text-[10px] font-semibold text-accent tabular">[{nums.join(",")}]</sup>;
  };

  const p = s.patient;
  const docs = sortedDocuments(s, "asc").filter(isUsable);
  const docsInRange = docs.filter((d) => inRange(d.clinicalDate));
  const alg = allergies(s);
  const conds = conditionSummaries(s);
  const active = conds.filter((c) => c.condition.status === "active");
  const previous = conds.filter((c) => c.condition.status === "resolved" && c.lastRecorded && inRange(c.lastRecorded));
  const hosp = docsInRange.filter((d) => d.type === "discharge_summary");
  const procs = docsInRange.filter((d) => d.type === "procedure");
  const meds = activeMedications(s);
  const prevMeds = medicationCourses(s).filter((c) => !c.active && inRange(c.firstDate) && (c.drugClass.includes("antibiotic") || c.longTerm || (c.startedEvent.durationDays ?? 0) > 14));
  const trends = ["TSH", "ANTI_TPO", "LDL", "HDL", "TG", "HBA1C", "VITD", "HB", "CREAT"]
    .map((c) => biomarkerSeries(s, c))
    .filter((x) => x && x.points.filter((p) => inRange(p.date)).length > 0)
    .map((x) => ({ ...x!, pts: x!.points.filter((p) => inRange(p.date)) }));
  const recentLabs = [...docsInRange].reverse().filter((d) => d.type === "lab_report" || d.type === "imaging").slice(0, 6);

  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-ink-3">{RANGE_LABEL[range] ?? "Entire history"}</span>
          {process.env.NEXT_PUBLIC_HOST !== "artifact" && (
            <Button variant="primary" size="sm" onClick={() => window.print()}>
              <Printer /> Print / Save PDF
            </Button>
          )}
        </div>
      </div>

      <article className="rounded-2xl border border-line bg-surface px-6 py-8 shadow-card print:border-0 print:p-0 print:shadow-none sm:px-12 sm:py-12">
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Patient medical summary</div>
            <h1 className="mt-2 font-serif text-[44px] font-semibold leading-none">
              {p.firstName} {p.lastName}
            </h1>
            <div className="mt-2 text-[13px] text-ink-2">
              {RANGE_LABEL[range] ?? "Entire history"}
              {range !== "all" && ` · ${fmtDate(from)} – ${fmtDate(to)}`} · Generated {fmtDate(todayISO(), "long")}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-ink-3">
            <Logo className="size-6" /> healthly
          </div>
        </header>

        <H n={1}>Patient information</H>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13.5px] sm:grid-cols-3">
          {[
            ["Name", `${p.firstName} ${p.lastName}`],
            ["Date of birth", `${fmtDate(p.dateOfBirth)} (${ageFrom(p.dateOfBirth)} y)`],
            ["Sex", p.sex === "male" ? "Male" : p.sex === "female" ? "Female" : "Other"],
            ["Blood group", p.bloodGroup ?? "—"],
            ["Height", p.heightCm ? `${p.heightCm} cm` : "—"],
            ["City", p.city],
            ["Emergency contact", p.emergencyContact ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className={k === "Emergency contact" ? "col-span-2" : ""}>
              <dt className="text-[11.5px] text-ink-3">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <H n={2}>Known allergies</H>
        {alg.length ? (
          alg.map((a) => (
            <p key={a.id} className="text-[14px]">
              <b className="text-danger">{a.substance}</b> — {a.reaction} ({a.severity}), recorded {fmtDate(a.date)}.{ref(a.documentId)}
            </p>
          ))
        ) : (
          <None>No allergies recorded.</None>
        )}

        <H n={3}>Active conditions</H>
        {active.length ? (
          <ul className="space-y-1.5 text-[14px]">
            {active.map((c) => (
              <li key={c.condition.id}>
                <b>{c.condition.name}</b> — first recorded {fmtDate(c.firstRecorded!, "monthShort")}, last reviewed {fmtDate(c.lastRecorded!, "monthShort")}
                {c.medications.length ? `; treated with ${[...new Set(c.medications.map(displayDrug))].join(", ")}` : ""}.{ref(...c.episodes.map((e) => e.documentId))}
              </li>
            ))}
          </ul>
        ) : (
          <None />
        )}

        <H n={4}>Major previous diagnoses</H>
        {previous.length ? (
          <ul className="space-y-1.5 text-[14px]">
            {previous.map((c) => (
              <li key={c.condition.id}>
                <b>{c.condition.name}</b> — {fmtDate(c.firstRecorded!, "monthShort")}
                {c.medications.length ? `; treated with ${c.medications.join(", ")}` : ""}.{ref(...c.episodes.map((e) => e.documentId))}
              </li>
            ))}
          </ul>
        ) : (
          <None />
        )}

        <H n={5}>Hospitalizations</H>
        {hosp.length ? (
          hosp.map((d) => (
            <p key={d.id} className="text-[14px]">
              <b>
                {fmtDate(d.extracted.notes?.admission?.admittedOn ?? d.clinicalDate)} – {fmtDate(d.extracted.notes?.admission?.dischargedOn ?? d.clinicalDate)}
              </b>
              , {documentFacilityName(s, d)}: {d.extracted.notes?.summary}
              {ref(d.id)}
            </p>
          ))
        ) : (
          <None />
        )}

        <H n={6}>Procedures</H>
        {procs.length ? (
          procs.map((d) => (
            <p key={d.id} className="text-[14px]">
              <b>{fmtDate(d.clinicalDate)}</b> — {d.extracted.notes?.procedureName}, {documentFacilityName(s, d)} ({documentSourceName(s, d)}).{ref(d.id)}
            </p>
          ))
        ) : (
          <None />
        )}

        <H n={7}>Current medications</H>
        {meds.length ? (
          <table className="w-full text-[13.5px]">
            <tbody>
              {meds.map((m) => (
                <tr key={m.key} className="border-b border-line-2 last:border-0">
                  <td className="py-2 pr-4 font-semibold">{displayDrug(m.current.drug)}</td>
                  <td className="py-2 pr-4 tabular">{m.current.strength}</td>
                  <td className="py-2 pr-4 text-ink-2">
                    {m.current.frequency}
                    {m.current.instructions ? `, ${m.current.instructions.toLowerCase()}` : ""}
                  </td>
                  <td className="py-2 text-ink-2">
                    since {fmtDate(m.firstDate, "monthShort")}
                    {ref(...m.events.map((e) => e.documentId))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <None>No active medications.</None>
        )}
        {meds.some((m) => m.events.some((e) => e.action === "dose_changed")) && (
          <p className="mt-2 text-[13px] text-ink-2">
            Dose changes:{" "}
            {meds
              .flatMap((m) => m.events.filter((e) => e.action === "dose_changed").map((e) => `${displayDrug(e.drug)} changed to ${e.strength} on ${fmtDate(e.date)}`))
              .join("; ")}
            .
          </p>
        )}

        <H n={8}>Previous significant medications</H>
        {prevMeds.length ? (
          <ul className="grid gap-x-8 gap-y-1 text-[13.5px] sm:grid-cols-2">
            {prevMeds.map((c) => (
              <li key={c.key}>
                {fmtDate(c.firstDate, "monthShort")} — <b>{displayDrug(c.drug)}</b> {c.startedEvent.strength}
                {c.startedEvent.durationDays ? ` × ${c.startedEvent.durationDays}d` : ""}
                {c.current.action === "stopped" ? " (stopped: reaction)" : ""}
                {ref(...c.events.map((e) => e.documentId))}
              </li>
            ))}
          </ul>
        ) : (
          <None />
        )}

        <H n={9}>Important diagnostic trends</H>
        {trends.length ? (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                <th className="pb-2 font-medium">Test</th>
                <th className="pb-2 font-medium">Results (oldest → latest)</th>
                <th className="pb-2 font-medium">Latest vs report range</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => {
                const last = t.pts.at(-1)!;
                return (
                  <tr key={t.def.code} className="border-t border-line-2 align-top">
                    <td className="py-2 pr-3 font-semibold">{t.def.shortName}</td>
                    <td className="py-2 pr-3 tabular text-ink-2">
                      {t.pts.map((p) => `${formatValue(p.canonicalValue!, t.def.decimals)} (${fmtDate(p.date, "monthShort")})`).join(" → ")} {t.def.canonicalUnit}
                      {ref(...t.pts.map((p) => p.documentId))}
                    </td>
                    <td className={cn("whitespace-nowrap py-2", last.flag === "high" ? "font-semibold text-high" : last.flag === "low" ? "font-semibold text-low" : "text-ink-2")}>
                      {last.flag === "high" ? "Above" : last.flag === "low" ? "Below" : "Within"} ({last.refText})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <None />
        )}
        {trends.some((t) => t.pts.some((p) => p.converted)) && <p className="mt-2 text-[12px] text-ink-3">Values reported in other units have been converted for comparison; originals are in the cited reports. Reference ranges are those printed on each report.</p>}

        <H n={10}>Recent investigations</H>
        {recentLabs.length ? (
          <ul className="space-y-1.5 text-[13.5px]">
            {recentLabs.map((d) => (
              <li key={d.id}>
                <b>{fmtDate(d.clinicalDate)}</b> — {d.title}, {documentFacilityName(s, d)}:{" "}
                <span className="text-ink-2">
                  {d.extracted.labs?.map((l) => `${l.name.replace(/\s*\(.*\)/, "")} ${l.value} ${l.unit}`).join(", ") ?? d.extracted.notes?.impression}
                </span>
                {ref(d.id)}
              </li>
            ))}
          </ul>
        ) : (
          <None />
        )}

        <H n={11}>Clinical timeline</H>
        {docsInRange.filter((d) => d.type !== "lab_report" && d.type !== "prescription").length ? (
          <ol className="space-y-1.5 text-[13.5px]">
            {docsInRange
              .filter((d) => d.type !== "lab_report" && d.type !== "prescription")
              .map((d) => (
                <li key={d.id} className="grid grid-cols-[96px_1fr] gap-3">
                  <span className="tabular text-ink-3">{fmtDate(d.clinicalDate)}</span>
                  <span>
                    <b>{d.title}</b> — {documentSourceName(s, d)}. {d.extracted.notes?.summary ?? d.extracted.notes?.impression ?? ""}
                    {ref(d.id)}
                  </span>
                </li>
              ))}
          </ol>
        ) : (
          <None />
        )}

        <h2 className="mb-3 mt-12 border-b border-line pb-2 text-[13px] font-semibold uppercase tracking-[0.08em]">Sources</h2>
        <ol className="grid gap-x-8 gap-y-1 text-[12px] text-ink-2 sm:grid-cols-2">
          {refs.map((id, i) => {
            const d = getDocument(s, id)!;
            return (
              <li key={id} className="flex gap-2">
                <span className="w-6 shrink-0 text-right font-semibold tabular text-accent">[{i + 1}]</span>
                <Link href={`/records/${id}`} className="hover:text-accent hover:underline">
                  {fmtDate(d.clinicalDate)} · {DOC_TYPE_LABEL[d.type]} · {d.title} · {documentFacilityName(s, d)}
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="mt-8 border-t border-line pt-4 text-[11.5px] leading-relaxed text-ink-3">
          Compiled by healthly from {docs.length} patient-held records ({docsInRange.length} in this period). Information is transcribed from source documents and reviewed by the patient; it is not a clinical assessment. Please refer to the cited originals for clinical decisions.
        </p>
      </article>
    </div>
  );
}
