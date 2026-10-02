/**
 * Domain model for Continuum.
 *
 * A patient's history is a set of source documents. Everything clinical
 * (lab results, diagnoses, medication orders, vitals, allergies) is
 * *extracted from* a document and always keeps a pointer back to it, so
 * every number the product shows can be traced to its source.
 */

export type DocumentType =
  | "lab_report"
  | "prescription"
  | "consultation"
  | "imaging"
  | "discharge_summary"
  | "procedure";

export type DocumentStatus = "uploading" | "processing" | "processed" | "needs_review" | "failed";

export type ProviderKind = "doctor" | "lab" | "hospital" | "clinic" | "imaging";

export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  specialty?: string;
  organization?: string;
  city: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date
  sex: "male" | "female" | "other";
  bloodGroup?: string;
  heightCm?: number;
  city: string;
  phone?: string;
  emergencyContact?: string;
}

export type Flag = "low" | "normal" | "high" | "unknown";

/** One measured analyte on one report. The reference range is the one printed on *that* report. */
export interface LabResult {
  id: string;
  biomarker: string; // BiomarkerCode, kept as string so unknown analytes survive extraction
  name: string; // as printed on the report
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  refText?: string; // verbatim, e.g. "0.4 – 4.5" or "< 100"
  edited?: boolean; // corrected by the user after extraction
}

export interface DiagnosisEntry {
  id: string;
  conditionId: string;
  label: string; // as written by the clinician
  certainty: "confirmed" | "provisional" | "ruled_out";
}

export type MedicationAction = "started" | "continued" | "dose_changed" | "stopped" | "one_off";

export interface MedicationOrder {
  id: string;
  drug: string; // generic name, normalised
  brand?: string;
  drugClass: string; // e.g. "antibiotic", "thyroid hormone"
  strength: string; // "50 mcg"
  form?: string; // tablet, capsule, spray
  frequency: string; // "Once daily"
  instructions?: string; // "Before breakfast"
  durationDays?: number; // undefined = long-term
  action: MedicationAction;
  reasonConditionId?: string;
  reason?: string;
  edited?: boolean;
}

export interface VitalSign {
  id: string;
  kind: "bp" | "weight" | "heart_rate" | "bmi" | "spo2" | "temperature";
  value: number;
  value2?: number; // diastolic for bp
  unit: string;
}

export interface AllergyEntry {
  id: string;
  substance: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
}

export interface ClinicalNotes {
  chiefComplaint?: string;
  summary?: string;
  findings?: string[];
  plan?: string[];
  impression?: string;
  admission?: { admittedOn: string; dischargedOn: string; ward?: string };
  procedureName?: string;
  /** Notes from the extraction step, e.g. illegible fields. Shown during review. */
  extractionWarnings?: string[];
}

export interface ExtractedData {
  labs?: LabResult[];
  diagnoses?: DiagnosisEntry[];
  medications?: MedicationOrder[];
  vitals?: VitalSign[];
  allergies?: AllergyEntry[];
  notes?: ClinicalNotes;
}

export interface MedicalDocument {
  id: string;
  fileName: string;
  mimeType: string;
  type: DocumentType;
  title: string;
  clinicalDate: string; // ISO date the care happened, not the upload date
  uploadedAt: string; // ISO datetime
  providerId?: string; // the lab / hospital / clinic
  clinicianId?: string; // the treating doctor, when known
  status: DocumentStatus;
  confidence: number; // 0..1 extraction confidence
  pages: number;
  handwritten?: boolean;
  reviewedAt?: string;
  source: "seed" | "upload";
  extractionEngine?: string; // which service produced the extraction
  fileUrl?: string; // object/data URL for user uploads (not persisted)
  extracted: ExtractedData;
}

export interface Condition {
  id: string;
  name: string;
  category: "endocrine" | "metabolic" | "respiratory" | "nutritional" | "dermatological" | "other";
  chronic: boolean;
  status: "active" | "resolved";
  description?: string;
}

export interface HealthSnapshot {
  patient: Patient;
  providers: Provider[];
  conditions: Condition[];
  documents: MedicalDocument[];
}
