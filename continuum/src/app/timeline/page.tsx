"use client";

import * as React from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { DocTile } from "@/components/ui/icon-tile";
import { PageHeader, Segmented } from "@/components/ui/primitives";
import { formatValue, getBiomarker } from "@/lib/health/biomarkers";
import { displayDrug } from "@/lib/health/describe";
import { documentSourceName, flagFor, fmtDate, getProvider, sortedDocuments, TIMELINE_CATEGORY, TIMELINE_LABEL, type TimelineCategory } from "@/lib/health/selectors";
import type { MedicalDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | TimelineCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "consultation", label: "Consultations" },
  { value: "diagnostic", label: "Diagnostics" },
  { value: "medication", label: "Medications" },
  { value: "hospitalization", label: "Hospitalizations" },
  { value: "procedure", label: "Procedures" },
];

const CATEGORY_STYLE: Record<TimelineCategory, { dot: string; text: string }> = {
  consultation: { dot: "bg-[var(--cat-consult)]", text: "text-[var(--cat-consult)]" },
  diagnostic: { dot: "bg-[var(--cat-diagnostic)]", text: "text-[var(--cat-diagnostic)]" },
  medication: { dot: "bg-[var(--cat-medication)]", text: "text-[var(--cat-medication)]" },
  hospitalization: { dot: "bg-[var(--cat-hospital)]", text: "text-[var(--cat-hospital)]" },
  procedure: { dot: "bg-[var(--cat-procedure)]", text: "text-[var(--cat-procedure)]" },
};

const VIEW_LABEL: Record<TimelineCategory, string> = {
  consultation: "View consultation",
  diagnostic: "View report",
  medication: "View prescription",
  hospitalization: "View discharge summary",
  procedure: "View procedure note",
};

function EventBody({ d }: { d: MedicalDocument }) {
  const x = d.extracted;
  const dx = x.diagnoses?.filter((v) => v.certainty !== "ruled_out");
  return (
    <div className="mt-2 space-y-2.5 text-[13.5px]">
      {x.labs && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-x-6 gap-y-1">
          {x.labs.slice(0, 6).map((l) => {
            const def = getBiomarker(l.biomarker);
            const f = flagFor(l);
            return (
              <div key={l.id} className="flex items-baseline gap-1.5 tabular">
                <span className="text-ink-3">{def?.shortName ?? l.name}</span>
                <span className={cn("font-medium", f === "high" ? "text-high" : f === "low" ? "text-low" : "text-ink")}>{formatValue(l.value, def?.decimals ?? 1)}</span>
                <span className="text-[11.5px] text-ink-3">{l.unit}</span>
              </div>
            );
          })}
          {x.labs.length > 6 && <div className="text-ink-3">+{x.labs.length - 6} more</div>}
        </div>
      )}
      {x.medications && d.type === "prescription" && (
        <ul className="space-y-0.5">
          {x.medications.map((m) => (
            <li key={m.id} className="text-ink-2">
              <span className="font-medium text-ink">
                {displayDrug(m.drug)} {m.action !== "stopped" && m.strength}
              </span>
              {m.action === "stopped" ? <span className="text-danger"> · stopped</span> : <span className="text-ink-3"> · {[m.frequency, m.instructions].filter(Boolean).join(", ").toLowerCase()}</span>}
              {m.action === "dose_changed" && <span className="ml-1.5 rounded bg-high-soft px-1 text-[11px] text-high">dose changed</span>}
            </li>
          ))}
        </ul>
      )}
      {(d.type === "consultation" || d.type === "discharge_summary" || d.type === "procedure") && x.notes?.chiefComplaint && <p className="text-ink-2">{x.notes.chiefComplaint}</p>}
      {d.type === "imaging" && x.notes?.impression && <p className="text-ink-2">{x.notes.impression}</p>}
      {d.type === "procedure" && x.notes?.procedureName && <p className="text-ink-2">{x.notes.procedureName}</p>}
      {x.notes?.admission && (
        <p className="text-ink-2">
          Admitted {fmtDate(x.notes.admission.admittedOn)} · discharged {fmtDate(x.notes.admission.dischargedOn)}
        </p>
      )}
      {dx && dx.length > 0 && d.type !== "imaging" && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Diagnosis</span>
          <div className="text-ink">{dx.map((v) => v.label).join("; ")}</div>
        </div>
      )}
    </div>
  );
}

export default function TimelinePage() {
  const s = useSnapshot();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const yearRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const [activeYear, setActiveYear] = React.useState<string>("");

  const docs = sortedDocuments(s).filter((d) => d.status !== "failed" && d.status !== "uploading" && (filter === "all" || TIMELINE_CATEGORY[d.type] === filter));
  const years = [...new Set(docs.map((d) => d.clinicalDate.slice(0, 4)))];
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, f.value === "all" ? s.documents.length : s.documents.filter((d) => TIMELINE_CATEGORY[d.type] === f.value).length]));

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiveYear((vis.target as HTMLElement).dataset.year!);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    Object.values(yearRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [years.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader eyebrow="Your history" title="Your Health Timeline" subtitle="Your medical history, organized chronologically." />

      <div className="sticky top-[136px] z-20 -mx-4 mb-8 bg-bg/90 px-4 py-3 backdrop-blur md:top-[76px] sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Segmented options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} value={filter} onChange={setFilter} size="sm" />
          <div className="flex items-center gap-1 text-[13px]">
            {years.map((y, i) => (
              <React.Fragment key={y}>
                {i > 0 && <span className="text-ink-4">|</span>}
                <button
                  onClick={() => yearRefs.current[y]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={cn("rounded-md px-2 py-1 tabular transition-colors", (activeYear || years[0]) === y ? "font-semibold text-ink" : "text-ink-3 hover:text-ink")}
                >
                  {y}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        {years.map((y) => {
          const inYear = docs.filter((d) => d.clinicalDate.startsWith(y));
          return (
            <section key={y} data-year={y} ref={(el) => void (yearRefs.current[y] = el)} className="scroll-mt-36 pb-6">
              <div className="mb-4 flex items-center gap-4">
                <h2 className="font-serif text-[34px] font-semibold leading-none text-ink">{y}</h2>
                <div className="h-px flex-1 bg-line" />
                <span className="text-[12.5px] text-ink-3 tabular">{inYear.length} events</span>
              </div>
              <ol className="relative rounded-[20px] border border-line-2 bg-surface px-3 py-2 shadow-card sm:px-6">
                {inYear.map((d, i) => {
                  const cat = TIMELINE_CATEGORY[d.type];
                  const st = CATEGORY_STYLE[cat];
                  const who = documentSourceName(s, d);
                  const facility = getProvider(s, d.providerId);
                  const single = d.type === "prescription" && d.extracted.medications?.length === 1 ? d.extracted.medications[0] : undefined;
                  return (
                    <li key={d.id} className="group relative grid grid-cols-[58px_20px_1fr] gap-x-2 sm:grid-cols-[76px_24px_1fr] sm:gap-x-3">
                      <div className="pt-[26px] text-right">
                        <div className="text-[12.5px] font-semibold tracking-[0.04em] text-ink tabular">{fmtDate(d.clinicalDate, "dayMonth")}</div>
                      </div>
                      <div className="relative flex justify-center">
                        <span aria-hidden className={cn("absolute w-px bg-line", i === 0 ? "top-8" : "top-0", i === inYear.length - 1 ? "h-8" : "bottom-0")} />
                        <span className={cn("relative z-10 mt-[29px] size-2.5 rounded-full ring-4 ring-surface transition-transform group-hover:scale-125", st.dot)} />
                      </div>
                      <button onClick={() => setDrawer(d.id)} className={cn("flex w-full min-w-0 gap-4 py-5 text-left", i < inYear.length - 1 && "border-b border-line-2")}>
                        <DocTile type={d.type} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", st.text)}>{TIMELINE_LABEL[cat]}</span>
                            {d.status === "needs_review" && <span className="rounded bg-high-soft px-1.5 text-[10.5px] font-medium text-high">Needs review</span>}
                          </span>
                          <span className="mt-1 block text-[16px] font-medium tracking-[-0.01em] text-ink">{single ? `${displayDrug(single.drug)} ${single.strength}` : d.title}</span>
                          <span className="block text-[13.5px] text-ink-3">
                            {who}
                            {facility && facility.name !== who && getProvider(s, d.clinicianId)?.organization !== facility.name ? ` · ${facility.name}` : ""}
                          </span>
                          {!single ? (
                            <EventBody d={d} />
                          ) : (
                            <span className="mt-1.5 block text-[13.5px] text-ink-2">
                              {[single.frequency, single.instructions].filter(Boolean).join(" · ")}
                              {single.action === "dose_changed" && <span className="ml-1.5 rounded bg-high-soft px-1 text-[11px] text-high">dose changed</span>}
                            </span>
                          )}
                          <span className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-ink-3 transition-colors group-hover:text-accent">
                            {VIEW_LABEL[cat]} <ArrowRight className="size-3.5" />
                          </span>
                        </span>
                        <ChevronRight className="mt-3 size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        {!docs.length && <div className="py-20 text-center text-sm text-ink-3">No events in this category yet.</div>}
      </div>

      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
