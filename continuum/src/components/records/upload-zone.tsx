"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, CloudUpload, Loader2, X } from "lucide-react";
import { STAGES, useUploads } from "@/components/providers/upload-manager";
import { useSnapshot } from "@/components/providers/health-store";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function UploadZone({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const { upload } = useUploads();
  const [over, setOver] = React.useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-all",
        over ? "border-accent bg-accent-soft/60 scale-[1.005]" : "border-ink-4/70 bg-surface/60 hover:border-ink-3 hover:bg-surface",
      )}
    >
      <div className={cn("flex size-11 items-center justify-center rounded-xl transition-colors", over ? "bg-accent text-white" : "bg-sunken text-ink-2")}>
        <CloudUpload className="size-5" strokeWidth={1.75} />
      </div>
      <div className="mt-4 text-[15px] font-medium text-ink">Drop your medical records here</div>
      <div className="mt-1 text-[13px] text-ink-3">PDF, JPG, PNG supported · multiple files at once</div>
      <div className="mt-4 flex items-center gap-3 text-[13px] text-ink-3">
        <span>or</span>
        <Button size="sm" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function UploadJobs() {
  const { jobs, dismiss } = useUploads();
  const s = useSnapshot();
  if (!jobs.length) return null;
  return (
    <div className="space-y-2">
      {jobs.map((j) => {
        const doc = s.documents.find((d) => d.id === j.id);
        const done = j.stage === STAGES.length - 1;
        const review = done && doc?.status === "needs_review";
        return (
          <div key={j.id} className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card animate-fade-up">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", j.error ? "bg-danger-soft text-danger" : review ? "bg-high-soft text-high" : done ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")}>
              {j.error ? <AlertTriangle className="size-4" /> : review ? <AlertTriangle className="size-4" /> : done ? <Check className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium text-ink">{done && doc ? doc.title : j.name}</div>
              <div className="mt-0.5 text-[12.5px]">
                {j.error ? (
                  <span className="text-danger">{j.error}</span>
                ) : done ? (
                  <span className={review ? "text-high" : "text-ok"}>{review ? "Ready · please review the extracted details" : "Ready · added to your timeline"}</span>
                ) : (
                  <span className="shimmer-text font-medium">{STAGES[j.stage]}</span>
                )}
              </div>
              {!done && !j.error && (
                <div className="mt-2 flex gap-1">
                  {STAGES.slice(0, -1).map((_, i) => (
                    <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", i < j.stage ? "bg-accent" : i === j.stage ? "bg-accent/40" : "bg-sunken")} />
                  ))}
                </div>
              )}
            </div>
            {done && doc && (
              <Button asChild size="sm" variant={review ? "primary" : "secondary"}>
                <Link href={`/records/${doc.id}`}>{review ? "Review" : "View"}</Link>
              </Button>
            )}
            {(done || j.error) && (
              <button onClick={() => dismiss(j.id)} className="rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
