/**
 * Offline demo extractor.
 *
 * Used when no AI provider is configured. It cannot read the file, so it
 * infers a plausible document from the file name and says so: the result is
 * labelled as demo output and anything below the review threshold is routed
 * to the user to confirm. It never pretends to be real OCR.
 */
import type { ExtractionResult, ExtractedLab, ExtractedMedication } from "./types";

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Pulls a clinical date out of names like "Thyroid_12Sep2026.pdf", "lipid-2025-07-08.pdf" or "Rx_Aug_2026.jpg". */
export function dateFromFileName(name: string): string | null {
  const n = name.toLowerCase();
  let m = n.match(/(20\d\d)[-_.](\d{1,2})[-_.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = n.match(/(\d{1,2})[-_. ]?(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[-_. ]?(20\d\d)/);
  if (m) return iso(+m[3], MONTHS[m[2]], +m[1]);
  m = n.match(/(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[-_. ]?(20\d\d)/);
  if (m) return iso(+m[2], MONTHS[m[1]], 1);
  return null;
}

function iso(y: number, mo: number, d: number) {
  if (!mo || mo > 12 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const lab = (name: string, biomarkerCode: string, value: number, unit: string, refLow: number | null, refHigh: number | null): ExtractedLab => ({
  name,
  biomarkerCode,
  value,
  unit,
  refLow,
  refHigh,
  refText: refLow !== null && refHigh !== null ? `${refLow} – ${refHigh}` : refHigh !== null ? `< ${refHigh}` : refLow !== null ? `> ${refLow}` : null,
});

const med = (m: Partial<ExtractedMedication> & Pick<ExtractedMedication, "drug" | "drugClass" | "strength" | "frequency">): ExtractedMedication => ({
  brand: null,
  instructions: null,
  durationDays: null,
  action: "continued",
  ...m,
});

export function demoExtract(fileName: string, mimeType: string): ExtractionResult {
  const n = fileName.toLowerCase();
  const isImage = mimeType.startsWith("image/");
  const base = {
    clinicalDate: dateFromFileName(fileName),
    clinicianName: null,
    clinicianSpecialty: null,
    labs: [],
    medications: [],
    diagnoses: [],
    allergies: [],
    summary: null,
    findings: [],
    engine: "Demo extractor (file name only)",
    warnings: ["Demo mode: values were inferred from the file name, not read from the document. Please review before relying on them."],
  } satisfies Partial<ExtractionResult>;

  if (/thyroid|tft|tsh/.test(n))
    return { ...base, documentType: "lab_report", title: "Thyroid Profile", facilityName: "Metropolis Healthcare", confidence: isImage ? 0.86 : 0.94, labs: [lab("TSH (Thyroid Stimulating Hormone)", "TSH", 4.6, "mIU/L", 0.4, 4.5), lab("T3, Total", "T3", 1.12, "ng/mL", 0.8, 2.0), lab("T4, Total", "T4", 7.9, "µg/dL", 5.1, 14.1)] };
  if (/lipid|cholesterol|ldl/.test(n))
    return { ...base, documentType: "lab_report", title: "Lipid Profile", facilityName: "Apollo Diagnostics", confidence: isImage ? 0.85 : 0.95, labs: [lab("Total Cholesterol", "TCHOL", 171, "mg/dL", null, 200), lab("LDL Cholesterol (Direct)", "LDL", 98, "mg/dL", null, 100), lab("HDL Cholesterol", "HDL", 46, "mg/dL", 40, null), lab("Triglycerides", "TG", 139, "mg/dL", null, 150)] };
  if (/vit[-_ ]?d|vitamin/.test(n)) return { ...base, documentType: "lab_report", title: "Vitamin D (25-OH)", facilityName: "Apollo Diagnostics", confidence: 0.95, labs: [lab("Vitamin D, 25-Hydroxy", "VITD", 38.2, "ng/mL", 30, 100)] };
  if (/hba1c|a1c|sugar|glucose|diabet/.test(n))
    return { ...base, documentType: "lab_report", title: "HbA1c & Fasting Glucose", facilityName: "Metropolis Healthcare", confidence: 0.95, labs: [lab("HbA1c", "HBA1C", 5.6, "%", 4.0, 5.6), lab("Glucose, Fasting", "FBG", 96, "mg/dL", 70, 100)] };
  if (/cbc|hemogram|haemogram|blood[-_ ]?count/.test(n))
    return { ...base, documentType: "lab_report", title: "Complete Blood Count", facilityName: "Apollo Diagnostics", confidence: 0.93, labs: [lab("Haemoglobin", "HB", 14.7, "g/dL", 13.0, 17.0), lab("Total Leucocyte Count", "WBC", 7.1, "×10³/µL", 4.0, 11.0)] };
  if (/rx|prescription|presc/.test(n))
    return {
      ...base,
      documentType: "prescription",
      title: "Prescription",
      facilityName: "Mehta Endocrine & Diabetes Centre",
      clinicianName: "Dr. Rohan Mehta",
      clinicianSpecialty: "Endocrinologist",
      confidence: isImage ? 0.78 : 0.9,
      medications: [med({ drug: "Levothyroxine", brand: "Thyronorm 50", drugClass: "thyroid hormone", strength: "50 mcg", frequency: "Once daily", instructions: "Before breakfast, empty stomach" })],
      warnings: [...base.warnings, ...(isImage ? ["Handwriting detected: please confirm the medicine name and dose."] : [])],
    };
  if (/x[-_ ]?ray|cxr|mri|ct[-_ ]|scan|usg|ultrasound|echo/.test(n))
    return { ...base, documentType: "imaging", title: /mri/.test(n) ? "MRI Report" : /usg|ultrasound/.test(n) ? "Ultrasound Report" : /ct[-_ ]/.test(n) ? "CT Scan Report" : "Chest X-Ray", facilityName: "Manipal Radiology", confidence: 0.88, summary: "Imaging report. Impression requires review.", findings: ["Impression text could not be confirmed in demo mode."] };
  if (/discharge/.test(n)) return { ...base, documentType: "discharge_summary", title: "Discharge Summary", facilityName: null, confidence: 0.7, summary: "Hospital discharge summary." };
  if (/consult|visit|opd|note/.test(n)) return { ...base, documentType: "consultation", title: "Consultation", facilityName: null, confidence: 0.72, summary: "Consultation note." };
  return { ...base, documentType: "consultation", title: "Medical Document", facilityName: null, confidence: 0.58, summary: null, warnings: [...base.warnings, "Document type could not be determined from the file name."] };
}
