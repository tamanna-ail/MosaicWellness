/**
 * Biomarker catalogue. Describes how to *display* and *compare* an analyte.
 * It deliberately carries no reference range: ranges belong to each report.
 */

export interface BiomarkerDef {
  code: string;
  name: string;
  shortName: string;
  aliases: string[];
  group: "Thyroid" | "Metabolic" | "Lipids" | "Blood" | "Vitamins" | "Kidney" | "Liver" | "Inflammation";
  canonicalUnit: string;
  /** Explicit, documented conversions into the canonical unit. Anything else is never compared. */
  conversions?: Record<string, number>;
  decimals: number;
  description: string;
  /** Shown in the Health Trends row on Home. */
  featured?: boolean;
}

export const BIOMARKERS: BiomarkerDef[] = [
  {
    code: "TSH",
    name: "Thyroid Stimulating Hormone",
    shortName: "TSH",
    aliases: ["tsh", "thyroid stimulating hormone", "thyrotropin", "thyroid"],
    group: "Thyroid",
    canonicalUnit: "mIU/L",
    conversions: { "µIU/mL": 1, "uIU/mL": 1, "mIU/L": 1 },
    decimals: 1,
    description: "A pituitary hormone that signals the thyroid to work. It usually rises when the thyroid is underactive.",
    featured: true,
  },
  {
    code: "T3",
    name: "Total Triiodothyronine (T3)",
    shortName: "T3",
    aliases: ["t3", "triiodothyronine", "total t3"],
    group: "Thyroid",
    canonicalUnit: "ng/mL",
    decimals: 2,
    description: "The active thyroid hormone.",
  },
  {
    code: "T4",
    name: "Total Thyroxine (T4)",
    shortName: "T4",
    aliases: ["t4", "thyroxine", "total t4"],
    group: "Thyroid",
    canonicalUnit: "µg/dL",
    conversions: { "µg/dL": 1, "ug/dL": 1, "mcg/dL": 1 },
    decimals: 1,
    description: "The main hormone made by the thyroid gland.",
  },
  {
    code: "ANTI_TPO",
    name: "Anti-Thyroid Peroxidase Antibodies",
    shortName: "Anti-TPO",
    aliases: ["anti tpo", "anti-tpo", "tpo", "thyroid peroxidase"],
    group: "Thyroid",
    canonicalUnit: "IU/mL",
    decimals: 0,
    description: "Antibodies against the thyroid. Often raised in autoimmune thyroid conditions.",
  },
  {
    code: "HBA1C",
    name: "Glycated Haemoglobin (HbA1c)",
    shortName: "HbA1c",
    aliases: ["hba1c", "a1c", "glycated", "glycosylated", "sugar", "diabetes", "blood sugar"],
    group: "Metabolic",
    canonicalUnit: "%",
    decimals: 1,
    description: "Average blood sugar over the past two to three months.",
    featured: true,
  },
  {
    code: "FBG",
    name: "Fasting Blood Glucose",
    shortName: "Fasting Glucose",
    aliases: ["fasting glucose", "fbs", "fbg", "fasting sugar", "glucose"],
    group: "Metabolic",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dL": 1, "mmol/L": 18.0 },
    decimals: 0,
    description: "Blood sugar after at least eight hours without food.",
  },
  {
    code: "LDL",
    name: "LDL Cholesterol",
    shortName: "LDL",
    aliases: ["ldl", "bad cholesterol", "low density", "cholesterol"],
    group: "Lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dL": 1, "mmol/L": 38.67 },
    decimals: 0,
    description: "Low-density lipoprotein, the cholesterol most linked to artery plaque.",
    featured: true,
  },
  {
    code: "HDL",
    name: "HDL Cholesterol",
    shortName: "HDL",
    aliases: ["hdl", "good cholesterol", "high density"],
    group: "Lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dL": 1, "mmol/L": 38.67 },
    decimals: 0,
    description: "High-density lipoprotein, which carries cholesterol away from arteries.",
  },
  {
    code: "TG",
    name: "Triglycerides",
    shortName: "Triglycerides",
    aliases: ["triglycerides", "tg", "trigs"],
    group: "Lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dL": 1, "mmol/L": 88.57 },
    decimals: 0,
    description: "The most common type of fat in the blood.",
  },
  {
    code: "TCHOL",
    name: "Total Cholesterol",
    shortName: "Total Cholesterol",
    aliases: ["total cholesterol", "serum cholesterol"],
    group: "Lipids",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dL": 1, "mmol/L": 38.67 },
    decimals: 0,
    description: "All cholesterol carried in the blood.",
  },
  {
    code: "VITD",
    name: "Vitamin D (25-OH)",
    shortName: "Vitamin D",
    aliases: ["vitamin d", "vit d", "25-oh", "25 oh", "cholecalciferol level", "vitd"],
    group: "Vitamins",
    canonicalUnit: "ng/mL",
    conversions: { "ng/mL": 1, "nmol/L": 1 / 2.496 },
    decimals: 1,
    description: "The storage form of vitamin D, the best marker of vitamin D status.",
    featured: true,
  },
  {
    code: "HB",
    name: "Haemoglobin",
    shortName: "Hemoglobin",
    aliases: ["hemoglobin", "haemoglobin", "hb", "hgb"],
    group: "Blood",
    canonicalUnit: "g/dL",
    decimals: 1,
    description: "The oxygen-carrying protein in red blood cells.",
  },
  {
    code: "WBC",
    name: "White Blood Cell Count",
    shortName: "WBC",
    aliases: ["wbc", "white blood", "tlc", "leukocyte"],
    group: "Blood",
    canonicalUnit: "×10³/µL",
    decimals: 1,
    description: "Cells that fight infection. Often raised during bacterial infections.",
  },
  {
    code: "CRP",
    name: "C-Reactive Protein",
    shortName: "CRP",
    aliases: ["crp", "c-reactive", "inflammation marker"],
    group: "Inflammation",
    canonicalUnit: "mg/L",
    decimals: 0,
    description: "A general marker of inflammation in the body.",
  },
  {
    code: "CREAT",
    name: "Serum Creatinine",
    shortName: "Creatinine",
    aliases: ["creatinine", "kidney function", "renal function"],
    group: "Kidney",
    canonicalUnit: "mg/dL",
    conversions: { "mg/dL": 1, "µmol/L": 1 / 88.4, "umol/L": 1 / 88.4 },
    decimals: 2,
    description: "A waste product filtered by the kidneys; a marker of kidney function.",
  },
  {
    code: "ALT",
    name: "Alanine Aminotransferase (ALT/SGPT)",
    shortName: "ALT",
    aliases: ["alt", "sgpt", "liver enzyme", "liver function"],
    group: "Liver",
    canonicalUnit: "U/L",
    decimals: 0,
    description: "A liver enzyme. Often checked when taking statins.",
  },
];

const BY_CODE = new Map(BIOMARKERS.map((b) => [b.code, b]));

export function getBiomarker(code: string): BiomarkerDef | undefined {
  return BY_CODE.get(code.toUpperCase());
}

/** Default order for the Health Data grid. */
export const BIOMARKER_ORDER = ["TSH", "HBA1C", "HB", "VITD", "LDL", "HDL", "TG", "CREAT", "FBG", "T3", "T4", "TCHOL", "ANTI_TPO", "ALT", "CRP", "WBC"];

/**
 * Convert a value into the biomarker's canonical unit.
 * Returns null when no explicit conversion exists — callers must then
 * exclude the value from comparisons rather than guess.
 */
export function toCanonical(def: BiomarkerDef, value: number, unit: string): number | null {
  if (normaliseUnit(unit) === normaliseUnit(def.canonicalUnit)) return value;
  const factor = def.conversions
    ? Object.entries(def.conversions).find(([u]) => normaliseUnit(u) === normaliseUnit(unit))?.[1]
    : undefined;
  return factor === undefined ? null : value * factor;
}

export function normaliseUnit(unit: string) {
  return unit.replace(/\s+/g, "").replace("μ", "µ").toLowerCase();
}

export function formatValue(value: number, decimals: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Conditions a biomarker is clinically tied to; used only to show related treatment alongside a trend. */
export const BIOMARKER_CONDITIONS: Record<string, string[]> = {
  TSH: ["subclinical_hypothyroidism"],
  T3: ["subclinical_hypothyroidism"],
  T4: ["subclinical_hypothyroidism"],
  ANTI_TPO: ["subclinical_hypothyroidism"],
  LDL: ["dyslipidemia"],
  HDL: ["dyslipidemia"],
  TG: ["dyslipidemia"],
  TCHOL: ["dyslipidemia"],
  VITD: ["vitamin_d_deficiency"],
};
