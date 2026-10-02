/**
 * Maps an extractor's output onto the domain model and reconciles it with
 * the existing history: resolves known doctors/labs, links diagnoses to known
 * conditions, and infers whether a medication was started, continued or had
 * its dose changed by comparing with the active course.
 */
import type { Condition, DocumentType, HealthSnapshot, MedicalDocument, MedicationOrder, Provider } from "@/lib/types";
import { BIOMARKERS, getBiomarker } from "@/lib/health/biomarkers";
import { medicationCourses, todayISO } from "@/lib/health/selectors";
import type { ExtractionResult } from "./types";

export const REVIEW_THRESHOLD = 0.9;

const slug = (s: string) => s.toLowerCase().replace(/^dr\.?\s*/, "dr ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const norm = (s: string) => s.toLowerCase().replace(/^dr\.?\s*/, "").replace(/[^a-z0-9 ]/g, "").trim();

function resolveProvider(s: HealthSnapshot, name: string | null, kind: Provider["kind"], extra: Partial<Provider> = {}): { id?: string; created?: Provider } {
  if (!name) return {};
  const found = s.providers.find((p) => norm(p.name) === norm(name) || (norm(name).length > 6 && norm(p.name).includes(norm(name))));
  if (found) return { id: found.id };
  const created: Provider = { id: `prv_${slug(name)}`, name, kind, city: s.patient.city, ...extra };
  return { id: created.id, created };
}

const FACILITY_KIND: Record<DocumentType, Provider["kind"]> = {
  lab_report: "lab",
  imaging: "imaging",
  discharge_summary: "hospital",
  procedure: "hospital",
  consultation: "clinic",
  prescription: "clinic",
};

function resolveCondition(s: HealthSnapshot, label: string): { id: string; created?: Condition } {
  const l = label.toLowerCase();
  const found = s.conditions.find((c) => {
    const key = c.name.toLowerCase().replace(/\(.*?\)/g, "").replace(/subclinical |acute |community-acquired |bacterial /g, "").trim();
    return l.includes(key) || key.includes(l.replace(/subclinical |acute /g, "").trim());
  });
  if (found) return { id: found.id };
  const created: Condition = { id: `cond_${slug(label)}`, name: label.replace(/\b\w/g, (c) => c.toUpperCase()), category: "other", chronic: false, status: "active" };
  return { id: created.id, created };
}

function matchBiomarker(code: string | null, name: string) {
  if (code && getBiomarker(code)) return code.toUpperCase();
  const n = ` ${name.toLowerCase()} `;
  return BIOMARKERS.find((b) => b.aliases.some((a) => n.includes(` ${a} `) || n.includes(`${a},`) || n.startsWith(` ${a}`)))?.code ?? slug(name).toUpperCase();
}

export function toDocument(
  s: HealthSnapshot,
  r: ExtractionResult,
  file: { id: string; name: string; type: string; fileUrl?: string; uploadedAt: string },
): { document: MedicalDocument; providers: Provider[]; conditions: Condition[] } {
  const providers: Provider[] = [];
  const conditions: Condition[] = [];

  const facility = resolveProvider(s, r.facilityName, FACILITY_KIND[r.documentType]);
  if (facility.created) providers.push(facility.created);
  const clinician = resolveProvider(s, r.clinicianName, "doctor", { specialty: r.clinicianSpecialty ?? undefined, organization: r.facilityName ?? undefined });
  if (clinician.created) providers.push(clinician.created);

  const diagnoses = r.diagnoses.map((d, i) => {
    const c = resolveCondition({ ...s, conditions: [...s.conditions, ...conditions] }, d.label);
    if (c.created) conditions.push(c.created);
    return { id: `${file.id}_dx${i}`, conditionId: c.id, label: d.label, certainty: "confirmed" as const };
  });

  // Reconcile medications with what's already active.
  const active = medicationCourses(s).filter((c) => c.active);
  const medications: MedicationOrder[] = r.medications.map((m, i) => {
    const existing = active.find((c) => c.drug.toLowerCase().split(/[\s(]/)[0] === m.drug.toLowerCase().split(/[\s(]/)[0]);
    let action = m.action;
    if (existing && action !== "stopped") action = existing.current.strength.replace(/\s/g, "") === m.strength.replace(/\s/g, "") ? "continued" : "dose_changed";
    else if (!existing && action === "continued") action = m.durationDays ? "one_off" : "started";
    return {
      id: `${file.id}_rx${i}`,
      drug: m.drug,
      brand: m.brand ?? undefined,
      drugClass: m.drugClass,
      strength: m.strength,
      frequency: m.frequency,
      instructions: m.instructions ?? undefined,
      durationDays: m.durationDays ?? undefined,
      action,
      reasonConditionId: existing?.current.reasonConditionId ?? diagnoses[0]?.conditionId,
      reason: existing?.current.reason ?? diagnoses[0]?.label,
    };
  });

  const document: MedicalDocument = {
    id: file.id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    type: r.documentType,
    title: r.title,
    clinicalDate: r.clinicalDate ?? todayISO(),
    uploadedAt: file.uploadedAt,
    providerId: facility.id ?? clinician.id,
    clinicianId: clinician.id,
    status: r.confidence >= REVIEW_THRESHOLD && r.clinicalDate ? "processed" : "needs_review",
    confidence: r.confidence,
    pages: 1,
    handwritten: r.warnings.some((w) => /handwrit/i.test(w)) || undefined,
    source: "upload",
    extractionEngine: r.engine,
    fileUrl: file.fileUrl,
    extracted: {
      labs: r.labs.length
        ? r.labs.map((l, i) => ({ id: `${file.id}_lab${i}`, biomarker: matchBiomarker(l.biomarkerCode, l.name), name: l.name, value: l.value, unit: l.unit, refLow: l.refLow ?? undefined, refHigh: l.refHigh ?? undefined, refText: l.refText ?? undefined }))
        : undefined,
      medications: medications.length ? medications : undefined,
      diagnoses: diagnoses.length ? diagnoses : undefined,
      allergies: r.allergies.length ? r.allergies.map((a, i) => ({ id: `${file.id}_alg${i}`, ...a })) : undefined,
      notes: r.summary || r.findings.length || r.warnings.length ? { summary: r.summary ?? undefined, findings: r.findings.length ? r.findings : undefined, extractionWarnings: r.warnings.length ? r.warnings : undefined } : undefined,
    },
  };
  return { document, providers, conditions };
}
