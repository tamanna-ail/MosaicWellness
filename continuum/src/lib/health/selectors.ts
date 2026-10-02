/**
 * Pure read-model functions over a HealthSnapshot. No React, no I/O, so
 * the same logic powers the UI, the AI retrieval engine and the server.
 */
import type {
  AllergyEntry,
  Condition,
  DocumentType,
  Flag,
  HealthSnapshot,
  LabResult,
  MedicalDocument,
  MedicationOrder,
  Provider,
  VitalSign,
} from "@/lib/types";
import { BIOMARKER_ORDER, getBiomarker, toCanonical, type BiomarkerDef } from "./biomarkers";

// ---------- documents & providers ----------

export function byDateDesc<T extends { date: string }>(a: T, b: T) {
  return b.date.localeCompare(a.date);
}

export function sortedDocuments(s: HealthSnapshot, order: "desc" | "asc" = "desc") {
  return [...s.documents].sort((a, b) =>
    order === "desc"
      ? b.clinicalDate.localeCompare(a.clinicalDate) || b.uploadedAt.localeCompare(a.uploadedAt)
      : a.clinicalDate.localeCompare(b.clinicalDate) || a.uploadedAt.localeCompare(b.uploadedAt),
  );
}

export function getDocument(s: HealthSnapshot, id: string) {
  return s.documents.find((d) => d.id === id);
}

export function getProvider(s: HealthSnapshot, id?: string): Provider | undefined {
  return id ? s.providers.find((p) => p.id === id) : undefined;
}

/** Human "who" for a document: the clinician when there is one, otherwise the facility. */
export function documentSourceName(s: HealthSnapshot, d: MedicalDocument) {
  return getProvider(s, d.clinicianId)?.name ?? getProvider(s, d.providerId)?.name ?? "Unknown provider";
}

export function documentFacilityName(s: HealthSnapshot, d: MedicalDocument) {
  return getProvider(s, d.providerId)?.name ?? getProvider(s, d.clinicianId)?.organization ?? "—";
}

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  lab_report: "Lab Report",
  prescription: "Prescription",
  consultation: "Consultation",
  imaging: "Imaging",
  discharge_summary: "Discharge Summary",
  procedure: "Procedure",
};

/** Only confirmed records feed trends, medication history and AI answers. */
export function isUsable(d: MedicalDocument) {
  return d.status === "processed";
}

// ---------- timeline ----------

export type TimelineCategory = "consultation" | "diagnostic" | "medication" | "hospitalization" | "procedure";

export const TIMELINE_CATEGORY: Record<DocumentType, TimelineCategory> = {
  lab_report: "diagnostic",
  imaging: "diagnostic",
  prescription: "medication",
  consultation: "consultation",
  discharge_summary: "hospitalization",
  procedure: "procedure",
};

export const TIMELINE_LABEL: Record<TimelineCategory, string> = {
  consultation: "Consultation",
  diagnostic: "Diagnostic",
  medication: "Prescription",
  hospitalization: "Hospitalization",
  procedure: "Procedure",
};

// ---------- lab results ----------

export interface LabPoint extends LabResult {
  documentId: string;
  documentTitle: string;
  date: string;
  providerId?: string;
  flag: Flag;
  /** Value expressed in the biomarker's canonical unit, or null if no safe conversion exists. */
  canonicalValue: number | null;
  converted: boolean;
}

export function flagFor(l: Pick<LabResult, "value" | "refLow" | "refHigh">): Flag {
  if (l.refLow === undefined && l.refHigh === undefined) return "unknown";
  if (l.refLow !== undefined && l.value < l.refLow) return "low";
  if (l.refHigh !== undefined && l.value > l.refHigh) return "high";
  return "normal";
}

export function allLabPoints(s: HealthSnapshot): LabPoint[] {
  const out: LabPoint[] = [];
  for (const d of s.documents) {
    if (!isUsable(d)) continue;
    for (const l of d.extracted.labs ?? []) {
      const def = getBiomarker(l.biomarker);
      const canonical = def ? toCanonical(def, l.value, l.unit) : l.value;
      out.push({
        ...l,
        documentId: d.id,
        documentTitle: d.title,
        date: d.clinicalDate,
        providerId: d.providerId,
        flag: flagFor(l),
        canonicalValue: canonical,
        converted: !!def && canonical !== null && canonical !== l.value,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface BiomarkerSeries {
  def: BiomarkerDef;
  /** Comparable points, ascending by date, all in canonical unit. */
  points: LabPoint[];
  /** Results that could not be safely converted and are therefore not plotted. */
  excluded: LabPoint[];
  latest?: LabPoint;
  previous?: LabPoint;
  changePct?: number;
}

export function biomarkerSeries(s: HealthSnapshot, code: string, all = allLabPoints(s)): BiomarkerSeries | undefined {
  const def = getBiomarker(code);
  if (!def) return undefined;
  const mine = all.filter((p) => p.biomarker === def.code);
  const points = mine.filter((p) => p.canonicalValue !== null);
  const excluded = mine.filter((p) => p.canonicalValue === null);
  const latest = points.at(-1);
  const previous = points.at(-2);
  const changePct =
    latest && previous && previous.canonicalValue ? ((latest.canonicalValue! - previous.canonicalValue) / previous.canonicalValue) * 100 : undefined;
  return { def, points, excluded, latest, previous, changePct };
}

export function allBiomarkerSeries(s: HealthSnapshot) {
  const all = allLabPoints(s);
  const codes = new Set(all.map((p) => p.biomarker));
  const ordered = [...BIOMARKER_ORDER.filter((c) => codes.has(c)), ...[...codes].filter((c) => !BIOMARKER_ORDER.includes(c))];
  return ordered.map((c) => biomarkerSeries(s, c, all)).filter((x): x is BiomarkerSeries => !!x && x.points.length + x.excluded.length > 0);
}

// ---------- medications ----------

export interface MedicationEvent extends MedicationOrder {
  documentId: string;
  date: string;
  prescriberId?: string;
}

export interface MedicationCourse {
  key: string;
  drug: string;
  drugClass: string;
  events: MedicationEvent[]; // ascending
  current: MedicationEvent; // latest event
  firstDate: string;
  active: boolean;
  longTerm: boolean;
  endDate?: string;
  startedEvent: MedicationEvent;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function medicationEvents(s: HealthSnapshot): MedicationEvent[] {
  const out: MedicationEvent[] = [];
  for (const d of s.documents) {
    if (!isUsable(d)) continue;
    for (const m of d.extracted.medications ?? []) {
      out.push({ ...m, documentId: d.id, date: d.clinicalDate, prescriberId: d.clinicianId });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const drugKey = (drug: string) => drug.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, "");

/**
 * Groups orders into courses. A long-term drug is one course across its
 * dose changes; repeated short courses (e.g. three azithromycin courses)
 * become separate episodes so history stays honest.
 */
export function medicationCourses(s: HealthSnapshot, today = todayISO()): MedicationCourse[] {
  const groups = new Map<string, MedicationEvent[][]>();
  for (const e of medicationEvents(s)) {
    const key = drugKey(e.drug);
    const episodes = groups.get(key) ?? [];
    const last = episodes.at(-1);
    const lastEvent = last?.at(-1);
    const lastIsOpen = lastEvent && (lastEvent.durationDays === undefined && lastEvent.action !== "stopped");
    const sameEpisode = last && lastEvent && (lastIsOpen || e.action === "stopped" || (lastEvent.durationDays !== undefined && e.date <= addDays(lastEvent.date, lastEvent.durationDays + 3)));
    if (sameEpisode) last.push(e);
    else episodes.push([e]);
    groups.set(key, episodes);
  }

  const courses: MedicationCourse[] = [];
  for (const [key, episodes] of groups) {
    episodes.forEach((events, i) => {
      const current = events.at(-1)!;
      const longTerm = current.durationDays === undefined && current.action !== "stopped";
      const endDate = current.action === "stopped" ? current.date : current.durationDays !== undefined ? addDays(current.date, current.durationDays) : undefined;
      const active = longTerm || (endDate !== undefined && endDate >= today && current.action !== "stopped");
      const startedEvent = events.find((e) => e.action !== "stopped") ?? events[0];
      courses.push({
        key: `${key}_${i}`,
        drug: startedEvent.drug,
        drugClass: startedEvent.drugClass,
        events,
        current: current.action === "stopped" ? { ...startedEvent, ...current, strength: startedEvent.strength } : current,
        firstDate: events[0].date,
        active,
        longTerm,
        endDate,
        startedEvent,
      });
    });
  }
  return courses.sort((a, b) => b.current.date.localeCompare(a.current.date));
}

export function activeMedications(s: HealthSnapshot) {
  return medicationCourses(s).filter((c) => c.active);
}

// ---------- conditions ----------

export interface ConditionSummary {
  condition: Condition;
  firstRecorded?: string;
  lastRecorded?: string;
  documentIds: string[];
  medications: string[];
  episodes: { date: string; documentId: string; label: string; confirmed: boolean }[];
}

export function conditionSummaries(s: HealthSnapshot): ConditionSummary[] {
  return s.conditions
    .map((condition) => {
      const docIds = new Set<string>();
      const episodes: ConditionSummary["episodes"] = [];
      const meds = new Set<string>();
      for (const d of sortedDocuments(s, "asc").filter(isUsable)) {
        for (const dx of d.extracted.diagnoses ?? []) {
          if (dx.conditionId === condition.id && dx.certainty !== "ruled_out") {
            docIds.add(d.id);
            episodes.push({ date: d.clinicalDate, documentId: d.id, label: dx.label, confirmed: dx.certainty === "confirmed" });
          }
        }
        for (const m of d.extracted.medications ?? []) {
          if (m.reasonConditionId === condition.id) {
            docIds.add(d.id);
            if (m.action !== "stopped") meds.add(m.drug);
          }
        }
      }
      // A provisional mention ("likely…") is part of the history but isn't when the diagnosis was made.
      const confirmed = episodes.find((e) => e.confirmed) ?? episodes[0];
      return {
        condition,
        firstRecorded: confirmed?.date,
        lastRecorded: episodes.at(-1)?.date,
        documentIds: [...docIds],
        medications: [...meds],
        episodes,
      };
    })
    .filter((c) => c.episodes.length > 0)
    .sort((a, b) => (a.condition.status === b.condition.status ? (b.lastRecorded ?? "").localeCompare(a.lastRecorded ?? "") : a.condition.status === "active" ? -1 : 1));
}

// ---------- allergies & vitals ----------

export interface AllergyRecord extends AllergyEntry {
  documentId: string;
  date: string;
}

export function allergies(s: HealthSnapshot): AllergyRecord[] {
  const seen = new Map<string, AllergyRecord>();
  for (const d of sortedDocuments(s, "asc").filter(isUsable)) {
    for (const a of d.extracted.allergies ?? []) {
      const k = a.substance.toLowerCase();
      if (!seen.has(k)) seen.set(k, { ...a, documentId: d.id, date: d.clinicalDate });
    }
  }
  return [...seen.values()];
}

export interface VitalPoint extends VitalSign {
  documentId: string;
  date: string;
}

export function vitalSeries(s: HealthSnapshot, kind: VitalSign["kind"]): VitalPoint[] {
  const out: VitalPoint[] = [];
  for (const d of s.documents.filter(isUsable)) for (const v of d.extracted.vitals ?? []) if (v.kind === kind) out.push({ ...v, documentId: d.id, date: d.clinicalDate });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- search ----------

export interface SearchHit {
  document: MedicalDocument;
  matches: string[];
  score: number;
}

export function searchRecords(s: HealthSnapshot, query: string): SearchHit[] {
  const terms = query.toLowerCase().replace(/dr\.?\s*/g, "").split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  for (const d of s.documents) {
    const fields: [string, string, number][] = [
      ["title", d.title, 3],
      ["file", d.fileName, 1],
      ["provider", getProvider(s, d.providerId)?.name ?? "", 2],
      ["doctor", getProvider(s, d.clinicianId)?.name ?? "", 3],
      ...(d.extracted.labs ?? []).map((l) => ["lab", `${l.name} ${l.biomarker} ${getBiomarker(l.biomarker)?.aliases.join(" ") ?? ""}|${l.name} ${l.value} ${l.unit}`, 3] as [string, string, number]),
      ...(d.extracted.medications ?? []).map((m) => ["medication", `${m.drug} ${m.brand ?? ""} ${m.drugClass}|${m.drug} ${m.strength}`, 3] as [string, string, number]),
      ...(d.extracted.diagnoses ?? []).map((x) => ["diagnosis", `${x.label} ${s.conditions.find((c) => c.id === x.conditionId)?.name ?? ""}|${x.label}`, 3] as [string, string, number]),
      ...(d.extracted.allergies ?? []).map((a) => ["allergy", `${a.substance} allergy|${a.substance} allergy`, 3] as [string, string, number]),
      ["notes", [d.extracted.notes?.summary, d.extracted.notes?.impression, ...(d.extracted.notes?.findings ?? [])].filter(Boolean).join(" "), 1],
    ];
    let score = 0;
    const matches = new Set<string>();
    for (const t of terms) {
      let termHit = false;
      for (const [, text, weight] of fields) {
        const [haystack, display] = text.includes("|") ? text.split("|") : [text, text];
        if (haystack.toLowerCase().includes(t)) {
          score += weight;
          termHit = true;
          if (display && display.length < 80) matches.add(display.trim());
        }
      }
      if (!termHit) {
        score = 0;
        break;
      }
    }
    if (score > 0) hits.push({ document: d, matches: [...matches].slice(0, 3), score });
  }
  return hits.sort((a, b) => b.score - a.score || b.document.clinicalDate.localeCompare(a.document.clinicalDate));
}

// ---------- dates ----------

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function fmtDate(iso: string, style: "short" | "long" | "month" | "monthShort" | "dayMonth" = "short") {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  switch (style) {
    case "long":
      return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
    case "month":
      return `${MONTHS_LONG[m - 1]} ${y}`;
    case "monthShort":
      return `${MONTHS[m - 1]} ${y}`;
    case "dayMonth":
      return `${MONTHS[m - 1].toUpperCase()} ${String(d).padStart(2, "0")}`;
    default:
      return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
  }
}

export function monthsBetween(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function ageFrom(dob: string, today = todayISO()) {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export function upcomingAppointments(s: HealthSnapshot, today = todayISO()) {
  return [...(s.appointments ?? [])].filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}
