"use client";

import * as React from "react";
import { Database, Download, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ageFrom, fmtDate } from "@/lib/health/selectors";

export default function SettingsPage() {
  const { snapshot: s, resetDemo } = useHealth();
  // The single-page build has no server to ask, so its status is known up front.
  const [status, setStatus] = React.useState<{ llm: boolean; model: string | null; database: boolean } | null>(() => (process.env.NEXT_PUBLIC_HOST === "artifact" ? { llm: false, model: null, database: false } : null));
  const [confirm, setConfirm] = React.useState(false);
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_HOST === "artifact") return;
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ llm: false, model: null, database: false }));
  }, []);
  const p = s.patient;
  const uploads = s.documents.filter((d) => d.source === "upload").length;
  const edits = s.documents.filter((d) => d.extracted.labs?.some((l) => l.edited) || d.extracted.medications?.some((m) => m.edited)).length;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(s, (k, v) => (k === "fileUrl" ? undefined : v), 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `continuum-${p.firstName.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Your account" title="Profile & Settings" subtitle="Your details, your data, and how healthly processes it." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 pb-5 text-[14px] sm:grid-cols-3">
            {[
              ["Name", `${p.firstName} ${p.lastName}`],
              ["Date of birth", `${fmtDate(p.dateOfBirth, "long")} (${ageFrom(p.dateOfBirth)})`],
              ["Blood group", p.bloodGroup ?? "—"],
              ["Height", `${p.heightCm} cm`],
              ["City", p.city],
              ["Phone", p.phone ?? "—"],
              ["Emergency contact", p.emergencyContact ?? "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] text-ink-3">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Processing services" description="healthly works without any connected service; connecting them improves extraction and answers." />
          <div className="divide-y divide-line-2 px-5 pb-2">
            <div className="flex items-center gap-4 py-3.5">
              <Sparkles className="size-4 text-accent" />
              <div className="flex-1">
                <div className="text-[14px] font-medium">AI extraction & answers</div>
                <div className="text-[12.5px] text-ink-3">{status?.llm ? `Claude (${status.model}) reads PDFs and scans, and writes answers grounded in your records.` : "Not connected. A local engine answers questions from your structured records; uploads use demo extraction."}</div>
              </div>
              <Badge tone={status?.llm ? "ok" : "neutral"}>{status ? (status.llm ? "Connected" : "Local") : "…"}</Badge>
            </div>
            <div className="flex items-center gap-4 py-3.5">
              <Database className="size-4 text-accent" />
              <div className="flex-1">
                <div className="text-[14px] font-medium">Record storage</div>
                <div className="text-[12.5px] text-ink-3">{status?.database ? "PostgreSQL via Prisma." : "Demo vault: base records are bundled; your uploads and corrections are stored in this browser only."}</div>
              </div>
              <Badge tone={status?.database ? "ok" : "neutral"}>{status ? (status.database ? "Postgres" : "Browser") : "…"}</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Your data" />
          <div className="space-y-4 px-5 pb-5">
            <p className="flex gap-2 text-[13.5px] text-ink-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" /> {s.documents.length} records · {uploads} uploaded by you · {edits} with your corrections. Nothing is shared without your action.
            </p>
            <div className="flex flex-wrap gap-2">
              {process.env.NEXT_PUBLIC_HOST !== "artifact" && (
                <Button onClick={exportJson}>
                  <Download /> Export all data (JSON)
                </Button>
              )}
              {!confirm ? (
                <Button variant="ghost" onClick={() => setConfirm(true)}>
                  <RotateCcw /> Reset demo data
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    resetDemo();
                    setConfirm(false);
                  }}
                >
                  Confirm reset (removes uploads & corrections)
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
