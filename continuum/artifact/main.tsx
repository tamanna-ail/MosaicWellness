"use client";

/** Entry for the single-file Artifact build: the full app on the demo vault, no server. */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "./router";
import { HealthProvider } from "@/components/providers/health-store";
import { UploadProvider } from "@/components/providers/upload-manager";
import { AppShell } from "@/components/shell/app-shell";
import { seedSnapshot } from "@/lib/data/seed";
import type { HealthSnapshot } from "@/lib/types";
import HomePage from "@/app/page";
import TimelinePage from "@/app/timeline/page";
import RecordsPage from "@/app/records/page";
import HealthPage from "@/app/health/page";
import MedicationsPage from "@/app/medications/page";
import AskPage from "@/app/ask/page";
import SummaryPage from "@/app/summary/page";
import SettingsPage from "@/app/settings/page";
import { RecordDetail } from "@/components/screens/record-detail";
import { BiomarkerDetail } from "@/components/screens/biomarker-detail";

/**
 * The public demo uses invented clinic and lab names so its sample reports
 * can't be mistaken for documents from real healthcare providers.
 */
const FICTIONAL_NAMES: [string, string][] = [
  ["Metropolis Healthcare", "Meridian Pathology"],
  ["Apollo Diagnostics", "Lotus Diagnostics"],
  ["Apollo Hospital", "Banyan Hospital"],
  ["SRL Diagnostics", "Riverbend Labs"],
  ["Sahyadri Hospital", "Deccan Care Hospital"],
  ["Manipal Radiology", "Clearview Imaging"],
];

function demoSnapshot(): HealthSnapshot {
  let json = JSON.stringify(seedSnapshot);
  for (const [real, demo] of FICTIONAL_NAMES) json = json.split(real).join(demo);
  return JSON.parse(json);
}

function Screen({ pathname }: { pathname: string }) {
  const record = pathname.match(/^\/records\/(.+)$/);
  if (record) return <RecordDetail id={decodeURIComponent(record[1])} />;
  const marker = pathname.match(/^\/health\/(.+)$/);
  if (marker) return <BiomarkerDetail code={decodeURIComponent(marker[1])} />;
  switch (pathname) {
    case "/timeline":
      return <TimelinePage />;
    case "/records":
      return <RecordsPage />;
    case "/health":
      return <HealthPage />;
    case "/medications":
      return <MedicationsPage />;
    case "/ask":
      return <AskPage />;
    case "/summary":
      return <SummaryPage />;
    case "/settings":
      return <SettingsPage />;
    default:
      return <HomePage />;
  }
}

const initial = demoSnapshot();

function App() {
  return (
    <MemoryRouter>
      {(loc) => (
        <HealthProvider initial={initial}>
          <UploadProvider>
            <AppShell dataSource="demo">
              <Screen key={`${loc.pathname}?${loc.search}`} pathname={loc.pathname} />
            </AppShell>
          </UploadProvider>
        </HealthProvider>
      )}
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
