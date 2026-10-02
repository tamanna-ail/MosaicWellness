"use client";

/**
 * Renders a faithful-looking "original" for demo documents (which have no
 * real scan). Uploaded files are shown as the actual file instead.
 */
import type { HealthSnapshot, MedicalDocument } from "@/lib/types";
import { ageFrom, fmtDate, getProvider } from "@/lib/health/selectors";
import { cn } from "@/lib/utils";

const LETTERHEAD: Record<string, { color: string; tagline: string }> = {
  metropolis: { color: "#0b5aa6", tagline: "The Pathology Specialist" },
  apollo_diag: { color: "#0a6e6e", tagline: "Diagnostics you can trust" },
  srl_pune: { color: "#c0262d", tagline: "Diagnostics · Est. 1995" },
  apollo_hosp: { color: "#0a6e6e", tagline: "Touching Lives" },
  sahyadri: { color: "#6b3fa0", tagline: "Multispeciality Hospital" },
  manipal_rad: { color: "#1f4e8c", tagline: "Imaging & Radiology" },
};

/** Stable, realistic-looking accession number derived from the record id. */
function refNumber(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `${(h >>> 0).toString().padStart(10, "0").slice(0, 10)}`;
}

export function DocumentReplica({ doc, s }: { doc: MedicalDocument; s: HealthSnapshot }) {
  const facility = getProvider(s, doc.providerId);
  const clinician = getProvider(s, doc.clinicianId);
  const head = LETTERHEAD[doc.providerId ?? ""] ?? { color: "#2b2f36", tagline: clinician?.specialty ?? "Clinic" };
  const p = s.patient;
  const x = doc.extracted;
  const hand = doc.handwritten;

  return (
    <div className="mx-auto w-full max-w-[640px] rounded-[4px] bg-white text-[11.5px] leading-[1.5] text-[#222] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_28px_-6px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
      {/* Letterhead */}
      <div className="flex items-start justify-between gap-4 border-b-2 px-8 pb-4 pt-7" style={{ borderColor: head.color }}>
        <div>
          <div className="text-[19px] font-bold tracking-tight" style={{ color: head.color }}>
            {facility?.name ?? clinician?.organization ?? "Clinic"}
          </div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#777]">{head.tagline}</div>
        </div>
        <div className="text-right text-[10px] text-[#666]">
          {facility?.organization && <div>{facility.organization}</div>}
          <div>{facility?.city ?? clinician?.city}</div>
          {clinician && doc.type !== "lab_report" && (
            <div className="mt-1 font-semibold text-[#333]">
              {clinician.name}
              <div className="font-normal">{clinician.specialty}</div>
            </div>
          )}
        </div>
      </div>

      {/* Patient block */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 border-b border-[#e5e5e5] bg-[#fafafa] px-8 py-3 text-[10.5px]">
        <div>
          <span className="text-[#888]">Patient:</span> <b>{p.firstName.toUpperCase()} {p.lastName.toUpperCase()}</b>
        </div>
        <div>
          <span className="text-[#888]">{doc.type === "lab_report" ? "Collected:" : "Date:"}</span> {fmtDate(doc.clinicalDate)}
        </div>
        <div>
          <span className="text-[#888]">Age/Sex:</span> {ageFrom(p.dateOfBirth, doc.clinicalDate)} Y / {p.sex === "male" ? "M" : "F"}
        </div>
        <div>
          <span className="text-[#888]">Ref. No:</span> {refNumber(doc.id)}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="mb-4 text-center text-[12.5px] font-bold uppercase tracking-[0.08em]">{doc.title}</div>

        {x.labs && (
          <table className="w-full">
            <thead>
              <tr className="border-y border-[#ccc] text-left text-[10px] uppercase tracking-wide text-[#555]">
                <th className="py-1.5 font-semibold">Test Description</th>
                <th className="py-1.5 font-semibold">Result</th>
                <th className="py-1.5 font-semibold">Units</th>
                <th className="py-1.5 font-semibold">Bio. Ref. Interval</th>
              </tr>
            </thead>
            <tbody>
              {x.labs.map((l) => {
                const hi = l.refHigh !== undefined && l.value > l.refHigh;
                const lo = l.refLow !== undefined && l.value < l.refLow;
                return (
                  <tr key={l.id} className="border-b border-dotted border-[#ddd]">
                    <td className="py-1.5">{l.name}</td>
                    <td className={cn("py-1.5 tabular", (hi || lo) && "font-bold")}>
                      {l.value}
                      {hi ? " H" : lo ? " L" : ""}
                    </td>
                    <td className="py-1.5 text-[#555]">{l.unit}</td>
                    <td className="py-1.5 text-[#555] tabular">{l.refText ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {doc.type === "prescription" && x.medications && (
          <div>
            <div className="mb-2 font-serif text-[30px] leading-none" style={{ color: head.color }}>
              ℞
            </div>
            <ol className={cn("space-y-2.5", hand && "font-[family-name:var(--font-hand)] text-[17px] leading-snug text-[#1e3a8a] -rotate-[0.6deg]")}>
              {x.medications.map((m, i) => (
                <li key={m.id}>
                  {i + 1}. {m.brand ?? m.drug} {m.action === "stopped" ? "— STOP" : m.strength}
                  {m.action !== "stopped" && (
                    <div className={cn("pl-4", hand ? "text-[15px]" : "text-[#555]")}>
                      {m.frequency}
                      {m.instructions ? ` · ${m.instructions}` : ""}
                      {m.durationDays ? ` × ${m.durationDays} days` : ""}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {x.notes && doc.type !== "prescription" && (
          <div className="space-y-3">
            {x.notes.admission && (
              <p>
                <b>Admitted:</b> {fmtDate(x.notes.admission.admittedOn)} &nbsp; <b>Discharged:</b> {fmtDate(x.notes.admission.dischargedOn)} &nbsp; {x.notes.admission.ward}
              </p>
            )}
            {x.notes.chiefComplaint && (
              <p>
                <b>Presenting complaint:</b> {x.notes.chiefComplaint}
              </p>
            )}
            {x.notes.procedureName && (
              <p>
                <b>Procedure:</b> {x.notes.procedureName}
              </p>
            )}
            {x.notes.findings && (
              <div>
                <b>{doc.type === "imaging" ? "Findings" : "Examination / Findings"}:</b>
                <ul className="ml-4 list-disc">
                  {x.notes.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {x.diagnoses && doc.type !== "imaging" && (
              <p>
                <b>Diagnosis:</b> {x.diagnoses.map((d) => d.label).join("; ")}
              </p>
            )}
            {x.notes.impression && (
              <p>
                <b>IMPRESSION:</b> {x.notes.impression}
              </p>
            )}
            {x.notes.plan && (
              <div>
                <b>Advice / Plan:</b>
                <ol className="ml-4 list-decimal">
                  {x.notes.plan.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ol>
              </div>
            )}
            {x.medications && (
              <div>
                <b>Medications:</b>
                <ul className="ml-4 list-disc">
                  {x.medications.map((m) => (
                    <li key={m.id}>
                      {m.drug} {m.strength} — {m.frequency}
                      {m.durationDays ? ` × ${m.durationDays} days` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {x.vitals && (
              <p className="text-[#555]">
                <b className="text-[#222]">Vitals:</b>{" "}
                {x.vitals.map((v) => `${v.kind === "bp" ? "BP" : v.kind === "heart_rate" ? "PR" : v.kind === "spo2" ? "SpO₂" : v.kind === "temperature" ? "Temp" : "Wt"} ${v.kind === "bp" ? `${v.value}/${v.value2}` : v.value} ${v.unit}`).join(" · ")}
              </p>
            )}
          </div>
        )}

        <div className="mt-10 flex items-end justify-between text-[10px] text-[#777]">
          <div>{doc.type === "lab_report" ? "*** End of Report ***" : `Printed ${fmtDate(doc.clinicalDate)}`}</div>
          <div className="text-right">
            <div className={cn("mb-1 text-[16px] text-[#1e3a8a]", "font-[family-name:var(--font-hand)]")}>{doc.type === "lab_report" ? "Dr. S. Rao" : (clinician?.name ?? "")}</div>
            {doc.type === "lab_report" ? "Consultant Pathologist" : clinician?.specialty}
          </div>
        </div>
      </div>
    </div>
  );
}
