import type { HealthSnapshot, MedicalDocument } from "@/lib/types";
import { formatValue, getBiomarker } from "./biomarkers";
import { flagFor, getProvider } from "./selectors";

/** Short, scannable detail lines for a document in lists (Home, Timeline). */
export function documentHighlights(s: HealthSnapshot, d: MedicalDocument, max = 3): { text: string; flag?: "high" | "low" }[] {
  const x = d.extracted;
  if (d.type === "lab_report" && x.labs?.length) {
    // Lead with abnormal results, then the panel's headline markers.
    const sorted = [...x.labs].sort((a, b) => Number(flagFor(b) !== "normal") - Number(flagFor(a) !== "normal"));
    return sorted.slice(0, max).map((l) => {
      const def = getBiomarker(l.biomarker);
      const f = flagFor(l);
      return { text: `${def?.shortName ?? l.name} ${formatValue(l.value, def?.decimals ?? 1)} ${l.unit}`, flag: f === "high" || f === "low" ? f : undefined };
    });
  }
  if (x.medications?.length) {
    return x.medications.slice(0, max).map((m) => ({ text: m.action === "stopped" ? `${m.drug} stopped` : `${m.drug} ${m.strength}${m.action === "dose_changed" ? " · dose changed" : ""}` }));
  }
  if (x.notes?.impression) return [{ text: x.notes.impression }];
  if (x.notes?.summary) return [{ text: x.notes.summary }];
  return [];
}

export function documentSubtitle(s: HealthSnapshot, d: MedicalDocument) {
  const clinician = getProvider(s, d.clinicianId);
  const facility = getProvider(s, d.providerId);
  if (clinician && facility && facility.name !== clinician.organization) return `${clinician.name} · ${facility.name}`;
  return clinician?.name ?? facility?.name ?? "";
}

/** Prefer the familiar name: "Cholecalciferol (Vitamin D3)" → "Vitamin D3". */
export function displayDrug(drug: string) {
  const m = drug.match(/^(.+?) \((.+)\)$/);
  return m ? m[2] : drug;
}
