"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { SectionLabel } from "@/components/health/bits";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { Badge, Card, PageHeader, Segmented } from "@/components/ui/primitives";
import { displayDrug } from "@/lib/health/describe";
import { fmtDate, getProvider, medicationCourses, todayISO, type MedicationCourse } from "@/lib/health/selectors";
import type { HealthSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "current" | "history";

export default function MedicationsPage() {
  return (
    <React.Suspense>
      <Medications />
    </React.Suspense>
  );
}

function Medications() {
  const s = useSnapshot();
  const params = useSearchParams();
  const [tab, setTab] = React.useState<Tab>(params.get("tab") === "history" ? "history" : "current");
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const courses = medicationCourses(s);
  const active = courses.filter((c) => c.active);

  return (
    <div>
      <PageHeader title="Medications" subtitle="What you take now, and how it has changed over time." />
      <Segmented
        options={[
          { value: "current", label: "Current", count: active.length },
          { value: "history", label: "History", count: courses.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-8"
      />
      {tab === "current" ? <Current s={s} courses={active} open={setDrawer} /> : <History s={s} courses={courses} open={setDrawer} />}
      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function Current({ s, courses, open }: { s: HealthSnapshot; courses: MedicationCourse[]; open: (id: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 animate-fade-in">
      {courses.map((c) => {
        const cur = c.current;
        const prescriber = getProvider(s, c.startedEvent.prescriberId);
        const condition = s.conditions.find((x) => x.id === cur.reasonConditionId);
        const changes = c.events.filter((e) => e.action === "dose_changed");
        return (
          <Card key={c.key} className="flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">{displayDrug(cur.drug)}</h3>
                <div className="text-[12.5px] capitalize text-ink-3">{cur.drugClass}</div>
              </div>
              <Badge tone="ok">Active</Badge>
            </div>
            <div className="mt-5 text-[30px] font-semibold leading-none tracking-[-0.02em] tabular text-ink">{cur.strength}</div>
            <div className="mt-2 text-[14px] text-ink-2">{cur.frequency}</div>
            {cur.instructions && <div className="text-[13.5px] text-ink-3">{cur.instructions}</div>}

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line-2 pt-4 text-[13px]">
              <div>
                <dt className="text-[11.5px] text-ink-3">Started</dt>
                <dd className="mt-0.5 font-medium">{fmtDate(c.firstDate, "month")}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-ink-3">Prescribed by</dt>
                <dd className="mt-0.5 font-medium">{prescriber?.name ?? "—"}</dd>
              </div>
              {condition && (
                <div className="col-span-2">
                  <dt className="text-[11.5px] text-ink-3">Reason</dt>
                  <dd className="mt-0.5 font-medium">{condition.name}</dd>
                </div>
              )}
            </dl>
            {changes.length > 0 && (
              <div className="mt-4 rounded-xl bg-high-soft/70 px-3 py-2 text-[12.5px] text-high">
                <ArrowUpRight className="mr-1 inline size-3.5" />
                Dose changed {fmtDate(changes.at(-1)!.date, "monthShort")}: {c.startedEvent.strength} → {cur.strength}
              </div>
            )}
            <div className="mt-auto pt-5">
              <button onClick={() => open(cur.documentId)} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-accent">
                View prescription <ArrowRight className="size-3.5" />
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const CLASS_COLOR = (cls: string) =>
  cls.includes("thyroid") ? "#3d5ce0" : cls.includes("statin") ? "#0f8a7e" : cls.includes("vitamin") ? "#c68a12" : cls.includes("antibiotic") ? "#b4302b" : "#8a8f98";

function History({ s, courses, open }: { s: HealthSnapshot; courses: MedicationCourse[]; open: (id: string) => void }) {
  const today = todayISO();
  const all = courses.flatMap((c) => c.events);
  const start = all.reduce((m, e) => (e.date < m ? e.date : m), today).slice(0, 4) + "-01-01";
  const end = today;
  const t = (d: string) => new Date(d + "T00:00:00Z").getTime();
  const pct = (d: string) => ((t(d) - t(start)) / (t(end) - t(start))) * 100;
  const years = Array.from({ length: Number(end.slice(0, 4)) - Number(start.slice(0, 4)) + 1 }, (_, i) => String(Number(start.slice(0, 4)) + i));

  // One swimlane per drug; episodes of the same drug share a lane.
  const lanes = new Map<string, MedicationCourse[]>();
  for (const c of [...courses].sort((a, b) => Number(b.longTerm) - Number(a.longTerm) || a.firstDate.localeCompare(b.firstDate))) {
    const k = displayDrug(c.drug);
    lanes.set(k, [...(lanes.get(k) ?? []), c]);
  }
  const longTerm = courses.filter((c) => c.longTerm || (c.startedEvent.durationDays ?? 0) > 30);
  const shortCourses = courses.filter((c) => !longTerm.includes(c)).sort((a, b) => b.firstDate.localeCompare(a.firstDate));

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Gantt */}
      <Card className="overflow-x-auto p-5 sm:p-6">
        <div className="min-w-[720px]">
          <div className="relative ml-[170px] h-6 border-b border-line">
            {years.map((y) => (
              <span key={y} className="absolute -translate-x-1/2 text-[11px] tabular text-ink-3" style={{ left: `${Math.max(2, pct(`${y}-01-01`))}%` }}>
                {y}
              </span>
            ))}
          </div>
          <div className="relative">
            {years.map((y) => (
              <span key={y} className="absolute bottom-0 top-0 w-px bg-line-2" style={{ left: `calc(170px + (100% - 170px) * ${pct(`${y}-01-01`) / 100})` }} />
            ))}
            {[...lanes.entries()].map(([drug, cs]) => (
              <div key={drug} className="relative flex h-10 items-center">
                <div className="w-[170px] shrink-0 truncate pr-3 text-[13px] font-medium text-ink">{drug}</div>
                <div className="relative h-full flex-1">
                  {cs.map((c) => {
                    const segs = c.events.filter((e) => e.action !== "stopped");
                    const endDate = c.active ? end : (c.endDate ?? c.current.date);
                    return segs.map((e, i) => {
                      const segEnd = segs[i + 1]?.date ?? endDate;
                      const left = pct(e.date);
                      const width = Math.max(0.6, pct(segEnd) - left);
                      const color = CLASS_COLOR(c.drugClass);
                      const strengthChanged = i > 0 && segs[i - 1].strength !== e.strength;
                      return (
                        <button
                          key={e.id}
                          onClick={() => open(e.documentId)}
                          title={`${displayDrug(e.drug)} ${e.strength} · ${fmtDate(e.date)}${e.durationDays ? ` · ${e.durationDays} days` : ""}`}
                          className="group absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full transition-transform hover:scale-y-125"
                          style={{ left: `${left}%`, width: `${width}%`, minWidth: 6, background: color, opacity: segs.length > 1 ? 0.55 + (0.45 * (i + 1)) / segs.length : 0.9 }}
                        >
                          {width > 9 && <span className="pointer-events-none absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white">{strengthChanged || i === 0 ? e.strength : ""}</span>}
                        </button>
                      );
                    });
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 ml-[170px] flex flex-wrap gap-4 text-[11.5px] text-ink-3">
            {[
              ["Thyroid", "#3d5ce0"],
              ["Lipid-lowering", "#0f8a7e"],
              ["Vitamins", "#c68a12"],
              ["Antibiotics", "#b4302b"],
              ["Other", "#8a8f98"],
            ].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-full" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Long-term histories */}
      <section>
        <SectionLabel className="mb-3">Dose history</SectionLabel>
        <div className="grid gap-4 lg:grid-cols-2">
          {longTerm.map((c) => (
            <Card key={c.key} className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-[16px] font-semibold text-ink">{displayDrug(c.drug)}</h3>
                  <div className="text-[12px] text-ink-3">
                    {fmtDate(c.firstDate, "monthShort")} – {c.active ? "present" : fmtDate(c.endDate ?? c.current.date, "monthShort")}
                  </div>
                </div>
                <Badge tone={c.active ? "ok" : "neutral"}>{c.active ? "Active" : "Completed"}</Badge>
              </div>
              <ol className="relative space-y-0">
                {c.events.map((e, i) => {
                  const prev = c.events[i - 1];
                  const label =
                    e.action === "started"
                      ? "Started"
                      : e.action === "dose_changed"
                        ? `Dose ${parseFloat(e.strength) > parseFloat(prev?.strength ?? "0") ? "increased" : "decreased"}`
                        : e.action === "continued"
                          ? "Continued"
                          : e.action === "stopped"
                            ? "Stopped"
                            : "Prescribed";
                  return (
                    <li key={e.id} className="relative grid grid-cols-[76px_16px_1fr] gap-x-3 pb-4 last:pb-0">
                      <div className="pt-0.5 text-right text-[12px] font-medium tabular text-ink-2">{fmtDate(e.date, "monthShort")}</div>
                      <div className="relative flex justify-center">
                        {i < c.events.length - 1 && <span className="absolute top-3 h-[calc(100%+4px)] w-px bg-line" />}
                        <span className={cn("relative mt-1.5 size-2.5 rounded-full ring-4 ring-surface", e.action === "dose_changed" ? "bg-high" : e.action === "stopped" ? "bg-danger" : "bg-ink")} />
                      </div>
                      <button onClick={() => open(e.documentId)} className="text-left">
                        <div className="text-[14px] text-ink">
                          {e.action === "dose_changed" ? (
                            <>
                              <span className="font-medium">{label}</span> <span className="text-ink-3">→</span> <span className="font-semibold">{e.strength}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-semibold">{e.action === "stopped" ? "" : e.strength}</span> <span className="text-ink-2">{label.toLowerCase()}</span>
                            </>
                          )}
                        </div>
                        <div className="text-[12px] text-ink-3 hover:text-accent">
                          {getProvider(s, e.prescriberId)?.name} · {e.frequency.toLowerCase()}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ))}
        </div>
      </section>

      {/* Short courses */}
      <section>
        <SectionLabel className="mb-3">Short courses</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-line-2 bg-surface-2 text-left text-[11px] uppercase tracking-[0.07em] text-ink-3">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Medicine</th>
                <th className="hidden px-5 py-2.5 font-medium md:table-cell">Dose</th>
                <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Reason</th>
                <th className="px-5 py-2.5 font-medium">Prescriber</th>
              </tr>
            </thead>
            <tbody>
              {shortCourses.map((c) => (
                <tr key={c.key} onClick={() => open(c.startedEvent.documentId)} className="cursor-pointer border-b border-line-2 last:border-b-0 hover:bg-surface-2">
                  <td className="px-5 py-3 tabular text-ink-2">{fmtDate(c.firstDate)}</td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink">{displayDrug(c.drug)}</span>
                    {c.drugClass.includes("antibiotic") && <Badge tone="danger" className="ml-2">Antibiotic</Badge>}
                    {c.current.action === "stopped" && <Badge tone="outline" className="ml-2">Stopped early</Badge>}
                  </td>
                  <td className="hidden px-5 py-3 text-ink-2 md:table-cell">
                    {c.startedEvent.strength} · {c.startedEvent.frequency.toLowerCase()}
                    {c.startedEvent.durationDays ? ` · ${c.startedEvent.durationDays}d` : ""}
                  </td>
                  <td className="hidden px-5 py-3 text-ink-2 sm:table-cell">{s.conditions.find((x) => x.id === c.startedEvent.reasonConditionId)?.name ?? c.startedEvent.reason ?? "—"}</td>
                  <td className="px-5 py-3 text-ink-2">{getProvider(s, c.startedEvent.prescriberId)?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
