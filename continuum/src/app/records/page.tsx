"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Plus, Search } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { UploadJobs, UploadZone } from "@/components/records/upload-zone";
import { DocTypeIcon, FileGlyph } from "@/components/health/bits";
import { Button, EmptyState, Input, PageHeader, Segmented } from "@/components/ui/primitives";
import { StatusPill } from "@/components/records/status-pill";
import { DOC_TYPE_LABEL, documentFacilityName, documentSourceName, fmtDate, searchRecords } from "@/lib/health/selectors";
import type { DocumentType, MedicalDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "lab" | "rx" | "consult" | "imaging" | "hospital" | "review";
const FILTER_TYPES: Record<Exclude<Filter, "all" | "review">, DocumentType[]> = {
  lab: ["lab_report"],
  rx: ["prescription"],
  consult: ["consultation"],
  imaging: ["imaging"],
  hospital: ["discharge_summary", "procedure"],
};
type Sort = "newest" | "oldest" | "uploaded";

export default function RecordsPage() {
  return (
    <React.Suspense>
      <Records />
    </React.Suspense>
  );
}

function Records() {
  const s = useSnapshot();
  const router = useRouter();
  const params = useSearchParams();
  const [filter, setFilter] = React.useState<Filter>(params.get("status") === "review" ? "review" : "all");
  const [sort, setSort] = React.useState<Sort>("newest");
  const [q, setQ] = React.useState("");
  const [showUpload, setShowUpload] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const matches = (d: MedicalDocument) => (filter === "all" ? true : filter === "review" ? d.status === "needs_review" : FILTER_TYPES[filter].includes(d.type));
  let docs = q.trim() ? searchRecords(s, q).map((h) => h.document) : [...s.documents];
  docs = docs.filter(matches);
  if (!q.trim())
    docs.sort((a, b) => (sort === "newest" ? b.clinicalDate.localeCompare(a.clinicalDate) : sort === "oldest" ? a.clinicalDate.localeCompare(b.clinicalDate) : b.uploadedAt.localeCompare(a.uploadedAt)));

  const count = (f: Filter) => s.documents.filter((d) => (f === "all" ? true : f === "review" ? d.status === "needs_review" : FILTER_TYPES[f].includes(d.type))).length;
  const reviewCount = count("review");

  const options: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: count("all") },
    { value: "lab", label: "Lab Reports", count: count("lab") },
    { value: "rx", label: "Prescriptions", count: count("rx") },
    { value: "consult", label: "Consultations", count: count("consult") },
    { value: "imaging", label: "Imaging", count: count("imaging") },
    { value: "hospital", label: "Hospital Records", count: count("hospital") },
    ...(reviewCount ? [{ value: "review" as Filter, label: "Needs review", count: reviewCount }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Medical Records"
        subtitle="All your health documents in one place."
        actions={
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setShowUpload(true);
              setTimeout(() => inputRef.current?.click(), 0);
            }}
          >
            <Plus /> Add Records
          </Button>
        }
      />

      <div className="space-y-3">
        {(showUpload || s.documents.length === 0) && <UploadZone inputRef={inputRef} />}
        {!showUpload && s.documents.length > 0 && (
          <div
            onDragEnter={() => setShowUpload(true)}
            className="flex items-center justify-between rounded-2xl border border-dashed border-ink-4/70 bg-surface/50 px-5 py-3.5 text-[13px] text-ink-3"
          >
            <span>Drop PDF, JPG or PNG files anywhere here to add them to your vault.</span>
            <button className="font-medium text-ink-2 hover:text-ink" onClick={() => setShowUpload(true)}>
              Open uploader
            </button>
          </div>
        )}
        <UploadJobs />
      </div>

      <div className="mt-8 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Segmented options={options} value={filter} onChange={setFilter} size="sm" />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 xl:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records..." className="pl-9" />
          </div>
          <label className="relative">
            <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 appearance-none rounded-lg border border-line bg-surface pl-8 pr-3 text-[13px] text-ink-2 outline-none focus:border-accent/50"
              aria-label="Sort records"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="uploaded">Recently uploaded</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_110px] gap-4 border-b border-line-2 bg-surface-2 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-3 md:grid">
          <div>Document Name</div>
          <div>Type</div>
          <div>Clinical Date</div>
          <div>Provider</div>
          <div>Status</div>
        </div>
        {docs.map((d) => (
          <button
            key={d.id}
            onClick={() => router.push(`/records/${d.id}`)}
            className="grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-line-2 px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_110px] md:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-surface-2 text-ink-3">
                <FileGlyph mimeType={d.mimeType} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">{d.fileName}</div>
                <div className="truncate text-[12px] text-ink-3">
                  {d.title}
                  {d.source === "upload" && <span className="ml-1.5 text-accent">· New</span>}
                </div>
              </div>
            </div>
            <div className="md:hidden">
              <StatusPill status={d.status} />
            </div>
            <div className="hidden items-center gap-2 text-[13px] text-ink-2 md:flex">
              <DocTypeIcon type={d.type} className="size-3.5 text-ink-3" />
              {d.status === "processing" ? "—" : DOC_TYPE_LABEL[d.type]}
            </div>
            <div className="text-[13px] tabular text-ink-2 max-md:col-span-2 max-md:pl-12 max-md:text-[12px] max-md:text-ink-3">
              {d.status === "processing" ? "—" : fmtDate(d.clinicalDate)}
              <span className="md:hidden"> · {documentSourceName(s, d)}</span>
            </div>
            <div className="hidden truncate text-[13px] text-ink-2 md:block">{d.status === "processing" ? "—" : d.type === "prescription" || d.type === "consultation" ? documentSourceName(s, d) : documentFacilityName(s, d)}</div>
            <div className={cn("hidden md:block")}>
              <StatusPill status={d.status} />
            </div>
          </button>
        ))}
        {!docs.length && <EmptyState icon={<Search />} title="No records found" body={q ? `Nothing matches “${q}”.` : "No documents in this category yet."} />}
      </div>
      <div className="mt-3 text-[12px] text-ink-3">
        {docs.length} of {s.documents.length} documents
      </div>
    </div>
  );
}
