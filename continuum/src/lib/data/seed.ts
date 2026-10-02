/**
 * Demo patient: Aarav Sharma, 35, Bengaluru (previously Pune).
 *
 * 47 documents across 2023–2026 from labs, GPs, specialists and one
 * hospital admission. The story has deliberate rough edges that a real
 * history has, so the product can show it handles them honestly:
 *  - TSH reference ranges differ between labs (SRL, Apollo, Metropolis).
 *  - The 2023 Vitamin D result is in nmol/L; later ones are in ng/mL.
 *  - No thyroid report exists between Mar 2025 and Sep 2026 (a gap).
 *  - The Jan 2026 dose change cites an outside TSH that was never uploaded.
 *  - One prescription is a handwritten scan with lower extraction confidence.
 */
import type {
  AllergyEntry,
  Appointment,
  ClinicalNotes,
  Condition,
  DiagnosisEntry,
  DocumentType,
  HealthSnapshot,
  LabResult,
  MedicalDocument,
  MedicationOrder,
  Patient,
  Provider,
  VitalSign,
} from "@/lib/types";

export const patient: Patient = {
  id: "pt_aarav",
  firstName: "Aarav",
  lastName: "Sharma",
  dateOfBirth: "1991-06-14",
  sex: "male",
  bloodGroup: "B+",
  heightCm: 176,
  city: "Bengaluru",
  phone: "+91 98450 21734",
  emergencyContact: "Ananya Sharma (spouse) · +91 98450 88120",
};

export const providers: Provider[] = [
  { id: "srl_pune", name: "SRL Diagnostics", kind: "lab", city: "Pune" },
  { id: "apollo_diag", name: "Apollo Diagnostics", kind: "lab", city: "Bengaluru" },
  { id: "metropolis", name: "Metropolis Healthcare", kind: "lab", city: "Bengaluru" },
  { id: "apollo_hosp", name: "Apollo Hospital", kind: "hospital", organization: "Bannerghatta Road", city: "Bengaluru" },
  { id: "sahyadri", name: "Sahyadri Hospital", kind: "hospital", organization: "Deccan Gymkhana", city: "Pune" },
  { id: "manipal_rad", name: "Manipal Radiology", kind: "imaging", city: "Bengaluru" },
  { id: "kulkarni_clinic", name: "Kulkarni Family Clinic", kind: "clinic", city: "Pune" },
  { id: "iyer_clinic", name: "Iyer Family Clinic", kind: "clinic", city: "Bengaluru" },
  { id: "mehta_endo", name: "Mehta Endocrine & Diabetes Centre", kind: "clinic", city: "Bengaluru" },
  { id: "nair_ent", name: "Nair ENT Clinic", kind: "clinic", city: "Bengaluru" },
  { id: "dr_kulkarni", name: "Dr. Sanjay Kulkarni", kind: "doctor", specialty: "General Physician", organization: "Kulkarni Family Clinic", city: "Pune" },
  { id: "dr_shah", name: "Dr. Vikram Shah", kind: "doctor", specialty: "General Surgeon", organization: "Sahyadri Hospital", city: "Pune" },
  { id: "dr_iyer", name: "Dr. Kavya Iyer", kind: "doctor", specialty: "General Physician", organization: "Iyer Family Clinic", city: "Bengaluru" },
  { id: "dr_rao", name: "Dr. Anil Rao", kind: "doctor", specialty: "Pulmonologist", organization: "Apollo Hospital", city: "Bengaluru" },
  { id: "dr_mehta", name: "Dr. Rohan Mehta", kind: "doctor", specialty: "Endocrinologist", organization: "Mehta Endocrine & Diabetes Centre", city: "Bengaluru" },
  { id: "dr_nair", name: "Dr. Meera Nair", kind: "doctor", specialty: "ENT Specialist", organization: "Nair ENT Clinic", city: "Bengaluru" },
];

export const conditions: Condition[] = [
  { id: "subclinical_hypothyroidism", name: "Subclinical Hypothyroidism", category: "endocrine", chronic: true, status: "active", description: "Raised TSH with normal T4, here with positive anti-TPO antibodies (autoimmune pattern)." },
  { id: "vitamin_d_deficiency", name: "Vitamin D Deficiency", category: "nutritional", chronic: true, status: "active", description: "Low 25-OH Vitamin D levels requiring supplementation." },
  { id: "dyslipidemia", name: "Dyslipidemia", category: "metabolic", chronic: true, status: "active", description: "Raised LDL cholesterol and triglycerides." },
  { id: "acute_bronchitis", name: "Acute Bronchitis", category: "respiratory", chronic: false, status: "resolved" },
  { id: "acute_pharyngitis", name: "Acute Pharyngitis (URTI)", category: "respiratory", chronic: false, status: "resolved" },
  { id: "pneumonia", name: "Community-Acquired Pneumonia", category: "respiratory", chronic: false, status: "resolved" },
  { id: "acute_sinusitis", name: "Acute Bacterial Sinusitis", category: "respiratory", chronic: false, status: "resolved" },
  { id: "sebaceous_cyst", name: "Sebaceous Cyst, Upper Back", category: "dermatological", chronic: false, status: "resolved" },
  { id: "drug_rash", name: "Drug Rash (Amoxicillin-Clavulanate)", category: "other", chronic: false, status: "resolved" },
];

// ---------- compact builders ----------

let seq = 0;
const nid = (p: string) => `${p}_${(++seq).toString(36)}`;

function lab(biomarker: string, name: string, value: number, unit: string, refLow?: number, refHigh?: number, refText?: string): LabResult {
  return {
    id: nid("lab"),
    biomarker,
    name,
    value,
    unit,
    refLow,
    refHigh,
    refText: refText ?? (refLow !== undefined && refHigh !== undefined ? `${refLow} – ${refHigh}` : refHigh !== undefined ? `< ${refHigh}` : refLow !== undefined ? `> ${refLow}` : undefined),
  };
}

function dx(conditionId: string, label: string, certainty: DiagnosisEntry["certainty"] = "confirmed"): DiagnosisEntry {
  return { id: nid("dx"), conditionId, label, certainty };
}

function rx(o: Omit<MedicationOrder, "id">): MedicationOrder {
  return { id: nid("rx"), ...o };
}

function bp(sys: number, dia: number): VitalSign {
  return { id: nid("vt"), kind: "bp", value: sys, value2: dia, unit: "mmHg" };
}
function weight(kg: number): VitalSign {
  return { id: nid("vt"), kind: "weight", value: kg, unit: "kg" };
}
function pulse(bpm: number): VitalSign {
  return { id: nid("vt"), kind: "heart_rate", value: bpm, unit: "bpm" };
}
function spo2(pct: number): VitalSign {
  return { id: nid("vt"), kind: "spo2", value: pct, unit: "%" };
}
function temp(f: number): VitalSign {
  return { id: nid("vt"), kind: "temperature", value: f, unit: "°F" };
}

interface DocInput {
  id: string;
  file: string;
  type: DocumentType;
  title: string;
  date: string;
  provider?: string;
  clinician?: string;
  uploaded?: string;
  confidence?: number;
  pages?: number;
  handwritten?: boolean;
  labs?: LabResult[];
  diagnoses?: DiagnosisEntry[];
  medications?: MedicationOrder[];
  vitals?: VitalSign[];
  allergies?: AllergyEntry[];
  notes?: ClinicalNotes;
}

function doc(d: DocInput): MedicalDocument {
  const mime = d.file.endsWith(".pdf") ? "application/pdf" : d.file.endsWith(".png") ? "image/png" : "image/jpeg";
  return {
    id: d.id,
    fileName: d.file,
    mimeType: mime,
    type: d.type,
    title: d.title,
    clinicalDate: d.date,
    uploadedAt: d.uploaded ?? `${d.date}T18:30:00.000Z`,
    providerId: d.provider,
    clinicianId: d.clinician,
    status: "processed",
    confidence: d.confidence ?? 0.97,
    pages: d.pages ?? 1,
    handwritten: d.handwritten,
    source: "seed",
    extractionEngine: d.handwritten ? "OCR (handwriting) + clinical extraction" : "PDF text + clinical extraction",
    reviewedAt: d.handwritten ? `${d.date}T20:00:00.000Z` : undefined,
    extracted: {
      labs: d.labs,
      diagnoses: d.diagnoses,
      medications: d.medications,
      vitals: d.vitals,
      allergies: d.allergies,
      notes: d.notes,
    },
  };
}

// Reference ranges as printed by each lab. Intentionally not identical.
const TSH_SRL = [0.35, 5.5] as const;
const TSH_APOLLO = [0.27, 4.2] as const;
const TSH_METRO = [0.4, 4.5] as const;

const thyroid = (tsh: number, t3: number, t4: number, r: readonly [number, number], extra: LabResult[] = []) => [
  lab("TSH", "TSH (Thyroid Stimulating Hormone)", tsh, r === TSH_SRL ? "µIU/mL" : "mIU/L", r[0], r[1]),
  lab("T3", "T3, Total", t3, "ng/mL", 0.8, 2.0),
  lab("T4", "T4, Total", t4, "µg/dL", 5.1, 14.1),
  ...extra,
];

const lipids = (ldl: number, hdl: number, tg: number, tc: number) => [
  lab("TCHOL", "Total Cholesterol", tc, "mg/dL", undefined, 200),
  lab("LDL", "LDL Cholesterol (Direct)", ldl, "mg/dL", undefined, 100),
  lab("HDL", "HDL Cholesterol", hdl, "mg/dL", 40, undefined),
  lab("TG", "Triglycerides", tg, "mg/dL", undefined, 150),
];

// ---------- documents ----------

export const documents: MedicalDocument[] = [
  // ===== 2023 · Pune =====
  doc({
    id: "doc_2023_01_09_consult", file: "Kulkarni_Consultation_09Jan2023.pdf", type: "consultation", title: "General Consultation",
    date: "2023-01-09", provider: "kulkarni_clinic", clinician: "dr_kulkarni", uploaded: "2026-05-02T10:14:00.000Z",
    vitals: [bp(124, 80), weight(74.2), pulse(92), temp(99.8), spo2(97)],
    diagnoses: [dx("acute_bronchitis", "Acute bronchitis")],
    notes: { chiefComplaint: "Productive cough and low-grade fever for 5 days.", findings: ["Scattered rhonchi bilaterally", "Throat mildly congested"], plan: ["Oral antibiotics for 5 days", "Steam inhalation", "Review if fever persists beyond 3 days"], summary: "Acute bronchitis, treated empirically with amoxicillin-clavulanate." },
  }),
  doc({
    id: "doc_2023_01_09_rx", file: "Prescription_Kulkarni_Jan2023.jpg", type: "prescription", title: "Prescription",
    date: "2023-01-09", provider: "kulkarni_clinic", clinician: "dr_kulkarni", uploaded: "2026-05-02T10:15:00.000Z", confidence: 0.81, handwritten: true,
    medications: [
      rx({ drug: "Amoxicillin-Clavulanate", brand: "Augmentin 625 Duo", drugClass: "antibiotic", strength: "625 mg", form: "Tablet", frequency: "Twice daily", instructions: "After food", durationDays: 5, action: "one_off", reasonConditionId: "acute_bronchitis", reason: "Acute bronchitis" }),
      rx({ drug: "Paracetamol", brand: "Dolo 650", drugClass: "analgesic / antipyretic", strength: "650 mg", form: "Tablet", frequency: "As needed, up to 3 times daily", instructions: "For fever", durationDays: 5, action: "one_off", reasonConditionId: "acute_bronchitis", reason: "Fever" }),
    ],
  }),
  doc({
    id: "doc_2023_01_12_consult", file: "Kulkarni_Consultation_12Jan2023.pdf", type: "consultation", title: "Follow-up Consultation",
    date: "2023-01-12", provider: "kulkarni_clinic", clinician: "dr_kulkarni", uploaded: "2026-05-02T10:16:00.000Z",
    vitals: [bp(122, 78), pulse(84), temp(98.6)],
    diagnoses: [dx("drug_rash", "Maculopapular rash, likely drug reaction to amoxicillin-clavulanate")],
    allergies: [{ id: "alg_penicillin", substance: "Penicillin (Amoxicillin-Clavulanate)", reaction: "Maculopapular rash on day 3 of course", severity: "moderate" }],
    notes: { chiefComplaint: "Itchy red rash over trunk and arms since yesterday.", findings: ["Generalised maculopapular rash", "No lip or tongue swelling", "Chest: improving"], plan: ["Stop amoxicillin-clavulanate", "Switch to azithromycin to complete treatment", "Antihistamine for itching", "Record penicillin allergy"], summary: "Drug rash attributed to amoxicillin-clavulanate. Penicillin allergy recorded." },
  }),
  doc({
    id: "doc_2023_01_12_rx", file: "Prescription_Kulkarni_12Jan2023.pdf", type: "prescription", title: "Prescription",
    date: "2023-01-12", provider: "kulkarni_clinic", clinician: "dr_kulkarni", uploaded: "2026-05-02T10:16:30.000Z",
    medications: [
      rx({ drug: "Amoxicillin-Clavulanate", drugClass: "antibiotic", strength: "625 mg", frequency: "—", action: "stopped", reasonConditionId: "drug_rash", reason: "Stopped due to rash" }),
      rx({ drug: "Azithromycin", brand: "Azee 500", drugClass: "antibiotic", strength: "500 mg", form: "Tablet", frequency: "Once daily", instructions: "1 hour before food", durationDays: 3, action: "one_off", reasonConditionId: "acute_bronchitis", reason: "Acute bronchitis (completion of course)" }),
      rx({ drug: "Cetirizine", brand: "Okacet", drugClass: "antihistamine", strength: "10 mg", form: "Tablet", frequency: "Once daily at night", durationDays: 5, action: "one_off", reasonConditionId: "drug_rash", reason: "Drug rash" }),
    ],
  }),
  doc({
    id: "doc_2023_03_15_checkup", file: "SRL_Health_Checkup_Mar2023.pdf", type: "lab_report", title: "Comprehensive Health Checkup",
    date: "2023-03-15", provider: "srl_pune", uploaded: "2026-05-02T10:20:00.000Z", pages: 6, confidence: 0.95,
    labs: [
      ...thyroid(3.1, 1.05, 8.1, TSH_SRL),
      ...lipids(128, 44, 160, 198),
      lab("HBA1C", "HbA1c", 5.4, "%", 4.0, 5.6),
      lab("FBG", "Glucose, Fasting", 92, "mg/dL", 70, 100),
      lab("HB", "Haemoglobin", 14.6, "g/dL", 13.0, 17.0),
      lab("VITD", "25-OH Vitamin D, Total", 52, "nmol/L", 75, 250),
      lab("CREAT", "Creatinine, Serum", 0.92, "mg/dL", 0.7, 1.3),
      lab("ALT", "SGPT (ALT)", 28, "U/L", undefined, 41),
    ],
  }),
  doc({
    id: "doc_2023_07_18_proc", file: "Sahyadri_Procedure_Note_Jul2023.pdf", type: "procedure", title: "Minor Procedure — Cyst Excision",
    date: "2023-07-18", provider: "sahyadri", clinician: "dr_shah", uploaded: "2026-05-02T10:24:00.000Z", pages: 2,
    diagnoses: [dx("sebaceous_cyst", "Sebaceous cyst, upper back (2 × 1.5 cm)")],
    vitals: [bp(126, 82), pulse(78)],
    notes: { procedureName: "Excision of sebaceous cyst under local anaesthesia", findings: ["Well-circumscribed cyst, removed intact", "Specimen sent for histopathology"], plan: ["Daily dressing for 5 days", "Suture removal on day 10"], summary: "Uncomplicated excision of a sebaceous cyst from the upper back under local anaesthesia." },
  }),
  doc({
    id: "doc_2023_07_18_rx", file: "Sahyadri_Discharge_Rx_Jul2023.pdf", type: "prescription", title: "Post-procedure Prescription",
    date: "2023-07-18", provider: "sahyadri", clinician: "dr_shah", uploaded: "2026-05-02T10:25:00.000Z",
    medications: [
      rx({ drug: "Mupirocin", brand: "T-Bact", drugClass: "antibiotic (topical)", strength: "2% ointment", form: "Ointment", frequency: "Twice daily on wound", durationDays: 7, action: "one_off", reasonConditionId: "sebaceous_cyst", reason: "Wound care after excision" }),
      rx({ drug: "Ibuprofen", brand: "Brufen 400", drugClass: "NSAID / analgesic", strength: "400 mg", form: "Tablet", frequency: "Twice daily after food", durationDays: 3, action: "one_off", reasonConditionId: "sebaceous_cyst", reason: "Post-procedure pain" }),
    ],
  }),
  doc({
    id: "doc_2023_09_20_thyroid", file: "SRL_Thyroid_Profile_Sep2023.pdf", type: "lab_report", title: "Thyroid Profile",
    date: "2023-09-20", provider: "srl_pune", uploaded: "2026-05-02T10:27:00.000Z",
    labs: thyroid(3.4, 1.02, 7.9, TSH_SRL),
  }),
  doc({
    id: "doc_2023_12_05_consult", file: "Kulkarni_Consultation_Dec2023.pdf", type: "consultation", title: "General Consultation",
    date: "2023-12-05", provider: "kulkarni_clinic", clinician: "dr_kulkarni", uploaded: "2026-05-02T10:29:00.000Z",
    vitals: [bp(120, 80), weight(75.0), pulse(88), temp(100.4)],
    diagnoses: [dx("acute_pharyngitis", "Acute pharyngitis / upper respiratory tract infection")],
    notes: { chiefComplaint: "Sore throat, fever and body ache for 2 days.", findings: ["Congested pharynx with exudate", "Tender cervical lymph nodes"], plan: ["Azithromycin for 3 days (penicillin allergy noted)", "Warm saline gargles"], summary: "Acute pharyngitis. Azithromycin chosen because of documented penicillin allergy." },
  }),
  doc({
    id: "doc_2023_12_05_rx", file: "Prescription_Kulkarni_Dec2023.jpg", type: "prescription", title: "Prescription",
    date: "2023-12-05", provider: "kulkarni_clinic", clinician: "dr_kulkarni", uploaded: "2026-05-02T10:30:00.000Z", confidence: 0.86, handwritten: true,
    medications: [
      rx({ drug: "Azithromycin", brand: "Azee 500", drugClass: "antibiotic", strength: "500 mg", form: "Tablet", frequency: "Once daily", durationDays: 3, action: "one_off", reasonConditionId: "acute_pharyngitis", reason: "Acute pharyngitis" }),
      rx({ drug: "Cetirizine", drugClass: "antihistamine", strength: "10 mg", form: "Tablet", frequency: "Once daily at night", durationDays: 5, action: "one_off", reasonConditionId: "acute_pharyngitis", reason: "Nasal symptoms" }),
      rx({ drug: "Paracetamol", drugClass: "analgesic / antipyretic", strength: "650 mg", form: "Tablet", frequency: "As needed, up to 3 times daily", durationDays: 3, action: "one_off", reasonConditionId: "acute_pharyngitis", reason: "Fever" }),
    ],
  }),

  // ===== 2024 · Bengaluru =====
  doc({
    id: "doc_2024_03_18_checkup", file: "Apollo_Health_Checkup_Mar2024.pdf", type: "lab_report", title: "Comprehensive Health Checkup",
    date: "2024-03-18", provider: "apollo_diag", uploaded: "2026-05-02T10:33:00.000Z", pages: 7,
    labs: [
      ...thyroid(4.0, 1.12, 7.4, TSH_APOLLO),
      ...lipids(142, 42, 172, 214),
      lab("HBA1C", "HbA1c", 5.6, "%", 4.0, 5.6),
      lab("FBG", "Fasting Plasma Glucose", 98, "mg/dL", 70, 100),
      lab("HB", "Haemoglobin", 14.4, "g/dL", 13.0, 17.0),
      lab("VITD", "Vitamin D, 25-Hydroxy", 14.2, "ng/mL", 30, 100),
      lab("CREAT", "Creatinine", 0.95, "mg/dL", 0.7, 1.3),
      lab("ALT", "ALT (SGPT)", 31, "U/L", undefined, 45),
    ],
  }),
  doc({
    id: "doc_2024_03_26_consult", file: "Iyer_Consultation_Mar2024.pdf", type: "consultation", title: "General Consultation",
    date: "2024-03-26", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T10:35:00.000Z",
    vitals: [bp(126, 84), weight(76.4), pulse(76)],
    diagnoses: [dx("vitamin_d_deficiency", "Vitamin D deficiency"), dx("dyslipidemia", "Borderline dyslipidemia", "provisional")],
    notes: { chiefComplaint: "Review of annual health checkup. Fatigue and low back ache.", findings: ["Vitamin D 14.2 ng/mL", "LDL 142 mg/dL", "TSH 4.0 — upper end of range"], plan: ["Cholecalciferol 60,000 IU weekly for 8 weeks", "Diet and exercise for lipids; recheck in 12 months", "Repeat thyroid profile in 6 months"], summary: "New vitamin D deficiency. Lipids borderline-high; lifestyle advice first." },
  }),
  doc({
    id: "doc_2024_03_26_rx", file: "Prescription_Iyer_Mar2024.pdf", type: "prescription", title: "Prescription",
    date: "2024-03-26", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T10:35:30.000Z",
    medications: [
      rx({ drug: "Cholecalciferol (Vitamin D3)", brand: "Uprise-D3 60K", drugClass: "vitamin supplement", strength: "60,000 IU", form: "Capsule", frequency: "Once weekly", instructions: "With milk, after a meal", durationDays: 56, action: "started", reasonConditionId: "vitamin_d_deficiency", reason: "Vitamin D deficiency" }),
    ],
  }),
  doc({
    id: "doc_2024_06_10_vitd", file: "Apollo_VitaminD_Jun2024.pdf", type: "lab_report", title: "Vitamin D (25-OH)",
    date: "2024-06-10", provider: "apollo_diag", uploaded: "2026-05-02T10:37:00.000Z",
    labs: [lab("VITD", "Vitamin D, 25-Hydroxy", 31.5, "ng/mL", 30, 100)],
  }),
  doc({
    id: "doc_2024_09_10_thyroid", file: "Apollo_Thyroid_Profile_Sep2024.pdf", type: "lab_report", title: "Thyroid Profile",
    date: "2024-09-10", provider: "apollo_diag", uploaded: "2026-05-02T10:39:00.000Z",
    labs: thyroid(4.8, 1.08, 7.1, TSH_APOLLO, [lab("ANTI_TPO", "Anti-TPO Antibodies", 68, "IU/mL", undefined, 34)]),
  }),
  doc({
    id: "doc_2024_09_19_consult", file: "Iyer_Consultation_Sep2024.pdf", type: "consultation", title: "General Consultation",
    date: "2024-09-19", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T10:41:00.000Z",
    vitals: [bp(128, 82), weight(77.1), pulse(74)],
    notes: { chiefComplaint: "Review of thyroid report.", findings: ["TSH 4.8 mIU/L (lab range 0.27–4.2)", "Anti-TPO positive (68 IU/mL)", "No symptoms of hypothyroidism"], plan: ["No medication yet", "Repeat thyroid profile in 6 months", "Endocrinology referral if TSH keeps rising"], summary: "Mildly raised TSH with positive anti-TPO. Watchful waiting." },
  }),
  doc({
    id: "doc_2024_11_14_consult", file: "Iyer_Consultation_Nov2024.pdf", type: "consultation", title: "General Consultation",
    date: "2024-11-14", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T10:43:00.000Z",
    vitals: [bp(118, 76), pulse(108), temp(101.8), spo2(94)],
    diagnoses: [dx("pneumonia", "Suspected lower respiratory tract infection", "provisional")],
    notes: { chiefComplaint: "High fever, cough with yellow sputum and right-sided chest pain for 4 days.", findings: ["Crackles at right base", "SpO₂ 94% on room air"], plan: ["Urgent chest X-ray", "Referred to Apollo Hospital emergency"], summary: "Suspected pneumonia; referred for imaging and admission." },
  }),
  doc({
    id: "doc_2024_11_15_cxr", file: "Apollo_Chest_XRay_Nov2024.pdf", type: "imaging", title: "Chest X-Ray (PA view)",
    date: "2024-11-15", provider: "apollo_hosp", uploaded: "2026-05-02T10:45:00.000Z",
    diagnoses: [dx("pneumonia", "Right lower lobe consolidation")],
    notes: { findings: ["Homogeneous opacity in the right lower zone with air bronchograms", "Costophrenic angles clear", "Cardiac silhouette normal"], impression: "Right lower lobe consolidation, consistent with pneumonia." },
  }),
  doc({
    id: "doc_2024_11_16_labs", file: "Apollo_Admission_Bloods_Nov2024.pdf", type: "lab_report", title: "Admission Blood Panel",
    date: "2024-11-16", provider: "apollo_hosp", uploaded: "2026-05-02T10:46:00.000Z", pages: 3,
    labs: [
      lab("HB", "Haemoglobin", 13.1, "g/dL", 13.0, 17.0),
      lab("WBC", "Total Leucocyte Count", 14.8, "×10³/µL", 4.0, 11.0),
      lab("CRP", "C-Reactive Protein", 86, "mg/L", undefined, 5),
      lab("CREAT", "Creatinine", 1.04, "mg/dL", 0.7, 1.3),
      lab("FBG", "Random Blood Glucose", 118, "mg/dL", 70, 140, "70 – 140 (random)"),
    ],
  }),
  doc({
    id: "doc_2024_11_21_discharge", file: "Apollo_Discharge_Summary_Nov2024.pdf", type: "discharge_summary", title: "Discharge Summary — Pneumonia",
    date: "2024-11-21", provider: "apollo_hosp", clinician: "dr_rao", uploaded: "2026-05-02T10:48:00.000Z", pages: 4,
    diagnoses: [dx("pneumonia", "Community-acquired pneumonia, right lower lobe")],
    vitals: [bp(116, 74), pulse(82), temp(98.4), spo2(98), weight(75.8)],
    notes: {
      admission: { admittedOn: "2024-11-16", dischargedOn: "2024-11-21", ward: "General Medicine, Ward 4B" },
      chiefComplaint: "Fever, productive cough and right pleuritic chest pain.",
      findings: ["CRP 86 mg/L and TLC 14.8 on admission", "Sputum culture: Streptococcus pneumoniae, sensitive to ceftriaxone", "Afebrile from day 3; oxygen weaned on day 2"],
      plan: ["Oral cefuroxime for 5 days", "Follow-up with Dr. Anil Rao in 2 weeks with repeat chest X-ray", "Penicillin allergy noted — cephalosporin tolerated in hospital without reaction"],
      summary: "Admitted for 5 days with right lower lobe community-acquired pneumonia. Treated with IV ceftriaxone and oral azithromycin; discharged stable on oral cefuroxime.",
    },
    medications: [
      rx({ drug: "Ceftriaxone", drugClass: "antibiotic", strength: "1 g", form: "IV injection", frequency: "Once daily", durationDays: 5, action: "one_off", reasonConditionId: "pneumonia", reason: "Pneumonia (in hospital)" }),
      rx({ drug: "Azithromycin", drugClass: "antibiotic", strength: "500 mg", form: "Tablet", frequency: "Once daily", durationDays: 5, action: "one_off", reasonConditionId: "pneumonia", reason: "Pneumonia (in hospital)" }),
    ],
  }),
  doc({
    id: "doc_2024_11_21_rx", file: "Apollo_Discharge_Prescription_Nov2024.pdf", type: "prescription", title: "Discharge Prescription",
    date: "2024-11-21", provider: "apollo_hosp", clinician: "dr_rao", uploaded: "2026-05-02T10:49:00.000Z",
    medications: [
      rx({ drug: "Cefuroxime", brand: "Ceftum 500", drugClass: "antibiotic", strength: "500 mg", form: "Tablet", frequency: "Twice daily after food", durationDays: 5, action: "one_off", reasonConditionId: "pneumonia", reason: "Pneumonia (step-down after discharge)" }),
      rx({ drug: "Paracetamol", drugClass: "analgesic / antipyretic", strength: "650 mg", form: "Tablet", frequency: "As needed", durationDays: 5, action: "one_off", reasonConditionId: "pneumonia", reason: "Fever / pain" }),
    ],
  }),
  doc({
    id: "doc_2024_12_05_consult", file: "Apollo_Pulmonology_FollowUp_Dec2024.pdf", type: "consultation", title: "Pulmonology Follow-up",
    date: "2024-12-05", provider: "apollo_hosp", clinician: "dr_rao", uploaded: "2026-05-02T10:51:00.000Z",
    vitals: [bp(120, 78), pulse(72), spo2(99), weight(76.3)],
    diagnoses: [dx("pneumonia", "Community-acquired pneumonia — resolved")],
    notes: { chiefComplaint: "Post-discharge review.", findings: ["Asymptomatic", "Chest clear on auscultation", "Repeat X-ray: resolution of consolidation"], plan: ["No further antibiotics", "Pneumococcal vaccination advised"], summary: "Pneumonia fully resolved clinically and radiologically." },
  }),
  doc({
    id: "doc_2024_12_05_cxr", file: "Apollo_Chest_XRay_Followup_Dec2024.pdf", type: "imaging", title: "Chest X-Ray — Follow-up",
    date: "2024-12-05", provider: "apollo_hosp", uploaded: "2026-05-02T10:52:00.000Z",
    notes: { findings: ["Lung fields clear", "Previously noted right lower zone opacity has resolved"], impression: "Normal chest radiograph. Interval resolution of right lower lobe consolidation." },
  }),

  // ===== 2025 =====
  doc({
    id: "doc_2025_03_14_thyroid", file: "Metropolis_Thyroid_Profile_Mar2025.pdf", type: "lab_report", title: "Thyroid Profile",
    date: "2025-03-14", provider: "metropolis", uploaded: "2026-05-02T10:55:00.000Z",
    labs: thyroid(6.2, 1.0, 7.2, TSH_METRO),
  }),
  doc({
    id: "doc_2025_03_14_lipid", file: "Metropolis_Lipid_Profile_Mar2025.pdf", type: "lab_report", title: "Lipid Profile",
    date: "2025-03-14", provider: "metropolis", uploaded: "2026-05-02T10:56:00.000Z",
    labs: lipids(151, 41, 188, 226),
  }),
  doc({
    id: "doc_2025_03_14_hba1c", file: "Metropolis_HbA1c_Mar2025.pdf", type: "lab_report", title: "HbA1c & Fasting Glucose",
    date: "2025-03-14", provider: "metropolis", uploaded: "2026-05-02T10:57:00.000Z",
    labs: [lab("HBA1C", "HbA1c (NGSP)", 5.7, "%", 4.0, 5.6), lab("FBG", "Glucose, Fasting", 101, "mg/dL", 70, 100)],
  }),
  doc({
    id: "doc_2025_04_02_consult", file: "Iyer_Consultation_Apr2025.pdf", type: "consultation", title: "General Consultation",
    date: "2025-04-02", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T10:59:00.000Z",
    vitals: [bp(132, 86), weight(78.6), pulse(76)],
    diagnoses: [dx("dyslipidemia", "Dyslipidemia"), dx("subclinical_hypothyroidism", "Rising TSH, likely autoimmune thyroiditis", "provisional")],
    notes: { chiefComplaint: "Review of March 2025 reports.", findings: ["LDL 151 mg/dL despite 12 months of lifestyle changes", "Father had MI at 52", "TSH 6.2 mIU/L", "HbA1c 5.7% — at prediabetes threshold"], plan: ["Start atorvastatin 10 mg at night", "Thyroid ultrasound", "Refer to endocrinology (Dr. Rohan Mehta)", "Recheck lipids and ALT in 3 months"], summary: "Started statin for dyslipidemia with family history. Endocrinology referral for rising TSH." },
  }),
  doc({
    id: "doc_2025_04_02_rx", file: "Prescription_Iyer_Apr2025.pdf", type: "prescription", title: "Prescription",
    date: "2025-04-02", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T11:00:00.000Z",
    medications: [
      rx({ drug: "Atorvastatin", brand: "Atorva 10", drugClass: "statin (lipid-lowering)", strength: "10 mg", form: "Tablet", frequency: "Once daily", instructions: "At bedtime", action: "started", reasonConditionId: "dyslipidemia", reason: "Dyslipidemia" }),
    ],
  }),
  doc({
    id: "doc_2025_05_06_usg", file: "Manipal_Thyroid_Ultrasound_May2025.pdf", type: "imaging", title: "Ultrasound — Thyroid",
    date: "2025-05-06", provider: "manipal_rad", uploaded: "2026-05-02T11:02:00.000Z",
    notes: { findings: ["Both lobes normal in size", "Diffusely heterogeneous, mildly hypoechoic echotexture", "No focal nodules", "No cervical lymphadenopathy"], impression: "Features suggestive of thyroiditis. No nodules." },
  }),
  doc({
    id: "doc_2025_07_08_lipid", file: "Apollo_Lipid_Profile_Jul2025.pdf", type: "lab_report", title: "Lipid Profile & Liver Enzymes",
    date: "2025-07-08", provider: "apollo_diag", uploaded: "2026-05-02T11:04:00.000Z",
    labs: [...lipids(104, 45, 150, 176), lab("ALT", "ALT (SGPT)", 34, "U/L", undefined, 45)],
  }),
  doc({
    id: "doc_2025_08_11_consult", file: "Mehta_Endocrinology_Consultation_Aug2025.pdf", type: "consultation", title: "Endocrinology Consultation",
    date: "2025-08-11", provider: "mehta_endo", clinician: "dr_mehta", uploaded: "2026-05-02T11:06:00.000Z", pages: 2,
    vitals: [bp(128, 84), weight(79.0), pulse(70)],
    diagnoses: [dx("subclinical_hypothyroidism", "Subclinical hypothyroidism (Hashimoto's thyroiditis)")],
    notes: { chiefComplaint: "Referred for rising TSH. Reports tiredness and weight gain of 4 kg in 18 months.", findings: ["TSH 6.2 mIU/L (Mar 2025), rising trend since 2023", "Anti-TPO 68 IU/mL", "USG: thyroiditis pattern, no nodules", "T4 within range"], plan: ["Start levothyroxine 25 mcg", "Take on an empty stomach, 30–45 min before breakfast", "Repeat TSH in 8–12 weeks"], summary: "Subclinical hypothyroidism with autoimmune features and symptoms. Low-dose levothyroxine started." },
  }),
  doc({
    id: "doc_2025_08_11_rx", file: "Prescription_Mehta_Aug2025.pdf", type: "prescription", title: "Prescription",
    date: "2025-08-11", provider: "mehta_endo", clinician: "dr_mehta", uploaded: "2026-05-02T11:07:00.000Z",
    medications: [
      rx({ drug: "Levothyroxine", brand: "Thyronorm 25", drugClass: "thyroid hormone", strength: "25 mcg", form: "Tablet", frequency: "Once daily", instructions: "Before breakfast, empty stomach", action: "started", reasonConditionId: "subclinical_hypothyroidism", reason: "Subclinical hypothyroidism" }),
    ],
  }),
  doc({
    id: "doc_2025_11_20_vitd", file: "Metropolis_VitaminD_Nov2025.pdf", type: "lab_report", title: "Vitamin D (25-OH)",
    date: "2025-11-20", provider: "metropolis", uploaded: "2026-05-02T11:09:00.000Z",
    labs: [lab("VITD", "25 Hydroxy Vitamin D", 18.6, "ng/mL", 30, 100)],
  }),

  // ===== 2026 =====
  doc({
    id: "doc_2026_01_16_consult", file: "Mehta_Endocrinology_FollowUp_Jan2026.pdf", type: "consultation", title: "Endocrinology Follow-up",
    date: "2026-01-16", provider: "mehta_endo", clinician: "dr_mehta", uploaded: "2026-05-02T11:11:00.000Z",
    vitals: [bp(126, 82), weight(78.4), pulse(68)],
    diagnoses: [dx("subclinical_hypothyroidism", "Subclinical hypothyroidism")],
    notes: { chiefComplaint: "Follow-up on levothyroxine 25 mcg.", findings: ["Patient reports TSH 5.9 mIU/L from an outside lab (report not provided)", "Energy slightly better", "Tolerating medication well"], plan: ["Increase levothyroxine to 50 mcg", "Repeat thyroid profile in 3–6 months"], summary: "Inadequate TSH response on 25 mcg. Dose increased to 50 mcg." },
  }),
  doc({
    id: "doc_2026_01_16_rx", file: "Prescription_Mehta_Jan2026.pdf", type: "prescription", title: "Prescription",
    date: "2026-01-16", provider: "mehta_endo", clinician: "dr_mehta", uploaded: "2026-05-02T11:12:00.000Z",
    medications: [
      rx({ drug: "Levothyroxine", brand: "Thyronorm 50", drugClass: "thyroid hormone", strength: "50 mcg", form: "Tablet", frequency: "Once daily", instructions: "Before breakfast, empty stomach", action: "dose_changed", reasonConditionId: "subclinical_hypothyroidism", reason: "Subclinical hypothyroidism — dose increased from 25 mcg" }),
      rx({ drug: "Atorvastatin", drugClass: "statin (lipid-lowering)", strength: "10 mg", form: "Tablet", frequency: "Once daily", instructions: "At bedtime", action: "continued", reasonConditionId: "dyslipidemia", reason: "Dyslipidemia" }),
    ],
  }),
  doc({
    id: "doc_2026_02_09_consult", file: "Nair_ENT_Consultation_Feb2026.pdf", type: "consultation", title: "ENT Consultation",
    date: "2026-02-09", provider: "nair_ent", clinician: "dr_nair", uploaded: "2026-05-02T11:14:00.000Z",
    vitals: [bp(124, 80), temp(99.6), pulse(84)],
    diagnoses: [dx("acute_sinusitis", "Acute bacterial rhinosinusitis")],
    notes: { chiefComplaint: "Facial pain, blocked nose and thick discharge for 10 days, worsening after initial improvement.", findings: ["Tender maxillary sinuses", "Purulent discharge in middle meatus on endoscopy"], plan: ["Doxycycline for 7 days (penicillin allergy)", "Nasal steroid spray", "Saline nasal irrigation"], summary: "Acute bacterial sinusitis. Treated with doxycycline given penicillin allergy." },
  }),
  doc({
    id: "doc_2026_02_09_rx", file: "Prescription_Nair_Feb2026.pdf", type: "prescription", title: "Prescription",
    date: "2026-02-09", provider: "nair_ent", clinician: "dr_nair", uploaded: "2026-05-02T11:15:00.000Z",
    medications: [
      rx({ drug: "Doxycycline", brand: "Doxy-1 LDR", drugClass: "antibiotic", strength: "100 mg", form: "Capsule", frequency: "Twice daily after food", durationDays: 7, action: "one_off", reasonConditionId: "acute_sinusitis", reason: "Acute bacterial sinusitis" }),
      rx({ drug: "Fluticasone nasal spray", brand: "Flomist", drugClass: "nasal corticosteroid", strength: "50 mcg/spray", form: "Nasal spray", frequency: "2 sprays each nostril once daily", durationDays: 14, action: "one_off", reasonConditionId: "acute_sinusitis", reason: "Sinus congestion" }),
      rx({ drug: "Cetirizine", drugClass: "antihistamine", strength: "10 mg", form: "Tablet", frequency: "Once daily at night", durationDays: 7, action: "one_off", reasonConditionId: "acute_sinusitis", reason: "Nasal symptoms" }),
    ],
  }),
  doc({
    id: "doc_2026_03_06_vitd", file: "Apollo_VitaminD_Mar2026.pdf", type: "lab_report", title: "Vitamin D (25-OH)",
    date: "2026-03-06", provider: "apollo_diag", uploaded: "2026-05-02T11:17:00.000Z",
    labs: [lab("VITD", "Vitamin D, 25-Hydroxy", 17.2, "ng/mL", 30, 100)],
  }),
  doc({
    id: "doc_2026_03_10_consult", file: "Iyer_Consultation_Mar2026.pdf", type: "consultation", title: "General Consultation",
    date: "2026-03-10", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T11:19:00.000Z",
    vitals: [bp(124, 80), weight(78.0), pulse(70)],
    diagnoses: [dx("vitamin_d_deficiency", "Recurrent vitamin D deficiency"), dx("dyslipidemia", "Dyslipidemia — on treatment")],
    notes: { chiefComplaint: "Fatigue; review of vitamin D report.", findings: ["Vitamin D 17.2 ng/mL — fell again after stopping supplements in 2024", "Lipids at target on atorvastatin (Jul 2025)"], plan: ["Vitamin D3 60,000 IU weekly, continue long-term with periodic checks", "Continue atorvastatin 10 mg", "Lipid profile and HbA1c in June"], summary: "Recurrent vitamin D deficiency. Long-term weekly supplementation started." },
  }),
  doc({
    id: "doc_2026_03_10_rx", file: "Prescription_Iyer_Mar2026.pdf", type: "prescription", title: "Prescription",
    date: "2026-03-10", provider: "iyer_clinic", clinician: "dr_iyer", uploaded: "2026-05-02T11:20:00.000Z",
    medications: [
      rx({ drug: "Cholecalciferol (Vitamin D3)", brand: "Uprise-D3 60K", drugClass: "vitamin supplement", strength: "60,000 IU", form: "Capsule", frequency: "Once weekly", instructions: "With milk, after a meal", action: "started", reasonConditionId: "vitamin_d_deficiency", reason: "Vitamin D deficiency (recurrent)" }),
      rx({ drug: "Atorvastatin", drugClass: "statin (lipid-lowering)", strength: "10 mg", form: "Tablet", frequency: "Once daily", instructions: "At bedtime", action: "continued", reasonConditionId: "dyslipidemia", reason: "Dyslipidemia" }),
    ],
  }),
  doc({
    id: "doc_2026_06_18_lipid", file: "Apollo_Lipid_Profile_Jun2026.pdf", type: "lab_report", title: "Lipid Profile",
    date: "2026-06-18", provider: "apollo_diag", uploaded: "2026-06-19T08:40:00.000Z",
    labs: lipids(96, 47, 142, 168),
  }),
  doc({
    id: "doc_2026_06_18_hba1c", file: "Apollo_HbA1c_Jun2026.pdf", type: "lab_report", title: "HbA1c & Fasting Glucose",
    date: "2026-06-18", provider: "apollo_diag", uploaded: "2026-06-19T08:41:00.000Z",
    labs: [lab("HBA1C", "HbA1c", 5.5, "%", 4.0, 5.6), lab("FBG", "Fasting Plasma Glucose", 94, "mg/dL", 70, 100)],
  }),
  doc({
    id: "doc_2026_06_18_vitd", file: "Apollo_VitaminD_Jun2026.pdf", type: "lab_report", title: "Vitamin D (25-OH)",
    date: "2026-06-18", provider: "apollo_diag", uploaded: "2026-06-19T08:42:00.000Z",
    labs: [lab("VITD", "Vitamin D, 25-Hydroxy", 34.8, "ng/mL", 30, 100)],
  }),
  doc({
    id: "doc_2026_06_18_cbc", file: "Apollo_CBC_KFT_Jun2026.pdf", type: "lab_report", title: "Blood Count & Kidney Function",
    date: "2026-06-18", provider: "apollo_diag", uploaded: "2026-06-19T08:43:00.000Z", pages: 2,
    labs: [
      lab("HB", "Haemoglobin", 14.9, "g/dL", 13.0, 17.0),
      lab("WBC", "Total Leucocyte Count", 6.8, "×10³/µL", 4.0, 11.0),
      lab("CREAT", "Creatinine", 0.98, "mg/dL", 0.7, 1.3),
      lab("ALT", "ALT (SGPT)", 29, "U/L", undefined, 45),
    ],
  }),
  doc({
    id: "doc_2026_08_04_consult", file: "Mehta_Endocrinology_Consultation_Aug2026.pdf", type: "consultation", title: "Endocrinology Consultation",
    date: "2026-08-04", provider: "mehta_endo", clinician: "dr_mehta", uploaded: "2026-08-04T15:10:00.000Z",
    vitals: [bp(122, 78), weight(77.2), pulse(68)],
    diagnoses: [dx("subclinical_hypothyroidism", "Subclinical hypothyroidism")],
    notes: { chiefComplaint: "Follow-up for elevated TSH.", findings: ["Feels more energetic; weight down 1.8 kg since January", "No palpitations or tremor", "Adherent to levothyroxine 50 mcg"], plan: ["Continue levothyroxine 50 mcg", "Thyroid profile in 4–6 weeks", "Review with report"], summary: "Clinically improving on 50 mcg. Continue and recheck TSH." },
  }),
  doc({
    id: "doc_2026_08_04_rx", file: "Prescription_Aug_2026.pdf", type: "prescription", title: "Prescription",
    date: "2026-08-04", provider: "mehta_endo", clinician: "dr_mehta", uploaded: "2026-08-04T15:11:00.000Z",
    medications: [
      rx({ drug: "Levothyroxine", brand: "Thyronorm 50", drugClass: "thyroid hormone", strength: "50 mcg", form: "Tablet", frequency: "Once daily", instructions: "Before breakfast, empty stomach", action: "continued", reasonConditionId: "subclinical_hypothyroidism", reason: "Subclinical hypothyroidism" }),
    ],
  }),
  doc({
    id: "doc_2026_09_12_thyroid", file: "Thyroid_Profile_Sep_2026.pdf", type: "lab_report", title: "Thyroid Profile",
    date: "2026-09-12", provider: "metropolis", uploaded: "2026-09-13T07:52:00.000Z", confidence: 0.96,
    labs: thyroid(5.4, 1.1, 7.6, TSH_METRO),
  }),
];

export const appointments: Appointment[] = [
  { id: "apt_endo_oct26", date: "2026-10-14", title: "Endocrinology Follow-up", kind: "consultation", clinicianId: "dr_mehta", providerId: "mehta_endo", note: "Review September thyroid profile on levothyroxine 50 mcg.", sourceDocumentId: "doc_2026_08_04_consult" },
  { id: "apt_labs_dec26", date: "2026-12-12", title: "Vitamin D & Lipid Recheck", kind: "test", clinicianId: "dr_iyer", providerId: "apollo_diag", note: "Periodic checks on weekly vitamin D3 and atorvastatin.", sourceDocumentId: "doc_2026_03_10_consult" },
];

export const seedSnapshot: HealthSnapshot = { patient, providers, conditions, documents, appointments };
