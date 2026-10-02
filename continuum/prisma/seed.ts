/** Loads the demo patient into Postgres: `npm run db:seed` (after `npm run db:push`). */
import "dotenv/config";
import { getPrisma } from "../src/lib/data/prisma-client";
import { seedSnapshot } from "../src/lib/data/seed";

async function main() {
  const db = getPrisma();
  const { patient, providers, conditions, documents } = seedSnapshot;

  await db.patient.deleteMany({ where: { id: patient.id } });
  await db.provider.deleteMany();
  await db.condition.deleteMany();

  await db.patient.create({ data: { ...patient, dateOfBirth: new Date(patient.dateOfBirth) } });
  await db.provider.createMany({ data: providers });
  await db.condition.createMany({ data: conditions });

  for (const d of documents) {
    const x = d.extracted;
    await db.document.create({
      data: {
        id: d.id,
        patientId: patient.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        type: d.type,
        title: d.title,
        clinicalDate: new Date(d.clinicalDate),
        uploadedAt: new Date(d.uploadedAt),
        providerId: d.providerId,
        clinicianId: d.clinicianId,
        status: d.status,
        confidence: d.confidence,
        pages: d.pages,
        handwritten: !!d.handwritten,
        reviewedAt: d.reviewedAt ? new Date(d.reviewedAt) : undefined,
        source: d.source,
        extractionEngine: d.extractionEngine,
        notes: x.notes ? (x.notes as object) : undefined,
        labs: { create: (x.labs ?? []).map((l, i) => ({ ...l, edited: !!l.edited, sortOrder: i })) },
        diagnoses: { create: (x.diagnoses ?? []).map((v, i) => ({ ...v, sortOrder: i })) },
        medications: { create: (x.medications ?? []).map((m, i) => ({ ...m, edited: !!m.edited, sortOrder: i })) },
        vitals: { create: (x.vitals ?? []).map((v, i) => ({ ...v, sortOrder: i })) },
        allergies: { create: x.allergies ?? [] },
      },
    });
  }
  console.log(`Seeded ${documents.length} documents for ${patient.firstName} ${patient.lastName}.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
