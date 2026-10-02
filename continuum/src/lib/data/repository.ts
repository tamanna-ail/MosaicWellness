import "server-only";
import type { HealthSnapshot } from "@/lib/types";
import { seedSnapshot } from "./seed";

/**
 * Storage boundary. The UI only ever sees a HealthSnapshot, so swapping the
 * backing store (bundled demo data ↔ Postgres) never touches components.
 */
export interface HealthRepository {
  readonly kind: "demo" | "postgres";
  getSnapshot(patientId?: string): Promise<HealthSnapshot>;
}

const demoRepository: HealthRepository = {
  kind: "demo",
  async getSnapshot() {
    return seedSnapshot;
  },
};

export async function getRepository(): Promise<HealthRepository> {
  if (!process.env.DATABASE_URL) return demoRepository;
  const { prismaRepository } = await import("./prisma-repository");
  return prismaRepository;
}

/** Loads the snapshot, falling back to demo data if the database is unreachable so the product never hard-fails. */
export async function loadSnapshot(): Promise<{ snapshot: HealthSnapshot; source: HealthRepository["kind"] }> {
  const repo = await getRepository();
  try {
    return { snapshot: await repo.getSnapshot(), source: repo.kind };
  } catch (err) {
    console.warn("[continuum] repository unavailable, serving demo data:", err);
    return { snapshot: seedSnapshot, source: "demo" };
  }
}
