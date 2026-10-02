"use client";

/**
 * Runs uploads through the processing pipeline and reports stage progress.
 * Lives above the routes so processing continues while the user navigates.
 */
import * as React from "react";
import { useHealth } from "./health-store";
import { toDocument } from "@/lib/processing/to-document";
import type { ExtractionResult } from "@/lib/processing/types";
import { demoExtract } from "@/lib/processing/demo-extractor";
import { todayISO } from "@/lib/health/selectors";

export const STAGES = ["Uploading...", "Reading document...", "Extracting medical information...", "Organizing your health history...", "Ready"] as const;

export interface UploadJob {
  id: string;
  name: string;
  size: number;
  stage: number; // index into STAGES
  error?: string;
}

const Ctx = React.createContext<{ jobs: UploadJob[]; upload: (files: File[]) => void; dismiss: (id: string) => void } | null>(null);

class RejectedFile extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const health = useHealth();
  const healthRef = React.useRef(health);
  React.useEffect(() => {
    healthRef.current = health;
  });
  const [jobs, setJobs] = React.useState<UploadJob[]>([]);

  const setStage = (id: string, stage: number, error?: string) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, stage, error } : j)));

  const run = React.useCallback(async (file: File) => {
    const id = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const uploadedAt = new Date().toISOString();
    setJobs((js) => [{ id, name: file.name, size: file.size, stage: 0 }, ...js]);

    if (!ACCEPTED.includes(file.type)) {
      setStage(id, 0, "Unsupported file type. Use PDF, JPG or PNG.");
      return;
    }

    // Small files are kept inline so the original survives a reload in the demo vault.
    const fileUrl = file.size < 1_000_000 ? await readAsDataUrl(file) : URL.createObjectURL(file);
    healthRef.current.addDocument({
      id,
      fileName: file.name,
      mimeType: file.type,
      type: "consultation",
      title: file.name.replace(/\.[a-z]+$/i, "").replace(/[_-]+/g, " "),
      clinicalDate: todayISO(),
      uploadedAt,
      status: "processing",
      confidence: 0,
      pages: 1,
      source: "upload",
      fileUrl,
      extracted: {},
    });

    await sleep(650);
    setStage(id, 1);
    const body = new FormData();
    body.append("file", file);
    // A static single-page build has no processing service; extract on-device straight away.
    const request = process.env.NEXT_PUBLIC_HOST === "artifact" ? Promise.resolve(demoExtract(file.name, file.type)) : fetch("/api/extract", { method: "POST", body })
      .then(async (r) => {
        if (r.status === 413 || r.status === 400) throw new RejectedFile((await r.json().catch(() => null))?.error ?? "This file couldn't be processed");
        if (!r.ok) throw new Error("service unavailable");
        return (await r.json()) as ExtractionResult;
      })
      // If the processing service is unreachable (e.g. a static host), use the on-device demo extractor rather than failing.
      .catch((e) => (e instanceof RejectedFile ? Promise.reject(e) : demoExtract(file.name, file.type)));
    await sleep(900);
    setStage(id, 2);
    let result: ExtractionResult;
    try {
      [result] = await Promise.all([request, sleep(1100)]);
    } catch (e) {
      setStage(id, 2, e instanceof Error ? e.message : "Extraction failed");
      healthRef.current.updateDocument(id, { status: "failed" });
      return;
    }
    setStage(id, 3);
    await sleep(700);
    const { document, providers, conditions } = toDocument(healthRef.current.snapshot, result, { id, name: file.name, type: file.type, fileUrl, uploadedAt });
    healthRef.current.mergeReference({ providers, conditions });
    healthRef.current.updateDocument(id, document);
    setStage(id, 4);
  }, []);

  const value = React.useMemo(
    () => ({
      jobs,
      upload: (files: File[]) => files.forEach((f, i) => setTimeout(() => void run(f), i * 250)),
      dismiss: (id: string) => setJobs((js) => js.filter((j) => j.id !== id)),
    }),
    [jobs, run],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUploads() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useUploads must be used inside <UploadProvider>");
  return ctx;
}
