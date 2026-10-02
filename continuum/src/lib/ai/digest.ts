/**
 * Compact, citation-ready text view of the record for an LLM.
 * Each line starts with the document id the model must cite.
 */
import type { HealthSnapshot } from "@/lib/types";
import { DOC_TYPE_LABEL, documentFacilityName, flagFor, getProvider, isUsable, sortedDocuments } from "@/lib/health/selectors";

export function buildDigest(s: HealthSnapshot) {
  const p = s.patient;
  const head = `PATIENT: ${p.firstName} ${p.lastName}, born ${p.dateOfBirth}, ${p.sex}, ${p.city}.`;
  const lines = sortedDocuments(s, "asc")
    .filter(isUsable)
    .map((d) => {
      const x = d.extracted;
      const parts = [`[${d.id}] ${d.clinicalDate} | ${DOC_TYPE_LABEL[d.type]} | ${d.title} | ${getProvider(s, d.clinicianId)?.name ?? ""} ${documentFacilityName(s, d)}`];
      if (x.labs) parts.push("Labs: " + x.labs.map((l) => `${l.name} ${l.value} ${l.unit} (ref ${l.refText ?? "n/a"}${flagFor(l) !== "normal" && flagFor(l) !== "unknown" ? `, ${flagFor(l).toUpperCase()}` : ""})`).join("; "));
      if (x.medications) parts.push("Meds: " + x.medications.map((m) => `${m.drug} ${m.strength} ${m.frequency}${m.durationDays ? ` x${m.durationDays}d` : ""} [${m.action}]${m.reason ? ` for ${m.reason}` : ""}`).join("; "));
      if (x.diagnoses) parts.push("Dx: " + x.diagnoses.map((v) => `${v.label}${v.certainty !== "confirmed" ? ` (${v.certainty})` : ""}`).join("; "));
      if (x.allergies) parts.push("Allergy: " + x.allergies.map((a) => `${a.substance} — ${a.reaction}`).join("; "));
      if (x.notes?.admission) parts.push(`Admitted ${x.notes.admission.admittedOn} to ${x.notes.admission.dischargedOn}`);
      if (x.notes?.chiefComplaint) parts.push(`Complaint: ${x.notes.chiefComplaint}`);
      if (x.notes?.findings) parts.push(`Findings: ${x.notes.findings.join("; ")}`);
      if (x.notes?.impression) parts.push(`Impression: ${x.notes.impression}`);
      if (x.notes?.plan) parts.push(`Plan: ${x.notes.plan.join("; ")}`);
      return parts.join(" | ");
    });
  return [head, ...lines].join("\n");
}
