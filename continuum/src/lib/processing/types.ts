/**
 * Contract between the document-processing service and the app.
 * Any extractor (Claude vision, a dedicated OCR + NER pipeline, or the
 * offline demo extractor) returns this shape; the client maps it onto
 * the domain model and decides whether human review is needed.
 */
import type { DocumentType } from "@/lib/types";

export interface ExtractedLab {
  name: string;
  biomarkerCode: string | null;
  value: number;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
}

export interface ExtractedMedication {
  drug: string;
  brand: string | null;
  drugClass: string;
  strength: string;
  frequency: string;
  instructions: string | null;
  durationDays: number | null;
  action: "started" | "continued" | "dose_changed" | "stopped" | "one_off";
}

export interface ExtractionResult {
  documentType: DocumentType;
  title: string;
  clinicalDate: string | null; // YYYY-MM-DD
  facilityName: string | null;
  clinicianName: string | null;
  clinicianSpecialty: string | null;
  confidence: number; // 0..1
  labs: ExtractedLab[];
  medications: ExtractedMedication[];
  diagnoses: { label: string }[];
  allergies: { substance: string; reaction: string; severity: "mild" | "moderate" | "severe" }[];
  summary: string | null;
  findings: string[];
  engine: string;
  warnings: string[];
}

/** JSON Schema used for structured output from an LLM extractor. Mirrors ExtractionResult. */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["documentType", "title", "clinicalDate", "facilityName", "clinicianName", "clinicianSpecialty", "confidence", "labs", "medications", "diagnoses", "allergies", "summary", "findings", "warnings"],
  properties: {
    documentType: { type: "string", enum: ["lab_report", "prescription", "consultation", "imaging", "discharge_summary", "procedure"] },
    title: { type: "string", description: "Short human title, e.g. 'Thyroid Profile', 'Prescription', 'Chest X-Ray'" },
    clinicalDate: { type: ["string", "null"], description: "Date the care/sample happened (not printed/report date if both exist), YYYY-MM-DD" },
    facilityName: { type: ["string", "null"] },
    clinicianName: { type: ["string", "null"], description: "Treating/prescribing doctor, with 'Dr.' prefix" },
    clinicianSpecialty: { type: ["string", "null"] },
    confidence: { type: "number", description: "0-1, your confidence the extraction is complete and correct. Lower for handwriting or poor scans." },
    labs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "biomarkerCode", "value", "unit", "refLow", "refHigh", "refText"],
        properties: {
          name: { type: "string", description: "Test name exactly as printed" },
          biomarkerCode: { type: ["string", "null"], description: "One of TSH,T3,T4,ANTI_TPO,HBA1C,FBG,LDL,HDL,TG,TCHOL,VITD,HB,WBC,CRP,CREAT,ALT or null" },
          value: { type: "number" },
          unit: { type: "string", description: "Unit exactly as printed" },
          refLow: { type: ["number", "null"] },
          refHigh: { type: ["number", "null"] },
          refText: { type: ["string", "null"], description: "Reference range exactly as printed on THIS report" },
        },
      },
    },
    medications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["drug", "brand", "drugClass", "strength", "frequency", "instructions", "durationDays", "action"],
        properties: {
          drug: { type: "string", description: "Generic name" },
          brand: { type: ["string", "null"] },
          drugClass: { type: "string", description: "e.g. antibiotic, thyroid hormone, statin (lipid-lowering), vitamin supplement, antihistamine" },
          strength: { type: "string" },
          frequency: { type: "string", description: "Plain English, e.g. 'Once daily', 'Twice daily after food'" },
          instructions: { type: ["string", "null"] },
          durationDays: { type: ["integer", "null"], description: "null when long-term or not stated" },
          action: { type: "string", enum: ["started", "continued", "dose_changed", "stopped", "one_off"] },
        },
      },
    },
    diagnoses: { type: "array", items: { type: "object", additionalProperties: false, required: ["label"], properties: { label: { type: "string" } } } },
    allergies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["substance", "reaction", "severity"],
        properties: { substance: { type: "string" }, reaction: { type: "string" }, severity: { type: "string", enum: ["mild", "moderate", "severe"] } },
      },
    },
    summary: { type: ["string", "null"], description: "One or two neutral sentences describing the document" },
    findings: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" }, description: "Anything illegible, ambiguous or that needs the patient to check" },
  },
} as const;
