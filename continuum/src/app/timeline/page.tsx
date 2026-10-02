"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { DocTypeIcon } from "@/components/health/bits";
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
  consultation: { dot: "bg-[#3d5ce0]", text: "text-[#3d5ce0]" },
  diagnostic: { dot: "bg-[#0f8a7e]", text: "text-[#0f7a70]" },
  medication: { dot: "bg-[#8a4bb8]", text: "text-[#7d43a8]" },
  hospitalization: { dot: "bg-[#b4302b]", text: "text-[#b4302b]" },
  procedure: { dot: "bg-[#a65a0b]", text: "text-[#a65a0b]" },
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
      <PageHeader title="Your Health Timeline" subtitle="Your medical history, organized chronologically." />

      <div className="sticky top-14 z-20 -mx-4 mb-8 border-b border-line-2 bg-bg/90 px-4 py-3 backdrop-blur lg:top-0 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
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
                <h2 className="font-serif text-[30px] leading-none text-ink">{y}</h2>
                <div className="h-px flex-1 bg-line" />
                <span className="text-[12px] text-ink-3 tabular">{inYear.length} events</span>
              </div>
              <ol className="relative">
                <span aria-hidden className="absolute bottom-3 left-[95.5px] top-3 w-px bg-line sm:left-[118.5px]" />
                {inYear.map((d) => {
                  const cat = TIMELINE_CATEGORY[d.type];
                  const st = CATEGORY_STYLE[cat];
                  const who = documentSourceName(s, d);
                  const facility = getProvider(s, d.providerId);
                  return (
                    <li key={d.id} className="group relative grid grid-cols-[72px_24px_1fr] gap-x-3 py-2 sm:grid-cols-[92px_30px_1fr]">
                      <div className="pt-3.5 text-right">
                        <div className="text-[12px] font-semibold tracking-[0.04em] text-ink tabular">{fmtDate(d.clinicalDate, "dayMonth")}</div>
                      </div>
                      <div className="relative flex justify-center pt-[18px]">
                        <span className={cn("relative z-10 size-2.5 rounded-full ring-4 ring-bg transition-transform group-hover:scale-125", st.dot)} />
                      </div>
                      <button
                        onClick={() => setDrawer(d.id)}
                        className="w-full rounded-2xl border border-transparent px-4 py-3 text-left transition-all hover:border-line hover:bg-surface hover:shadow-card"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[11px] font-semibold uppercase tracking-[0.1em]", st.text)}>{TIMELINE_LABEL[cat]}</span>
                          {d.status === "needs_review" && <span className="rounded bg-high-soft px-1.5 text-[10.5px] font-medium text-high">Needs review</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{d.type === "prescription" && d.extracted.medications?.length === 1 ? `${displayDrug(d.extracted.medications[0].drug)} ${d.extracted.medications[0].strength}` : d.title}</h3>
                        </div>
                        <div className="text-[13px] text-ink-3">
                          {who}
                          {facility && facility.name !== who && getProvider(s, d.clinicianId)?.organization !== facility.name ? ` · ${facility.name}` : ""}
                        </div>
                        {!(d.type === "prescription" && d.extracted.medications?.length === 1) ? (
                          <EventBody d={d} />
                        ) : (
                          <div className="mt-1.5 text-[13.5px] text-ink-2">
                            {[d.extracted.medications[0].frequency, d.extracted.medications[0].instructions].filter(Boolean).join(" · ")}
                            {d.extracted.medications[0].action === "dose_changed" && <span className="ml-1.5 rounded bg-high-soft px-1 text-[11px] text-high">dose changed</span>}
                          </div>
                        )}
                        <div className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-3 transition-colors group-hover:text-accent">
                          <DocTypeIcon type={d.type} className="size-3.5" /> {VIEW_LABEL[cat]} <ArrowRight className="size-3.5" />
                        </div>
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
