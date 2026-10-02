"use client";

/**
 * Client-side health store.
 *
 * The server hands over the patient's snapshot from the repository (Postgres
 * via Prisma when configured, otherwise the bundled demo dataset). Changes the
 * user makes in this browser — uploads and corrections — are layered on top
 * and kept in localStorage so the demo survives reloads.
 */
import * as React from "react";
import type { Condition, HealthSnapshot, LabResult, MedicalDocument, MedicationOrder, Provider } from "@/lib/types";

const STORAGE_KEY = "continuum.snapshot.v1";

interface HealthStore {
  snapshot: HealthSnapshot;
  hydrated: boolean;
  addDocument: (doc: MedicalDocument) => void;
  updateDocument: (id: string, patch: Partial<MedicalDocument> | ((d: MedicalDocument) => MedicalDocument)) => void;
  updateLab: (docId: string, labId: string, patch: Partial<LabResult>) => void;
  updateMedication: (docId: string, medId: string, patch: Partial<MedicationOrder>) => void;
  removeDocument: (id: string) => void;
  /** Adds providers/conditions discovered in a new document (existing ids are left untouched). */
  mergeReference: (ref: { providers?: Provider[]; conditions?: Condition[] }) => void;
  resetDemo: () => void;
}

const Ctx = React.createContext<HealthStore | null>(null);

function strip(s: HealthSnapshot): HealthSnapshot {
  // Object URLs don't survive a reload; drop them before persisting.
  return { ...s, documents: s.documents.map(({ fileUrl, ...d }) => (fileUrl?.startsWith("data:") && fileUrl.length < 1_500_000 ? { ...d, fileUrl } : d)) };
}

export function HealthProvider({ initial, children }: { initial: HealthSnapshot; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = React.useState(initial);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as HealthSnapshot;
        if (saved?.patient?.id === initial.patient.id && Array.isArray(saved.documents)) {
          // Documents that were mid-processing when the tab closed are restored as needing review.
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
          setSnapshot({
            ...saved,
            documents: saved.documents.map((d) => (d.status === "uploading" || d.status === "processing" ? { ...d, status: "needs_review" } : d)),
          });
        }
      }
    } catch {
      /* storage unavailable: fall back to server snapshot */
    }
    setHydrated(true);
  }, [initial.patient.id]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strip(snapshot)));
    } catch {
      /* quota or private mode — keep working in memory */
    }
  }, [snapshot, hydrated]);

  const store = React.useMemo<HealthStore>(() => {
    const mapDocs = (fn: (docs: MedicalDocument[]) => MedicalDocument[]) => setSnapshot((s) => ({ ...s, documents: fn(s.documents) }));
    return {
      snapshot,
      hydrated,
      addDocument: (doc) => mapDocs((docs) => [doc, ...docs]),
      updateDocument: (id, patch) => mapDocs((docs) => docs.map((d) => (d.id === id ? (typeof patch === "function" ? patch(d) : { ...d, ...patch }) : d))),
      updateLab: (docId, labId, patch) =>
        mapDocs((docs) =>
          docs.map((d) =>
            d.id === docId ? { ...d, extracted: { ...d.extracted, labs: d.extracted.labs?.map((l) => (l.id === labId ? { ...l, ...patch, edited: true } : l)) } } : d,
          ),
        ),
      updateMedication: (docId, medId, patch) =>
        mapDocs((docs) =>
          docs.map((d) =>
            d.id === docId ? { ...d, extracted: { ...d.extracted, medications: d.extracted.medications?.map((m) => (m.id === medId ? { ...m, ...patch, edited: true } : m)) } } : d,
          ),
        ),
      removeDocument: (id) => mapDocs((docs) => docs.filter((d) => d.id !== id)),
      mergeReference: ({ providers = [], conditions = [] }) =>
        setSnapshot((s) => ({
          ...s,
          providers: [...s.providers, ...providers.filter((p) => !s.providers.some((x) => x.id === p.id))],
          conditions: [...s.conditions, ...conditions.filter((c) => !s.conditions.some((x) => x.id === c.id))],
        })),
      resetDemo: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        setSnapshot(initial);
      },
    };
  }, [snapshot, hydrated, initial]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useHealth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useHealth must be used inside <HealthProvider>");
  return ctx;
}

export function useSnapshot() {
  return useHealth().snapshot;
}
