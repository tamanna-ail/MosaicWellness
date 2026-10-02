import "server-only";
import type { ClinicalNotes, DocumentStatus, HealthSnapshot, MedicalDocument } from "@/lib/types";
import type { HealthRepository } from "./repository";
import { getPrisma } from "./prisma-client";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const opt = <T,>(v: T | null) => (v === null ? undefined : v);

/** Reads the normalised Postgres tables back into the document-centric snapshot the UI uses. */
export const prismaRepository: HealthRepository = {
  kind: "postgres",
  async getSnapshot(patientId) {
    const db = getPrisma();
    const patient = patientId ? await db.patient.findUniqueOrThrow({ where: { id: patientId } }) : await db.patient.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    const [providers, conditions, documents] = await Promise.all([
      db.provider.findMany(),
      db.condition.findMany(),
      db.document.findMany({
        where: { patientId: patient.id },
        orderBy: { clinicalDate: "desc" },
        include: {
          labs: { orderBy: { sortOrder: "asc" } },
          diagnoses: { orderBy: { sortOrder: "asc" } },
          medications: { orderBy: { sortOrder: "asc" } },
          vitals: { orderBy: { sortOrder: "asc" } },
          allergies: true,
        },
      }),
    ]);

    const docs: MedicalDocument[] = documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      type: d.type,
      title: d.title,
      clinicalDate: iso(d.clinicalDate),
      uploadedAt: d.uploadedAt.toISOString(),
      providerId: opt(d.providerId),
      clinicianId: opt(d.clinicianId),
      status: d.status as DocumentStatus,
      confidence: d.confidence,
      pages: d.pages,
      handwritten: d.handwritten || undefined,
      reviewedAt: d.reviewedAt?.toISOString(),
      source: d.source === "seed" ? "seed" : "upload",
      extractionEngine: opt(d.extractionEngine),
      extracted: {
        labs: d.labs.length ? d.labs.map((l) => ({ id: l.id, biomarker: l.biomarker, name: l.name, value: l.value, unit: l.unit, refLow: opt(l.refLow), refHigh: opt(l.refHigh), refText: opt(l.refText), edited: l.edited || undefined })) : undefined,
        diagnoses: d.diagnoses.length ? d.diagnoses.map((x) => ({ id: x.id, conditionId: x.conditionId, label: x.label, certainty: x.certainty as "confirmed" })) : undefined,
        medications: d.medications.length
          ? d.medications.map((m) => ({ id: m.id, drug: m.drug, brand: opt(m.brand), drugClass: m.drugClass, strength: m.strength, form: opt(m.form), frequency: m.frequency, instructions: opt(m.instructions), durationDays: opt(m.durationDays), action: m.action as "started", reasonConditionId: opt(m.reasonConditionId), reason: opt(m.reason), edited: m.edited || undefined }))
          : undefined,
        vitals: d.vitals.length ? d.vitals.map((v) => ({ id: v.id, kind: v.kind as "bp", value: v.value, value2: opt(v.value2), unit: v.unit })) : undefined,
        allergies: d.allergies.length ? d.allergies.map((a) => ({ id: a.id, substance: a.substance, reaction: a.reaction, severity: a.severity as "mild" })) : undefined,
        notes: (d.notes ?? undefined) as ClinicalNotes | undefined,
      },
    }));

    const snapshot: HealthSnapshot = {
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: iso(patient.dateOfBirth),
        sex: patient.sex as "male",
        bloodGroup: opt(patient.bloodGroup),
        heightCm: opt(patient.heightCm),
        city: patient.city,
        phone: opt(patient.phone),
        emergencyContact: opt(patient.emergencyContact),
      },
      providers: providers.map((p) => ({ id: p.id, name: p.name, kind: p.kind as "doctor", specialty: opt(p.specialty), organization: opt(p.organization), city: p.city })),
      conditions: conditions.map((c) => ({ id: c.id, name: c.name, category: c.category as "other", chronic: c.chronic, status: c.status as "active", description: opt(c.description) })),
      documents: docs,
    };
    return snapshot;
  },
};
