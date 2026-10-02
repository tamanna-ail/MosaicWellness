"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, UserRound } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";
import { FileGlyph } from "@/components/health/bits";
import { DocTile } from "@/components/ui/icon-tile";
import { DOC_TYPE_LABEL, documentFacilityName, fmtDate, getDocument, getProvider } from "@/lib/health/selectors";
import { ExtractedView } from "./extracted-view";

/** Quick look at a record without leaving the current screen. */
export function DocumentDrawer({ documentId, onClose }: { documentId: string | null; onClose: () => void }) {
  const s = useSnapshot();
  const doc = documentId ? getDocument(s, documentId) : undefined;
  const clinician = getProvider(s, doc?.clinicianId);

  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && onClose()} title={doc?.title ?? "Record"}>
      {doc && (
        <>
          <div className="border-b border-line-2 px-6 pb-5 pt-6">
            <div className="flex items-center gap-3 text-[12.5px] font-medium text-ink-3">
              <DocTile type={doc.type} size="sm" />
              {DOC_TYPE_LABEL[doc.type]}
            </div>
            <h2 className="mt-3 pr-8 font-serif text-[32px] font-semibold leading-tight text-ink">{doc.title}</h2>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-ink-3" />
                {fmtDate(doc.clinicalDate, "long")}
              </span>
              {clinician && (
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="size-3.5 text-ink-3" />
                  {clinician.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-ink-3" />
                {documentFacilityName(s, doc)}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <ExtractedView doc={doc} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line-2 bg-surface-2 px-6 py-4">
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-3">
              <FileGlyph mimeType={doc.mimeType} className="size-3.5 shrink-0" />
              <span className="truncate">{doc.fileName}</span>
            </span>
            <Button asChild variant="primary" size="sm">
              <Link href={`/records/${doc.id}`} onClick={onClose}>
                View original <ArrowRight />
              </Link>
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
