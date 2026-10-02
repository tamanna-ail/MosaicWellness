"use client";

import * as React from "react";
import Link from "next/link";
import type { MedicalDocument } from "@/lib/types";
import { flagFor, fmtDate } from "@/lib/health/selectors";
import { formatValue, getBiomarker } from "@/lib/health/biomarkers";
import { FlagBadge, SectionLabel } from "@/components/health/bits";
import { Badge } from "@/components/ui/primitives";

const VITAL_LABEL = { bp: "Blood pressure", weight: "Weight", heart_rate: "Pulse", bmi: "BMI", spo2: "SpO₂", temperature: "Temperature" } as const;

export function LabTable({ doc, linkMarkers = true }: { doc: MedicalDocument; linkMarkers?: boolean }) {
  const labs = doc.extracted.labs ?? [];
  if (!labs.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
            <th className="px-3 py-2 font-medium">Test</th>
            <th className="px-3 py-2 text-right font-medium">Result</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Reference</th>
            <th className="px-3 py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {labs.map((l) => {
            const def = getBiomarker(l.biomarker);
            const flag = flagFor(l);
            return (
              <tr key={l.id} className="border-t border-line-2">
                <td className="px-3 py-2.5">
                  {def && linkMarkers ? (
                    <Link href={`/health/${def.code.toLowerCase()}`} className="font-medium text-ink hover:text-accent">
                      {def.shortName}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{l.name}</span>
                  )}
                  {def && def.shortName !== l.name && <div className="text-[11.5px] text-ink-3">{l.name}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular">
                  <span className={flag === "high" ? "font-semibold text-high" : flag === "low" ? "font-semibold text-low" : "font-medium text-ink"}>{formatValue(l.value, def?.decimals ?? 1)}</span> <span className="text-ink-3">{l.unit}</span>
                  {l.edited && <div className="text-[10.5px] text-accent">Corrected</div>}
                </td>
                <td className="hidden px-3 py-2.5 text-ink-3 tabular sm:table-cell">{l.refText ?? "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  <FlagBadge flag={flag} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ExtractedView({ doc, compact }: { doc: MedicalDocument; compact?: boolean }) {
  const x = doc.extracted;
  const notes = x.notes;
  return (
    <div className="space-y-6">
      {notes?.admission && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-3 text-[13px] ring-1 ring-line-2">
          <div>
            <div className="text-[11px] text-ink-3">Admitted</div>
            <div className="font-medium">{fmtDate(notes.admission.admittedOn, "long")}</div>
          </div>
          <div>
            <div className="text-[11px] text-ink-3">Discharged</div>
            <div className="font-medium">{fmtDate(notes.admission.dischargedOn, "long")}</div>
          </div>
          {notes.admission.ward && <div className="col-span-2 text-[12px] text-ink-3">{notes.admission.ward}</div>}
        </div>
      )}

      {(notes?.summary || notes?.impression || notes?.chiefComplaint || notes?.procedureName) && (
        <div className="space-y-3">
          {notes.chiefComplaint && (
            <div>
              <SectionLabel>Reason for visit</SectionLabel>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{notes.chiefComplaint}</p>
            </div>
          )}
          {notes.procedureName && (
            <div>
              <SectionLabel>Procedure</SectionLabel>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{notes.procedureName}</p>
            </div>
          )}
          {(notes.impression || notes.summary) && (
            <div>
              <SectionLabel>{notes.impression ? "Impression" : "Summary"}</SectionLabel>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{notes.impression ?? notes.summary}</p>
            </div>
          )}
        </div>
      )}

      {!!x.diagnoses?.length && (
        <div>
          <SectionLabel>Diagnosis</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {x.diagnoses.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-[14px]">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink" />
                <span className="text-ink">
                  {d.label}
                  {d.certainty !== "confirmed" && (
                    <Badge tone="outline" className="ml-2 align-middle">
                      {d.certainty === "provisional" ? "Provisional" : "Ruled out"}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!x.labs?.length && (
        <div>
          <SectionLabel className="mb-2">Tests</SectionLabel>
          <LabTable doc={doc} />
        </div>
      )}

      {!!x.medications?.length && (
        <div>
          <SectionLabel className="mb-2">Medications</SectionLabel>
          <div className="divide-y divide-line-2 rounded-xl border border-line">
            {x.medications.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-ink">
                    {m.drug} <span className="font-normal text-ink-2">{m.action === "stopped" ? "" : m.strength}</span>
                  </div>
                  <div className="text-[12.5px] text-ink-3">
                    {m.action === "stopped" ? m.reason : [m.frequency, m.instructions, m.durationDays ? `${m.durationDays} days` : "Long-term"].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Badge tone={m.action === "stopped" ? "danger" : m.action === "started" ? "accent" : m.action === "dose_changed" ? "high" : "neutral"}>
                  {m.action === "one_off" ? "Course" : m.action === "dose_changed" ? "Dose changed" : m.action.charAt(0).toUpperCase() + m.action.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!x.allergies?.length && (
        <div>
          <SectionLabel>Allergy recorded</SectionLabel>
          {x.allergies.map((a) => (
            <div key={a.id} className="mt-2 rounded-xl bg-danger-soft/60 px-3 py-2.5 text-[13.5px] ring-1 ring-danger/10">
              <span className="font-medium text-danger">{a.substance}</span> <span className="text-ink-2">— {a.reaction} ({a.severity})</span>
            </div>
          ))}
        </div>
      )}

      {!compact && !!notes?.findings?.length && (
        <div>
          <SectionLabel>Findings</SectionLabel>
          <ul className="mt-2 space-y-1.5 text-[13.5px] text-ink-2">
            {notes.findings.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[8px] size-1 shrink-0 rounded-full bg-ink-4" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && !!notes?.plan?.length && (
        <div>
          <SectionLabel>Plan</SectionLabel>
          <ol className="mt-2 space-y-1.5 text-[13.5px] text-ink-2">
            {notes.plan.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="tabular text-ink-4">{i + 1}.</span>
                {f}
              </li>
            ))}
          </ol>
        </div>
      )}

      {!!x.vitals?.length && (
        <div>
          <SectionLabel className="mb-2">Vitals</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {x.vitals.map((v) => (
              <div key={v.id} className="rounded-lg bg-surface-2 px-2.5 py-1.5 ring-1 ring-line-2">
                <div className="text-[10.5px] text-ink-3">{VITAL_LABEL[v.kind]}</div>
                <div className="text-[13px] font-medium tabular">
                  {v.kind === "bp" ? `${v.value}/${v.value2}` : v.value} <span className="text-[11px] font-normal text-ink-3">{v.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
