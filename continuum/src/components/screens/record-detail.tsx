"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Cpu, FileWarning, PencilLine, ShieldCheck, Trash2 } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { DocumentReplica } from "@/components/records/document-replica";
import { ExtractedView } from "@/components/records/extracted-view";
import { StatusPill } from "@/components/records/status-pill";
import { ConfidenceMeter, DocTypeIcon, FileGlyph, FlagBadge, SectionLabel } from "@/components/health/bits";
import { Button, EmptyState, Input } from "@/components/ui/primitives";
import { getBiomarker } from "@/lib/health/biomarkers";
import { DOC_TYPE_LABEL, documentFacilityName, flagFor, fmtDate, getDocument, getProvider } from "@/lib/health/selectors";
import type { DocumentType, MedicalDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES = Object.entries(DOC_TYPE_LABEL) as [DocumentType, string][];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-3 py-2.5 sm:grid-cols-[140px_1fr]">
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className="min-w-0 text-[14px] text-ink">{children}</div>
    </div>
  );
}

function OriginalPreview({ doc }: { doc: MedicalDocument }) {
  const { snapshot } = useHealth();
  if (doc.source === "seed") return <DocumentReplica doc={doc} s={snapshot} />;
  if (doc.fileUrl && doc.mimeType === "application/pdf") return <iframe src={doc.fileUrl} title={doc.fileName} className="h-[78vh] w-full rounded-xl border border-line bg-white" />;
  if (doc.fileUrl && doc.mimeType.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied data/object URL
    return <img src={doc.fileUrl} alt={doc.fileName} className="mx-auto max-h-[78vh] rounded-xl border border-line bg-white object-contain shadow-card" />;
  }
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface">
      <EmptyState icon={<FileWarning />} title="Original file not available in this browser" body="Large files are kept only for the session in the demo vault. The extracted information is saved." />
    </div>
  );
}

export function RecordDetail({ id }: { id: string }) {
  const router = useRouter();
  const { snapshot: s, updateDocument, removeDocument, hydrated } = useHealth();
  const doc = getDocument(s, id);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<MedicalDocument | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    // Uploads that need review open straight into review mode.
    if (doc?.status === "needs_review" && !editing && !draft) startEdit();
  }, [doc?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) {
    return hydrated ? (
      <EmptyState
        icon={<FileWarning />}
        title="Record not found"
        body="It may have been removed."
        action={
          <Button asChild>
            <Link href="/records">Back to records</Link>
          </Button>
        }
      />
    ) : null;
  }

  function startEdit() {
    setDraft(structuredClone(doc!));
    setEditing(true);
    setSaved(false);
  }
  function save() {
    if (!draft) return;
    const orig = doc!;
    const labs = draft.extracted.labs?.map((l) => {
      const o = orig.extracted.labs?.find((x) => x.id === l.id);
      const changed = o && (o.value !== l.value || o.unit !== l.unit || o.refLow !== l.refLow || o.refHigh !== l.refHigh);
      const refText = changed && (l.refLow !== undefined || l.refHigh !== undefined) ? (l.refLow !== undefined && l.refHigh !== undefined ? `${l.refLow} – ${l.refHigh}` : l.refHigh !== undefined ? `< ${l.refHigh}` : `> ${l.refLow}`) : l.refText;
      return changed ? { ...l, refText, edited: true } : l;
    });
    const medications = draft.extracted.medications?.map((m) => {
      const o = orig.extracted.medications?.find((x) => x.id === m.id);
      return o && (o.strength !== m.strength || o.frequency !== m.frequency || o.drug !== m.drug) ? { ...m, edited: true } : m;
    });
    updateDocument(orig.id, { ...draft, extracted: { ...draft.extracted, labs, medications }, status: "processed", reviewedAt: new Date().toISOString() });
    setEditing(false);
    setDraft(null);
    setSaved(true);
  }

  const d = editing && draft ? draft : doc;
  const setLab = (labId: string, patch: Record<string, unknown>) => setDraft((x) => x && { ...x, extracted: { ...x.extracted, labs: x.extracted.labs?.map((l) => (l.id === labId ? { ...l, ...patch } : l)) } });
  const setMed = (medId: string, patch: Record<string, unknown>) => setDraft((x) => x && { ...x, extracted: { ...x.extracted, medications: x.extracted.medications?.map((m) => (m.id === medId ? { ...m, ...patch } : m)) } });
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const warnings = doc.extracted.notes?.extractionWarnings;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.back()}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex items-center gap-2">
          <StatusPill status={doc.status} />
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-2 animate-fade-up">
        <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <FileGlyph mimeType={doc.mimeType} className="size-3.5" />
          {doc.fileName}
        </div>
        <h1 className="font-serif text-[36px] leading-tight text-ink">{doc.title}</h1>
        <div className="text-[14px] text-ink-2">
          {fmtDate(doc.clinicalDate, "long")} · {getProvider(s, doc.clinicianId)?.name ?? documentFacilityName(s, doc)}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* LEFT — original */}
        <section className="min-w-0">
          <SectionLabel className="mb-3">Original document</SectionLabel>
          <div className="rounded-2xl bg-sunken/70 p-4 ring-1 ring-line-2 sm:p-6 xl:sticky xl:top-8">
            <OriginalPreview doc={doc} />
          </div>
        </section>

        {/* RIGHT — extracted */}
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Extracted information</SectionLabel>
            {!editing && (
              <Button size="sm" variant="ghost" onClick={startEdit} className="-mr-2">
                <PencilLine /> Review extracted information
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface shadow-card">
            {/* Trust strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line-2 px-5 py-3.5">
              <span className="flex items-center gap-2 text-[12.5px] text-ink-3">
                Extraction confidence <ConfidenceMeter value={doc.confidence} />
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <Cpu className="size-3.5" />
                {doc.extractionEngine ?? "Clinical extraction"}
              </span>
              {doc.reviewedAt && (
                <span className="flex items-center gap-1.5 text-[12px] text-ok">
                  <ShieldCheck className="size-3.5" /> Reviewed by you
                </span>
              )}
            </div>

            {(doc.status === "needs_review" || warnings?.length) && (
              <div className="mx-5 mt-4 rounded-xl bg-high-soft px-4 py-3 text-[13px] text-high ring-1 ring-high/10">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" /> Please check these details against the original
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[12.5px]">
                  {doc.status === "needs_review" && <li>Confidence is below 90%, so this record isn’t used in trends or AI answers until you confirm it.</li>}
                  {warnings?.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {saved && (
              <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-2.5 text-[13px] text-ok animate-fade-in">
                <Check className="size-4" /> Saved. Your timeline, trends and AI answers now use the corrected values.
              </div>
            )}

            <div className="px-5 pb-2 pt-2">
              <Field label="Document Type">
                {editing ? (
                  <select value={d.type} onChange={(e) => setDraft((x) => x && { ...x, type: e.target.value as DocumentType })} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13.5px]">
                    {TYPES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <DocTypeIcon type={d.type} className="text-ink-3" />
                    {DOC_TYPE_LABEL[d.type]}
                  </span>
                )}
              </Field>
              {editing && (
                <Field label="Title">
                  <Input value={d.title} onChange={(e) => setDraft((x) => x && { ...x, title: e.target.value })} className="h-8" />
                </Field>
              )}
              <Field label="Clinical Date">
                {editing ? <Input type="date" value={d.clinicalDate} onChange={(e) => setDraft((x) => x && { ...x, clinicalDate: e.target.value })} className="h-8 w-44" /> : fmtDate(d.clinicalDate, "long")}
              </Field>
              <Field label="Provider">{documentFacilityName(s, d)}</Field>
              {getProvider(s, d.clinicianId) && <Field label="Doctor">{getProvider(s, d.clinicianId)!.name}</Field>}
            </div>

            <div className="border-t border-line-2 px-5 py-5">
              {editing ? (
                <div className="space-y-6">
                  {!!d.extracted.labs?.length && (
                    <div>
                      <SectionLabel className="mb-2">Tests</SectionLabel>
                      <div className="space-y-2">
                        {d.extracted.labs.map((l) => {
                          const def = getBiomarker(l.biomarker);
                          return (
                            <div key={l.id} className="rounded-xl border border-line p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-[13.5px] font-medium">{def?.shortName ?? l.name}</span>
                                <FlagBadge flag={flagFor(l)} />
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <label className="text-[11px] text-ink-3">
                                  Result
                                  <Input type="number" step="any" value={l.value} onChange={(e) => setLab(l.id, { value: Number(e.target.value) })} className="mt-1 h-8 tabular" />
                                </label>
                                <label className="text-[11px] text-ink-3">
                                  Unit
                                  <Input value={l.unit} onChange={(e) => setLab(l.id, { unit: e.target.value })} className="mt-1 h-8" />
                                </label>
                                <label className="text-[11px] text-ink-3">
                                  Ref. low
                                  <Input type="number" step="any" value={l.refLow ?? ""} onChange={(e) => setLab(l.id, { refLow: num(e.target.value) })} className="mt-1 h-8 tabular" />
                                </label>
                                <label className="text-[11px] text-ink-3">
                                  Ref. high
                                  <Input type="number" step="any" value={l.refHigh ?? ""} onChange={(e) => setLab(l.id, { refHigh: num(e.target.value) })} className="mt-1 h-8 tabular" />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!!d.extracted.medications?.length && (
                    <div>
                      <SectionLabel className="mb-2">Medications</SectionLabel>
                      <div className="space-y-2">
                        {d.extracted.medications.map((m) => (
                          <div key={m.id} className="grid grid-cols-3 gap-2 rounded-xl border border-line p-3">
                            <label className="text-[11px] text-ink-3">
                              Medicine
                              <Input value={m.drug} onChange={(e) => setMed(m.id, { drug: e.target.value })} className="mt-1 h-8" />
                            </label>
                            <label className="text-[11px] text-ink-3">
                              Strength
                              <Input value={m.strength} onChange={(e) => setMed(m.id, { strength: e.target.value })} className="mt-1 h-8" />
                            </label>
                            <label className="text-[11px] text-ink-3">
                              Frequency
                              <Input value={m.frequency} onChange={(e) => setMed(m.id, { frequency: e.target.value })} className="mt-1 h-8" />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!d.extracted.labs?.length && !d.extracted.medications?.length && <ExtractedView doc={d} compact />}
                </div>
              ) : (
                <ExtractedView doc={d} />
              )}
            </div>

            {editing && (
              <div className="flex items-center justify-between gap-3 border-t border-line-2 bg-surface-2 px-5 py-4">
                <span className="text-[12px] text-ink-3">Corrections are marked and kept alongside the original.</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setDraft(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={save}>
                    <Check /> {doc.status === "needs_review" ? "Confirm & add to history" : "Save changes"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {doc.source === "upload" && (
            <button
              onClick={() => {
                removeDocument(doc.id);
                router.push("/records");
              }}
              className={cn("mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-danger")}
            >
              <Trash2 className="size-3.5" /> Remove this record
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
