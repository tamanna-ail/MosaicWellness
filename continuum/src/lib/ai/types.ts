/**
 * Shape of an answer from the health-history assistant.
 *
 * Every answer separates three kinds of statement so the user always knows
 * what they are reading:
 *  - facts:          copied from their records, each with source documents
 *  - calculations:   arithmetic the app did on those facts
 *  - interpretation: pattern-level commentary, never a diagnosis
 */

export interface AnswerItem {
  text: string;
  sources?: string[]; // document ids
}

export interface AnswerChartPoint {
  date: string;
  value: number;
  refLow?: number;
  refHigh?: number;
  documentId: string;
  flag: "low" | "normal" | "high" | "unknown";
  converted?: boolean;
}

export interface AnswerChart {
  biomarker: string;
  label: string;
  unit: string;
  decimals: number;
  points: AnswerChartPoint[];
}

export interface AnswerTable {
  columns: string[];
  rows: { cells: string[]; documentId?: string }[];
}

export interface Citation {
  documentId: string;
  title: string;
  date: string;
  provider?: string;
}

export type AnswerIntent =
  | "biomarker_trend"
  | "first_abnormal"
  | "medications"
  | "medication_history"
  | "diagnoses"
  | "prescription_diff"
  | "summary"
  | "allergies"
  | "hospitalizations"
  | "provider"
  | "search"
  | "unknown";

export interface AiAnswer {
  intent: AnswerIntent;
  summary: string;
  facts: AnswerItem[];
  calculations: AnswerItem[];
  interpretation: AnswerItem[];
  gaps: string[];
  chart?: AnswerChart;
  table?: AnswerTable;
  sources: Citation[];
  followUps: string[];
  action?: { label: string; href: string };
  engine: "local" | "claude";
}
