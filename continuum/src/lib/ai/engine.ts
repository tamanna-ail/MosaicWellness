/**
 * Local retrieval engine for "Ask your health history".
 *
 * It answers by querying the structured record (never free-generating), so
 * every statement is grounded in a document. It runs entirely client-side
 * and is also the draft + guard-rail for the optional LLM provider.
 */
import type { HealthSnapshot, MedicalDocument } from "@/lib/types";
import { BIOMARKER_CONDITIONS, BIOMARKERS, formatValue, getBiomarker, type BiomarkerDef } from "@/lib/health/biomarkers";
import {
  activeMedications,
  allergies,
  biomarkerSeries,
  conditionSummaries,
  DOC_TYPE_LABEL,
  documentFacilityName,
  documentSourceName,
  fmtDate,
  getDocument,
  getProvider,
  medicationCourses,
  medicationEvents,
  monthsBetween,
  searchRecords,
  sortedDocuments,
  todayISO,
  type LabPoint,
  type MedicationEvent,
} from "@/lib/health/selectors";
import type { AiAnswer, AnswerItem, Citation } from "./types";

// ---------------------------------------------------------------- parsing

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1 };

export interface TimeWindow {
  from: string;
  label: string;
}

/** "last 3 years" counts whole calendar years back (since 1 Jan), which matches how people talk about history. */
export function parseWindow(q: string, today = todayISO()): TimeWindow | undefined {
  const m = q.match(/(?:last|past|previous)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a)?\s*(year|month)s?/i);
  if (m) {
    const n = m[1] ? (NUM_WORDS[m[1].toLowerCase()] ?? Number(m[1])) : 1;
    const [y, mo] = today.split("-").map(Number);
    if (m[2].toLowerCase() === "year") {
      const from = `${y - n}-01-01`;
      return { from, label: `since January ${y - n}` };
    }
    const d = new Date(Date.UTC(y, mo - 1 - n, 1));
    const from = d.toISOString().slice(0, 10);
    return { from, label: `since ${fmtDate(from, "month")}` };
  }
  const since = q.match(/since\s+(20\d\d)/i);
  if (since) return { from: `${since[1]}-01-01`, label: `since ${since[1]}` };
  return undefined;
}

function detectBiomarkers(q: string): BiomarkerDef[] {
  const lower = ` ${q.toLowerCase()} `;
  const found: BiomarkerDef[] = [];
  for (const b of BIOMARKERS) {
    if (b.aliases.some((a) => new RegExp(`[^a-z]${a.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}[^a-z]`).test(lower))) found.push(b);
  }
  // "thyroid" / "cholesterol" are umbrella words: lead with the primary marker.
  const primaryFirst = ["TSH", "LDL", "HBA1C", "VITD"];
  return found.sort((a, b) => {
    const ai = primaryFirst.indexOf(a.code);
    const bi = primaryFirst.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

const CONDITION_KEYWORDS: { re: RegExp; category?: string; ids?: string[]; label: string }[] = [
  { re: /respiratory|chest infection|lung|cough|cold|flu|bronch|pneumon|sinus|throat|urti|infection/i, category: "respiratory", label: "respiratory infections" },
  { re: /thyroid|hypothyroid|hashimoto/i, ids: ["subclinical_hypothyroidism"], label: "thyroid" },
  { re: /cholesterol|lipid|dyslipid/i, ids: ["dyslipidemia"], label: "cholesterol" },
  { re: /vitamin d|vit d/i, ids: ["vitamin_d_deficiency"], label: "vitamin D" },
];

const CLASS_KEYWORDS: { re: RegExp; match: (cls: string) => boolean; label: string }[] = [
  { re: /antibiotic|antibacterial|anti-biotic/i, match: (c) => c.includes("antibiotic"), label: "antibiotics" },
  { re: /statin/i, match: (c) => c.includes("statin"), label: "statins" },
  { re: /painkiller|pain killer|analgesic|nsaid/i, match: (c) => c.includes("analgesic") || c.includes("nsaid"), label: "pain relievers" },
  { re: /antihistamine|allergy medicine/i, match: (c) => c.includes("antihistamine"), label: "antihistamines" },
  { re: /supplement|vitamin/i, match: (c) => c.includes("vitamin"), label: "supplements" },
];

const PENICILLINS = /amoxicillin|ampicillin|penicillin|cloxacillin|piperacillin|augmentin/i;

// ---------------------------------------------------------------- helpers

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const count = (n: number) => NUMBER_WORDS[n] ?? String(n);
const plural = (n: number, one: string, many = one + "s") => `${count(n)} ${n === 1 ? one : many}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const possessive = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

function citation(s: HealthSnapshot, id: string): Citation | undefined {
  const d = getDocument(s, id);
  if (!d) return undefined;
  return { documentId: d.id, title: d.title, date: d.clinicalDate, provider: documentFacilityName(s, d) };
}

export function collectSources(s: HealthSnapshot, ...groups: (AnswerItem[] | string[] | undefined)[]): Citation[] {
  const ids = new Set<string>();
  for (const g of groups) for (const x of g ?? []) (typeof x === "string" ? [x] : (x.sources ?? [])).forEach((id) => ids.add(id));
  return [...ids]
    .map((id) => citation(s, id))
    .filter((c): c is Citation => !!c)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function range(p: Pick<LabPoint, "refText" | "refLow" | "refHigh">) {
  return p.refText ?? (p.refLow !== undefined && p.refHigh !== undefined ? `${p.refLow}–${p.refHigh}` : "not printed");
}

function val(def: BiomarkerDef, v: number) {
  return `${formatValue(v, def.decimals)} ${def.canonicalUnit}`;
}

function base(intent: AiAnswer["intent"], summary: string): AiAnswer {
  return { intent, summary, facts: [], calculations: [], interpretation: [], gaps: [], sources: [], followUps: [], engine: "local" };
}

function prescriber(s: HealthSnapshot, e: { prescriberId?: string; documentId: string }) {
  return getProvider(s, e.prescriberId)?.name ?? documentSourceName(s, getDocument(s, e.documentId)!);
}

/** Notes that mention a value for this marker without an uploaded report behind it. */
function unsourcedMentions(s: HealthSnapshot, def: BiomarkerDef) {
  const out: { doc: MedicalDocument; text: string }[] = [];
  for (const d of s.documents) {
    for (const f of d.extracted.notes?.findings ?? []) {
      if (new RegExp(`\\b${def.shortName}\\b`, "i").test(f) && /outside lab|not provided|not uploaded|verbal/i.test(f)) out.push({ doc: d, text: f });
    }
  }
  return out;
}

// ---------------------------------------------------------------- intents

function answerBiomarkerTrend(s: HealthSnapshot, def: BiomarkerDef, window?: TimeWindow): AiAnswer {
  const series = biomarkerSeries(s, def.code)!;
  const all = series.points;
  const pts = window ? all.filter((p) => p.date >= window.from) : all;

  if (pts.length === 0) {
    const a = base("biomarker_trend", all.length
      ? `I couldn't find any ${def.shortName} results ${window?.label ?? ""}. Your most recent one is from ${fmtDate(all.at(-1)!.date, "month")}.`
      : `I couldn't find any ${def.shortName} results in your records. If you have a report, add it under Records and I'll include it.`);
    a.followUps = ["Summarize my health history.", "What changed between my last two prescriptions?"];
    return a;
  }

  const first = pts[0];
  const last = pts.at(-1)!;
  const peak = pts.reduce((m, p) => (p.canonicalValue! > m.canonicalValue! ? p : m), first);
  const trough = pts.reduce((m, p) => (p.canonicalValue! < m.canonicalValue! ? p : m), first);
  const nDocs = new Set(pts.map((p) => p.documentId)).size;

  let movement: string;
  if (pts.length === 1) {
    movement = `Your only ${def.shortName} result is ${val(def, last.canonicalValue!)} on ${fmtDate(last.date, "long")}.`;
  } else if (peak !== first && peak !== last && peak.canonicalValue! > first.canonicalValue! && peak.canonicalValue! > last.canonicalValue!) {
    movement = `Your ${def.shortName} increased from ${val(def, first.canonicalValue!)} in ${fmtDate(first.date, "month")} to ${val(def, peak.canonicalValue!)} in ${fmtDate(peak.date, "month")}, before decreasing to ${val(def, last.canonicalValue!)} in ${fmtDate(last.date, "month")}.`;
  } else if (trough !== first && trough !== last && trough.canonicalValue! < first.canonicalValue! && trough.canonicalValue! < last.canonicalValue!) {
    movement = `Your ${def.shortName} fell from ${val(def, first.canonicalValue!)} in ${fmtDate(first.date, "month")} to ${val(def, trough.canonicalValue!)} in ${fmtDate(trough.date, "month")}, then rose to ${val(def, last.canonicalValue!)} in ${fmtDate(last.date, "month")}.`;
  } else {
    const dir = last.canonicalValue! > first.canonicalValue! ? "increased" : last.canonicalValue! < first.canonicalValue! ? "decreased" : "stayed at";
    movement = `Your ${def.shortName} ${dir} from ${val(def, first.canonicalValue!)} in ${fmtDate(first.date, "month")} to ${val(def, last.canonicalValue!)} in ${fmtDate(last.date, "month")}.`;
  }

  const a = base(
    "biomarker_trend",
    `Your records contain ${plural(nDocs, def.group === "Thyroid" ? "thyroid profile" : `${def.shortName} result`)} between ${fmtDate(first.date, "month")} and ${fmtDate(last.date, "month")}${window && pts.length < all.length ? ` (${window.label})` : ""}. ${movement}`,
  );

  // ---- facts
  const years = [...new Set(pts.map((p) => p.date.slice(0, 4)))];
  const firstAbnormal = pts.find((p) => p.flag === "high" || p.flag === "low");
  const normalYears = years.filter((y) => {
    const inYear = pts.filter((p) => p.date.startsWith(y));
    return inYear.length > 0 && inYear.every((p) => p.flag === "normal") && (!firstAbnormal || y < firstAbnormal.date.slice(0, 4));
  });
  if (normalYears.length && firstAbnormal) {
    a.facts.push({
      text: `${def.shortName} remained within the recorded laboratory reference range in ${normalYears.length === 1 ? normalYears[0] : `${normalYears.slice(0, -1).join(", ")} and ${normalYears.at(-1)}`}.`,
      sources: pts.filter((p) => normalYears.includes(p.date.slice(0, 4))).map((p) => p.documentId),
    });
  }
  if (firstAbnormal) {
    a.facts.push({
      text: `${firstAbnormal === first ? `It was already ${firstAbnormal.flag === "high" ? "above" : "below"} the recorded reference range in the first result` : `It ${firstAbnormal.flag === "high" ? "increased above" : "fell below"} the recorded reference range`} in ${fmtDate(firstAbnormal.date, "month")} (${val(def, firstAbnormal.canonicalValue!)}; that report's range ${range(firstAbnormal)}).`,
      sources: [firstAbnormal.documentId],
    });
  } else {
    a.facts.push({ text: `Every ${def.shortName} result in this period was within the reference range printed on its own report.`, sources: pts.map((p) => p.documentId) });
  }
  if (pts.length > 1) {
    a.facts.push({ text: `Your highest recorded ${def.shortName} was ${val(def, peak.canonicalValue!)} in ${fmtDate(peak.date, "month")}.`, sources: [peak.documentId] });
    if (trough !== first || def.code === "VITD")
      a.facts.push({ text: `Your lowest recorded ${def.shortName} was ${val(def, trough.canonicalValue!)} in ${fmtDate(trough.date, "month")}.`, sources: [trough.documentId] });
  }
  a.facts.push({
    text: `Your latest recorded result is ${val(def, last.canonicalValue!)} (${fmtDate(last.date)}), ${last.flag === "normal" ? "within" : last.flag === "high" ? "above" : last.flag === "low" ? "below" : "compared with"} that report's range of ${range(last)}.`,
    sources: [last.documentId],
  });

  // ---- calculations
  if (pts.length > 1) {
    const prev = pts.at(-2)!;
    const d1 = last.canonicalValue! - prev.canonicalValue!;
    a.calculations.push({
      text: `Change from the previous result (${fmtDate(prev.date, "monthShort")}): ${d1 >= 0 ? "+" : "−"}${formatValue(Math.abs(d1), def.decimals)} ${def.canonicalUnit} (${d1 >= 0 ? "+" : "−"}${Math.abs((d1 / prev.canonicalValue!) * 100).toFixed(1)}%).`,
      sources: [prev.documentId, last.documentId],
    });
    const d2 = last.canonicalValue! - first.canonicalValue!;
    a.calculations.push({
      text: `Change since the first result in this period (${fmtDate(first.date, "monthShort")}): ${d2 >= 0 ? "+" : "−"}${formatValue(Math.abs(d2), def.decimals)} ${def.canonicalUnit} (${d2 >= 0 ? "+" : "−"}${Math.abs((d2 / first.canonicalValue!) * 100).toFixed(0)}%).`,
      sources: [first.documentId, last.documentId],
    });
  }
  const ranges = [...new Set(pts.map((p) => range(p)))];
  if (ranges.length > 1) {
    a.calculations.push({ text: `Reference ranges differ between labs (${ranges.join("; ")}). Each result was compared against the range printed on its own report, not a single universal range.` });
  }
  const converted = pts.filter((p) => p.converted);
  if (converted.length) {
    a.calculations.push({
      text: `${cap(plural(converted.length, "result"))} reported in ${converted[0].unit} ${converted.length === 1 ? "was" : "were"} converted to ${def.canonicalUnit} using a standard factor so they can be compared (e.g. ${formatValue(converted[0].value, 0)} ${converted[0].unit} ≈ ${val(def, converted[0].canonicalValue!)}).`,
      sources: converted.map((p) => p.documentId),
    });
  }
  if (series.excluded.length) {
    a.calculations.push({
      text: `${cap(plural(series.excluded.length, "result"))} could not be compared because the unit (${series.excluded.map((p) => p.unit).join(", ")}) has no safe conversion, so ${series.excluded.length === 1 ? "it is" : "they are"} listed but not charted.`,
      sources: series.excluded.map((p) => p.documentId),
    });
  }

  // ---- interpretation: treatment context, carefully worded
  const conditionIds = BIOMARKER_CONDITIONS[def.code] ?? [];
  const treatment = medicationEvents(s).filter((e) => e.reasonConditionId && conditionIds.includes(e.reasonConditionId) && e.action !== "one_off" && e.date >= first.date);
  if (treatment.length) {
    const started = treatment.find((e) => e.action === "started");
    const changes = treatment.filter((e) => e.action === "dose_changed");
    const parts: string[] = [];
    if (started) parts.push(`${started.drug.replace(/ \(.*\)/, "")} ${started.strength} was started on ${fmtDate(started.date, "long")}`);
    for (const c of changes) parts.push(`the dose was changed to ${c.strength} on ${fmtDate(c.date, "long")}`);
    const afterTreatment = started ? pts.filter((p) => p.date > started.date) : [];
    let tail = "";
    if (started && afterTreatment.length === 0) tail = ` There is no ${def.shortName} result in your records after treatment began.`;
    else if (started) {
      const before = pts.filter((p) => p.date <= started.date).at(-1);
      if (before) {
        const delta = afterTreatment.at(-1)!.canonicalValue! - before.canonicalValue!;
        tail = ` The latest result after starting treatment is ${delta < 0 ? "lower" : delta > 0 ? "higher" : "unchanged"} compared with the last result before it (${val(def, before.canonicalValue!)} → ${val(def, afterTreatment.at(-1)!.canonicalValue!)})${afterTreatment.at(-1)!.flag !== "normal" ? ", but still outside its report's range" : ""}.`;
      }
    }
    a.interpretation.push({ text: `${cap(parts.join(", and "))}.${tail} Your doctor is best placed to judge whether this is the expected response.`, sources: treatment.map((e) => e.documentId) });
  }
  if (firstAbnormal && last.flag !== "normal" && pts.filter((p) => p.date >= firstAbnormal.date).every((p) => p.flag !== "normal")) {
    a.interpretation.push({ text: `Every ${def.shortName} result since ${fmtDate(firstAbnormal.date, "month")} has been outside its report's reference range, so this is a sustained pattern rather than a one-off reading.` });
  }

  // ---- gaps
  for (let i = 1; i < all.length; i++) {
    const gap = monthsBetween(all[i - 1].date, all[i].date);
    if (gap > 12 && (!window || all[i].date >= window.from)) {
      a.gaps.push(`I found reports from ${fmtDate(all[i - 1].date, "month")} and ${fmtDate(all[i].date, "month")}, but I don't have ${def.shortName} results covering the ${gap} months between them.`);
    }
  }
  for (const m of unsourcedMentions(s, def)) {
    a.gaps.push(`Your ${fmtDate(m.doc.clinicalDate, "month")} ${m.doc.title.toLowerCase()} notes: "${m.text}". That report isn't in your records, so the value isn't charted or counted.`);
    a.sources.push(citation(s, m.doc.id)!);
  }

  a.chart = {
    biomarker: def.code,
    label: def.shortName,
    unit: def.canonicalUnit,
    decimals: def.decimals,
    points: pts.map((p) => ({ date: p.date, value: p.canonicalValue!, refLow: convertRef(def, p, p.refLow), refHigh: convertRef(def, p, p.refHigh), documentId: p.documentId, flag: p.flag, converted: p.converted })),
  };
  a.sources = dedupe([...collectSources(s, pts.map((p) => p.documentId)), ...a.sources]);
  a.followUps = [
    `When did my ${def.shortName} first become abnormal?`,
    def.group === "Thyroid" ? "How has my levothyroxine dose changed?" : "What changed between my last two prescriptions?",
    "Summarize my treatment history for my new doctor.",
  ];
  a.action = { label: `Open ${def.shortName} in Health Data`, href: `/health/${def.code.toLowerCase()}` };
  return a;
}

function convertRef(def: BiomarkerDef, p: LabPoint, ref?: number) {
  if (ref === undefined || p.canonicalValue === null) return undefined;
  return p.converted ? (ref * p.canonicalValue) / p.value : ref;
}

function dedupe(c: Citation[]) {
  const seen = new Set<string>();
  return c.filter((x) => (seen.has(x.documentId) ? false : (seen.add(x.documentId), true))).sort((a, b) => a.date.localeCompare(b.date));
}

function answerFirstAbnormal(s: HealthSnapshot, def: BiomarkerDef): AiAnswer {
  const series = biomarkerSeries(s, def.code)!;
  const pts = series.points;
  const idx = pts.findIndex((p) => p.flag === "high" || p.flag === "low");
  if (pts.length === 0) return base("first_abnormal", `I couldn't find any ${def.shortName} results in your records.`);
  if (idx === -1) {
    const a = base("first_abnormal", `None of your ${pts.length} ${def.shortName} results is outside the reference range printed on its report. The latest is ${val(def, pts.at(-1)!.canonicalValue!)} on ${fmtDate(pts.at(-1)!.date, "long")}.`);
    a.sources = collectSources(s, pts.map((p) => p.documentId));
    return a;
  }
  const p = pts[idx];
  const prev = pts[idx - 1];
  const a = base(
    "first_abnormal",
    `Your ${def.shortName} first ${p.flag === "high" ? "rose above" : "fell below"} its report's reference range on ${fmtDate(p.date, "long")}: ${val(def, p.canonicalValue!)}, against ${possessive(getProvider(s, p.providerId)?.name ?? "the lab")} range of ${range(p)} ${p.unit}.`,
  );
  a.facts.push({ text: `${fmtDate(p.date)} — ${def.shortName} ${val(def, p.canonicalValue!)} (range ${range(p)}), flagged ${p.flag}.`, sources: [p.documentId] });
  if (prev) a.facts.push({ text: `The previous result, ${val(def, prev.canonicalValue!)} on ${fmtDate(prev.date)}, was within its report's range (${range(prev)}).`, sources: [prev.documentId] });
  const after = pts.slice(idx + 1);
  if (after.length) {
    const out = after.filter((x) => x.flag !== "normal").length;
    a.facts.push({ text: `${out} of ${after.length} later result${after.length > 1 ? "s were" : " was"} also outside range: ${after.map((x) => `${formatValue(x.canonicalValue!, def.decimals)} (${fmtDate(x.date, "monthShort")})`).join(", ")}.`, sources: after.map((x) => x.documentId) });
  }
  const others = [...new Set(pts.map((x) => range(x)))].filter((r) => r !== range(p));
  if (others.length) {
    a.calculations.push({ text: `Other labs in your records use different ranges (${others.join("; ")}). The answer above uses the range printed on each specific report.` });
  }
  if (prev) a.calculations.push({ text: `Rise between those two reports: ${formatValue(p.canonicalValue! - prev.canonicalValue!, def.decimals)} ${def.canonicalUnit} over ${monthsBetween(prev.date, p.date)} months.`, sources: [prev.documentId, p.documentId] });
  a.interpretation.push({ text: `A single result just outside range can reflect lab variation; a pattern across reports is more meaningful. Use this as context for a conversation with your doctor.` });
  a.chart = answerBiomarkerTrend(s, def).chart;
  a.sources = collectSources(s, a.facts);
  a.followUps = [`How has my ${def.shortName} changed over time?`, "Summarize my treatment history for my new doctor."];
  return a;
}

function episodeLabel(s: HealthSnapshot, conditionId?: string, fallback?: string) {
  return s.conditions.find((c) => c.id === conditionId)?.name ?? fallback ?? "Unspecified";
}

function answerMedications(s: HealthSnapshot, q: string, window?: TimeWindow): AiAnswer {
  const cls = CLASS_KEYWORDS.find((c) => c.re.test(q));
  const cond = CONDITION_KEYWORDS.find((c) => c.re.test(q));
  const condIds = cond ? (cond.ids ?? s.conditions.filter((c) => c.category === cond.category).map((c) => c.id)) : undefined;

  let events = medicationEvents(s).filter((e) => e.action !== "stopped");
  if (cls) events = events.filter((e) => cls.match(e.drugClass.toLowerCase()));
  if (condIds) events = events.filter((e) => e.reasonConditionId && condIds.includes(e.reasonConditionId));
  if (window) events = events.filter((e) => e.date >= window.from);

  const what = cls ? cls.label : "medicines";
  const forWhat = cond ? ` for ${cond.label}` : "";
  if (!events.length) {
    const a = base("medications", `I couldn't find any ${what}${forWhat} in your records${window ? ` ${window.label}` : ""}.`);
    a.followUps = ["What medications am I currently taking?", "Summarize my health history."];
    return a;
  }

  // Group into episodes: same reason, within 30 days.
  const episodes: { reason: string; date: string; events: MedicationEvent[] }[] = [];
  for (const e of events) {
    const reason = episodeLabel(s, e.reasonConditionId, e.reason);
    const ep = episodes.find((x) => x.reason === reason && Math.abs(monthsBetween(x.date, e.date)) <= 1);
    if (ep) ep.events.push(e);
    else episodes.push({ reason, date: e.date, events: [e] });
  }
  const systemic = events.filter((e) => !/topical/.test(e.drugClass));
  const topical = events.filter((e) => /topical/.test(e.drugClass));

  const a = base(
    "medications",
    `I found ${plural(systemic.length, `${cls ? what.replace(/s$/, "") : "medicine"} prescription`)}${forWhat} across ${plural(episodes.length, "episode")} between ${fmtDate(events[0].date, "month")} and ${fmtDate(events.at(-1)!.date, "month")}${window ? ` (${window.label})` : ""}.${topical.length ? ` Your records also include ${plural(topical.length, "topical antibiotic")} (${topical.map((t) => t.drug).join(", ")}).` : ""}`,
  );

  for (const ep of episodes) {
    a.facts.push({
      text: `${fmtDate(ep.date, "month")} · ${ep.reason}: ${ep.events.map((e) => `${e.drug} ${e.strength}${e.durationDays ? ` for ${e.durationDays} days` : ""}`).join(", ")} — ${prescriber(s, ep.events[0])}.`,
      sources: [...new Set(ep.events.map((e) => e.documentId))],
    });
  }
  const byDrug = new Map<string, number>();
  for (const e of systemic) byDrug.set(e.drug, (byDrug.get(e.drug) ?? 0) + 1);
  const ranked = [...byDrug.entries()].sort((x, y) => y[1] - x[1]);
  a.calculations.push({ text: `By medicine: ${ranked.map(([d, n]) => `${d} ×${n}`).join(", ")}.` });
  if (cls?.label === "antibiotics") {
    const spanYears = Math.max(1, monthsBetween(events[0].date, todayISO()) / 12);
    a.calculations.push({ text: `That is about ${(episodes.filter((e) => e.events.some((x) => !/topical/.test(x.drugClass))).length / spanYears).toFixed(1)} systemic antibiotic episodes per year over ${spanYears.toFixed(1)} years.` });
  }

  const alg = allergies(s).find((x) => /penicillin/i.test(x.substance));
  if (alg && (cls?.label === "antibiotics" || cond?.category === "respiratory")) {
    const later = systemic.filter((e) => e.date > alg.date && e.drugClass.includes("antibiotic"));
    const penAfter = later.filter((e) => PENICILLINS.test(e.drug + " " + (e.brand ?? "")));
    a.interpretation.push({
      text: penAfter.length
        ? `Note: ${penAfter.map((e) => e.drug).join(", ")} appears after your penicillin allergy was recorded on ${fmtDate(alg.date, "long")}. Worth confirming with your doctor.`
        : `Your penicillin allergy was recorded on ${fmtDate(alg.date, "long")} after a rash on amoxicillin-clavulanate. Every antibiotic prescribed after that date (${[...new Set(later.map((e) => e.drug))].join(", ")}) is outside the penicillin family, consistent with that allergy.`,
      sources: [alg.documentId],
    });
  }

  a.table = {
    columns: ["Date", "Medicine", "Dose", "Duration", "Reason", "Prescriber"],
    rows: events.map((e) => ({ cells: [fmtDate(e.date), e.drug, `${e.strength} · ${e.frequency}`, e.durationDays ? `${e.durationDays} days` : "Long-term", episodeLabel(s, e.reasonConditionId, e.reason), prescriber(s, e)], documentId: e.documentId })),
  };
  a.sources = collectSources(s, a.facts, a.interpretation);
  a.followUps = ["Show me every time I was diagnosed with a respiratory infection.", "What medications am I currently taking?", "What changed between my last two prescriptions?"];
  return a;
}

function answerCurrentMeds(s: HealthSnapshot): AiAnswer {
  const meds = activeMedications(s);
  const a = base("medications", meds.length ? `You have ${plural(meds.length, "active medication")} in your records.` : "I couldn't find any active medications in your records.");
  for (const m of meds) {
    const c = m.current;
    a.facts.push({ text: `${c.drug} ${c.strength} — ${c.frequency}${c.instructions ? `, ${c.instructions.toLowerCase()}` : ""}. Started ${fmtDate(m.firstDate, "month")} by ${prescriber(s, m.startedEvent)}; last prescribed ${fmtDate(c.date, "long")}.`, sources: [...new Set(m.events.map((e) => e.documentId))] });
    const changes = m.events.filter((e) => e.action === "dose_changed");
    if (changes.length) a.calculations.push({ text: `${c.drug}: ${changes.length} dose change${changes.length > 1 ? "s" : ""} (${m.startedEvent.strength} → ${c.strength}).`, sources: changes.map((e) => e.documentId) });
  }
  a.interpretation.push({ text: "This list is built from prescriptions you've uploaded. If you've stopped or started anything since, it won't be reflected until a new record is added." });
  a.sources = collectSources(s, a.facts);
  a.followUps = ["How has my levothyroxine dose changed?", "What antibiotics have I been prescribed over the past three years?"];
  a.action = { label: "Open Medications", href: "/medications" };
  return a;
}

function answerMedicationHistory(s: HealthSnapshot, drugQuery: string): AiAnswer | undefined {
  const courses = medicationCourses(s).filter((c) => c.drug.toLowerCase().includes(drugQuery) || c.drugClass.toLowerCase().includes(drugQuery));
  if (!courses.length) return undefined;
  const events = courses.flatMap((c) => c.events).sort((x, y) => x.date.localeCompare(y.date));
  const name = courses[0].drug;
  const a = base("medication_history", "");
  const steps: string[] = [];
  for (const e of events) {
    const verb = e.action === "started" ? "started at" : e.action === "dose_changed" ? "changed to" : e.action === "continued" ? "continued at" : e.action === "stopped" ? "stopped" : "prescribed at";
    steps.push(`${verb} ${e.action === "stopped" ? "" : e.strength + " "}on ${fmtDate(e.date, "long")}`);
    a.facts.push({ text: `${fmtDate(e.date)} — ${e.drug} ${e.strength}, ${e.frequency.toLowerCase()}${e.instructions ? ` (${e.instructions.toLowerCase()})` : ""}: ${e.action.replace("_", " ")} by ${prescriber(s, e)}.`, sources: [e.documentId] });
  }
  a.summary = `${name} was ${steps.join(", then ")}.${courses.some((c) => c.active) ? " It is still active." : ""}`;
  const strengths = events.map((e) => parseFloat(e.strength)).filter((x) => !isNaN(x));
  if (strengths.length > 1 && strengths[0] !== strengths.at(-1)) a.calculations.push({ text: `Dose changed from ${events[0].strength} to ${events.at(-1)!.strength} (${(strengths.at(-1)! / strengths[0]).toFixed(1)}×) over ${monthsBetween(events[0].date, events.at(-1)!.date)} months.` });
  const linked = Object.entries(BIOMARKER_CONDITIONS).find(([, ids]) => ids.includes(events[0].reasonConditionId ?? ""));
  if (linked) {
    const ser = biomarkerSeries(s, linked[0]);
    const def = getBiomarker(linked[0])!;
    if (ser?.points.length) {
      const near = ser.points.filter((p) => p.date >= events[0].date);
      const before = ser.points.filter((p) => p.date < events[0].date).at(-1);
      const fv = (p: LabPoint) => `${val(def, p.canonicalValue!)} (${fmtDate(p.date, "monthShort")})`;
      a.interpretation.push({
        text: near.length
          ? `Your records hold ${plural(near.length, `${def.shortName} result`)} since ${name} started: ${near.map(fv).join(", ")}${before ? `, compared with ${fv(before)} before it` : ""}. With ${near.length === 1 ? "a single follow-up result" : "few results"}, it's too early to call this a trend; your doctor can judge whether the response is as expected.`
          : `There are no ${def.shortName} reports in your records after ${name} was started; the last one is from ${fmtDate(ser.points.at(-1)!.date, "month")}.`,
        sources: [...near.map((p) => p.documentId), ...(before ? [before.documentId] : [])],
      });
      a.chart = answerBiomarkerTrend(s, def).chart;
    }
  }
  a.sources = collectSources(s, a.facts, a.interpretation);
  a.followUps = ["What changed between my last two prescriptions?", "What medications am I currently taking?"];
  return a;
}

function answerDiagnoses(s: HealthSnapshot, q: string, window?: TimeWindow): AiAnswer {
  const cond = CONDITION_KEYWORDS.find((c) => c.re.test(q));
  const ids = cond ? (cond.ids ?? s.conditions.filter((c) => c.category === cond.category).map((c) => c.id)) : s.conditions.map((c) => c.id);
  const summaries = conditionSummaries(s).filter((c) => ids.includes(c.condition.id));

  // An "episode" = same condition within 6 weeks (a pneumonia spans consult, X-ray, discharge and follow-up).
  const episodes: { conditionId: string; name: string; start: string; end: string; docs: string[]; labels: string[] }[] = [];
  for (const c of summaries) {
    for (const e of c.episodes) {
      if (window && e.date < window.from) continue;
      const ep = episodes.find((x) => x.conditionId === c.condition.id && monthsBetween(x.end, e.date) <= 1);
      if (ep) {
        ep.end = e.date;
        ep.docs.push(e.documentId);
        ep.labels.push(e.label);
      } else episodes.push({ conditionId: c.condition.id, name: c.condition.name, start: e.date, end: e.date, docs: [e.documentId], labels: [e.label] });
    }
  }
  episodes.sort((a, b) => a.start.localeCompare(b.start));
  const label = cond?.label ?? "diagnoses";

  if (!episodes.length) return base("diagnoses", `I couldn't find any ${label} recorded in your documents${window ? ` ${window.label}` : ""}.`);

  const a = base("diagnoses", `Your records show ${plural(episodes.length, "episode")} of ${label} between ${fmtDate(episodes[0].start, "month")} and ${fmtDate(episodes.at(-1)!.end, "month")}.`);
  const meds = medicationEvents(s);
  for (const ep of episodes) {
    const tx = meds.filter((m) => m.reasonConditionId === ep.conditionId && m.date >= ep.start && monthsBetween(ep.end, m.date) <= 1 && m.action !== "stopped");
    const admitted = ep.docs.map((id) => getDocument(s, id)!).find((d) => d.type === "discharge_summary");
    a.facts.push({
      text: `${fmtDate(ep.start, "long")} — ${ep.name}${admitted?.extracted.notes?.admission ? `, hospitalised ${fmtDate(admitted.extracted.notes.admission.admittedOn, "dayMonth").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}–${fmtDate(admitted.extracted.notes.admission.dischargedOn, "dayMonth").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}` : ""}. Treated with ${tx.length ? [...new Set(tx.map((m) => m.drug))].join(", ") : "no recorded medication"}.`,
      sources: [...new Set([...ep.docs, ...tx.map((m) => m.documentId)])],
    });
  }
  const hosp = episodes.filter((ep) => ep.docs.some((id) => getDocument(s, id)?.type === "discharge_summary"));
  a.calculations.push({ text: `${cap(plural(episodes.length, "episode"))} over ${(monthsBetween(episodes[0].start, todayISO()) / 12).toFixed(1)} years${hosp.length ? `; ${count(hosp.length)} required hospital admission` : ""}. Most recent: ${fmtDate(episodes.at(-1)!.start, "month")}.` });
  const gapsMonths = episodes.slice(1).map((ep, i) => monthsBetween(episodes[i].start, ep.start));
  if (gapsMonths.length) a.calculations.push({ text: `Time between episodes: ${gapsMonths.map((g) => `${g} months`).join(", ")}.` });
  if (cond?.category === "respiratory") a.interpretation.push({ text: "These are separate, unrelated acute episodes in the records; none of your documents describes them as a recurring or chronic condition. If frequency worries you, it's a reasonable thing to raise with your doctor." });
  a.table = {
    columns: ["Date", "Diagnosis", "Recorded as", "Clinician"],
    rows: episodes.map((ep) => {
      const d = getDocument(s, ep.docs[0])!;
      return { cells: [fmtDate(ep.start), ep.name, ep.labels[0], documentSourceName(s, d)], documentId: d.id };
    }),
  };
  a.sources = collectSources(s, a.facts);
  a.followUps = ["What antibiotics have I been prescribed over the past three years?", "Summarize my health history."];
  return a;
}

function answerPrescriptionDiff(s: HealthSnapshot): AiAnswer {
  const rxDocs = sortedDocuments(s).filter((d) => d.type === "prescription" && (d.extracted.medications?.length ?? 0) > 0);
  if (rxDocs.length < 2) return base("prescription_diff", "I need at least two prescriptions in your records to compare them.");
  const [newer, older] = rxDocs;
  const nm = newer.extracted.medications!.filter((m) => m.action !== "stopped");
  const om = older.extracted.medications!.filter((m) => m.action !== "stopped");
  const key = (d: string) => d.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const sameDoctor = newer.clinicianId && newer.clinicianId === older.clinicianId;
  const a = base(
    "prescription_diff",
    `Your last two prescriptions are from ${fmtDate(newer.clinicalDate, "long")} (${documentSourceName(s, newer)}) and ${fmtDate(older.clinicalDate, "long")} (${documentSourceName(s, older)}).${sameDoctor ? "" : " They were written by different doctors, so each covers a different part of your care."}`,
  );
  const changes: string[] = [];
  for (const m of nm) {
    const prev = om.find((o) => key(o.drug) === key(m.drug));
    if (!prev) {
      a.facts.push({ text: `Only on the newer prescription: ${m.drug} ${m.strength}, ${m.frequency.toLowerCase()}${m.instructions ? ` (${m.instructions.toLowerCase()})` : ""}.`, sources: [newer.id] });
    } else if (prev.strength !== m.strength || prev.frequency !== m.frequency) {
      changes.push(`${m.drug}: ${prev.strength}, ${prev.frequency.toLowerCase()} → ${m.strength}, ${m.frequency.toLowerCase()}`);
      a.facts.push({ text: `${m.drug} changed from ${prev.strength} (${prev.frequency.toLowerCase()}) to ${m.strength} (${m.frequency.toLowerCase()}).`, sources: [older.id, newer.id] });
    } else {
      a.facts.push({ text: `Unchanged on both: ${m.drug} ${m.strength}, ${m.frequency.toLowerCase()}.`, sources: [older.id, newer.id] });
    }
  }
  for (const o of om) if (!nm.find((m) => key(m.drug) === key(o.drug))) a.facts.push({ text: `Only on the older prescription: ${o.drug} ${o.strength}, ${o.frequency.toLowerCase()}.`, sources: [older.id] });
  a.calculations.push({ text: changes.length ? `Dose or frequency changes: ${changes.join("; ")}.` : "No medicine appears on both prescriptions with a different dose or frequency." });

  // Interpretation: absence on a newer prescription is not the same as being stopped.
  const active = activeMedications(s);
  const missing = om.filter((o) => !nm.find((m) => key(m.drug) === key(o.drug)));
  const stillActive = missing.filter((o) => active.some((c) => key(c.drug) === key(o.drug)));
  if (stillActive.length && !sameDoctor) {
    a.interpretation.push({ text: `${stillActive.map((m) => m.drug).join(" and ")} ${stillActive.length > 1 ? "are" : "is"} not on the newer prescription, but no record says ${stillActive.length > 1 ? "they were" : "it was"} stopped, so ${stillActive.length > 1 ? "they are" : "it is"} still treated as active. Different doctors usually prescribe only what they manage.` });
  }
  // Also compare with the same prescriber's previous prescription, which is usually what people mean.
  if (!sameDoctor && newer.clinicianId) {
    const prevSame = rxDocs.slice(1).find((d) => d.clinicianId === newer.clinicianId);
    if (prevSame) {
      const diffs: string[] = [];
      for (const m of nm) {
        const p = prevSame.extracted.medications!.find((o) => key(o.drug) === key(m.drug));
        if (!p) diffs.push(`${m.drug} ${m.strength} added`);
        else if (p.strength !== m.strength) diffs.push(`${m.drug} ${p.strength} → ${m.strength}`);
        else diffs.push(`${m.drug} ${m.strength} unchanged`);
      }
      a.calculations.push({ text: `Compared with ${possessive(documentSourceName(s, newer))} previous prescription (${fmtDate(prevSame.clinicalDate)}): ${diffs.join("; ")}.`, sources: [prevSame.id, newer.id] });
    }
  }
  a.table = {
    columns: ["Medicine", fmtDate(older.clinicalDate), fmtDate(newer.clinicalDate)],
    rows: [...new Set([...om, ...nm].map((m) => key(m.drug)))].map((k) => {
      const o = om.find((m) => key(m.drug) === k);
      const n = nm.find((m) => key(m.drug) === k);
      return { cells: [(n ?? o)!.drug, o ? `${o.strength} · ${o.frequency}` : "—", n ? `${n.strength} · ${n.frequency}` : "—"] };
    }),
  };
  a.sources = collectSources(s, [newer.id, older.id], a.calculations);
  a.followUps = ["How has my levothyroxine dose changed?", "What medications am I currently taking?"];
  return a;
}

function answerSummary(s: HealthSnapshot): AiAnswer {
  const conds = conditionSummaries(s);
  const active = conds.filter((c) => c.condition.status === "active");
  const meds = activeMedications(s);
  const alg = allergies(s);
  const docs = sortedDocuments(s, "asc");
  const hosp = docs.filter((d) => d.type === "discharge_summary");
  const a = base(
    "summary",
    `Your records cover ${docs.length} documents from ${fmtDate(docs[0].clinicalDate, "month")} to ${fmtDate(docs.at(-1)!.clinicalDate, "month")}, from ${new Set(docs.map((d) => d.providerId)).size} providers in ${[...new Set(docs.map((d) => getProvider(s, d.providerId)?.city).filter(Boolean))].join(" and ")}.`,
  );
  a.facts.push({ text: `Active conditions: ${active.map((c) => `${c.condition.name} (since ${fmtDate(c.firstRecorded!, "monthShort")})`).join("; ")}.`, sources: active.map((c) => c.episodes[0].documentId) });
  a.facts.push({ text: `Current medications: ${meds.map((m) => `${m.current.drug} ${m.current.strength} ${m.current.frequency.toLowerCase()}`).join("; ")}.`, sources: meds.map((m) => m.current.documentId) });
  if (alg.length) a.facts.push({ text: `Allergies: ${alg.map((x) => `${x.substance} — ${x.reaction.toLowerCase()}`).join("; ")}.`, sources: alg.map((x) => x.documentId) });
  for (const h of hosp) a.facts.push({ text: `Hospitalised ${fmtDate(h.extracted.notes?.admission?.admittedOn ?? h.clinicalDate)} – ${fmtDate(h.extracted.notes?.admission?.dischargedOn ?? h.clinicalDate)} at ${documentFacilityName(s, h)}: ${h.extracted.diagnoses?.[0]?.label ?? h.title}.`, sources: [h.id] });
  const past = conds.filter((c) => c.condition.status === "resolved" && c.condition.id !== "drug_rash");
  if (past.length) a.facts.push({ text: `Past acute problems: ${past.map((c) => `${c.condition.name} (${fmtDate(c.firstRecorded!, "monthShort")})`).join(", ")}.`, sources: past.map((c) => c.episodes[0].documentId) });

  for (const code of ["TSH", "LDL", "VITD", "HBA1C"]) {
    const ser = biomarkerSeries(s, code);
    if (!ser?.latest || ser.points.length < 2) continue;
    const f = ser.points[0];
    a.calculations.push({ text: `${ser.def.shortName}: ${formatValue(f.canonicalValue!, ser.def.decimals)} (${fmtDate(f.date, "monthShort")}) → ${formatValue(ser.latest.canonicalValue!, ser.def.decimals)} ${ser.def.canonicalUnit} (${fmtDate(ser.latest.date, "monthShort")}), latest ${ser.latest.flag === "normal" ? "within" : ser.latest.flag === "high" ? "above" : "below"} its report's range.`, sources: [f.documentId, ser.latest.documentId] });
  }
  a.interpretation.push({ text: "The main ongoing threads are thyroid care with Dr. Rohan Mehta, cholesterol and vitamin D management with Dr. Kavya Iyer, and a history of respiratory infections managed without penicillins. A doctor-ready summary with full sources is one click away." });
  a.sources = collectSources(s, a.facts, a.calculations);
  a.action = { label: "Create Medical Summary", href: "/summary" };
  a.followUps = ["How have my thyroid levels changed over the last 3 years?", "Show my cholesterol trend.", "What antibiotics have I been prescribed over the past three years?"];
  return a;
}

function answerAllergies(s: HealthSnapshot): AiAnswer {
  const alg = allergies(s);
  if (!alg.length) return base("allergies", "No allergies are recorded in your documents. That doesn't mean you have none — only that none were written down in what you've uploaded.");
  const a = base("allergies", `Your records list ${plural(alg.length, "allergy", "allergies")}.`);
  for (const x of alg) a.facts.push({ text: `${x.substance} — ${x.reaction} (${x.severity}), first recorded ${fmtDate(x.date, "long")}.`, sources: [x.documentId] });
  a.sources = collectSources(s, a.facts);
  a.followUps = ["What antibiotics have I been prescribed over the past three years?"];
  return a;
}

function answerHospitalizations(s: HealthSnapshot, q: string): AiAnswer {
  const wantProcedures = /procedure|surgery|operation/i.test(q);
  const docs = sortedDocuments(s, "asc").filter((d) => (wantProcedures ? d.type === "procedure" : d.type === "discharge_summary" || d.type === "procedure"));
  if (!docs.length) return base("hospitalizations", `I couldn't find any ${wantProcedures ? "procedures" : "hospital admissions"} in your records.`);
  const a = base("hospitalizations", `I found ${plural(docs.length, wantProcedures ? "procedure" : "hospital record")} in your history.`);
  for (const d of docs) {
    const adm = d.extracted.notes?.admission;
    a.facts.push({ text: `${fmtDate(d.clinicalDate, "long")} — ${d.extracted.notes?.procedureName ?? d.title} at ${documentFacilityName(s, d)}${adm ? ` (admitted ${fmtDate(adm.admittedOn)}, discharged ${fmtDate(adm.dischargedOn)})` : ""}. ${d.extracted.notes?.summary ?? ""}`, sources: [d.id] });
  }
  a.sources = collectSources(s, a.facts);
  a.followUps = ["Summarize my health history."];
  return a;
}

function answerProvider(s: HealthSnapshot, providerId: string): AiAnswer {
  const p = getProvider(s, providerId)!;
  const docs = sortedDocuments(s, "asc").filter((d) => d.clinicianId === providerId || d.providerId === providerId);
  const a = base("provider", `You have ${plural(docs.length, "record")} from ${p.name}${p.specialty ? ` (${p.specialty})` : ""}, between ${fmtDate(docs[0].clinicalDate, "month")} and ${fmtDate(docs.at(-1)!.clinicalDate, "month")}.`);
  for (const d of docs) a.facts.push({ text: `${fmtDate(d.clinicalDate)} — ${d.title}${d.extracted.notes?.summary ? `: ${d.extracted.notes.summary}` : d.extracted.medications ? `: ${d.extracted.medications.map((m) => `${m.drug} ${m.strength}`).join(", ")}` : ""}`, sources: [d.id] });
  a.sources = collectSources(s, a.facts);
  a.followUps = ["What changed between my last two prescriptions?", "Summarize my treatment history for my new doctor."];
  return a;
}

function answerSearch(s: HealthSnapshot, q: string): AiAnswer {
  const cleaned = q.replace(/\b(show|me|my|all|the|find|records?|reports?|about|for|of|what|when|did|i|have|do|any|is|are|was|a|an|in|on|with|please|tell|can|you)\b/gi, " ").replace(/[?.!,]/g, " ").trim();
  const hits = cleaned ? searchRecords(s, cleaned) : [];
  if (!hits.length) {
    const a = base("unknown", `I couldn't find anything matching "${cleaned || q}" in your records. I can only answer from documents you've added, and I won't guess beyond them.`);
    a.followUps = ["Summarize my health history.", "How have my thyroid levels changed?", "What medicines have I taken for respiratory infections?"];
    return a;
  }
  const a = base("search", `I found ${plural(hits.length, "record")} mentioning "${cleaned}".`);
  for (const h of hits.slice(0, 8)) a.facts.push({ text: `${fmtDate(h.document.clinicalDate)} — ${h.document.title} (${DOC_TYPE_LABEL[h.document.type]}, ${documentFacilityName(s, h.document)})${h.matches.length ? `: ${h.matches.join("; ")}` : ""}`, sources: [h.document.id] });
  if (hits.length > 8) a.gaps.push(`Showing the 8 most relevant of ${hits.length} matches.`);
  a.sources = collectSources(s, a.facts);
  a.followUps = ["Summarize my health history."];
  return a;
}

// ---------------------------------------------------------------- router

export function answerQuestion(s: HealthSnapshot, question: string): AiAnswer {
  const q = question.trim();
  const window = parseWindow(q);
  const markers = detectBiomarkers(q);

  if (/(chang|differ|compar).*(prescription)|last two prescriptions/i.test(q)) return answerPrescriptionDiff(s);
  if (/allerg/i.test(q) && !/antibiotic/i.test(q)) return answerAllergies(s);
  if (/(first|start|begin|began).*(abnormal|high|low|out of range|elevated|outside)/i.test(q) && markers[0]) return answerFirstAbnormal(s, markers[0]);
  if (/summar|overview|history for|new doctor|brief me|whole history/i.test(q)) return answerSummary(s);

  const drugMention = medicationCourses(s).find((c) => q.toLowerCase().includes(c.drug.toLowerCase().split(/[\s(-]/)[0]));
  if (drugMention && /(dose|dosage|history|changed|change|when|started|how long)/i.test(q)) {
    const r = answerMedicationHistory(s, drugMention.drug.toLowerCase().split(/[\s(-]/)[0]);
    if (r) return r;
  }
  if (/(thyroid|cholesterol|vitamin d).*(medic|medicine|treatment|dose)|(medic|medicine|treatment|dose).*(thyroid|cholesterol|vitamin d)/i.test(q) && !/respiratory/i.test(q)) {
    const term = /thyroid/i.test(q) ? "levothyroxine" : /cholesterol/i.test(q) ? "atorvastatin" : "cholecalciferol";
    const r = answerMedicationHistory(s, term);
    if (r) return r;
  }
  if (/(current|currently|right now|today|now|active).*(medic|medicine|taking|drugs|pills)|what am i taking/i.test(q)) return answerCurrentMeds(s);
  if (/antibiotic|medicine|medication|medicines|drugs|prescribed|tablets|pills|treated with|taken for/i.test(q) && !markers.length) return answerMedications(s, q, window);
  if (/diagnos|every time|episodes?|how many times|infection/i.test(q)) return answerDiagnoses(s, q, window);
  if (/hospital|admit|admission|surgery|procedure|operation/i.test(q)) return answerHospitalizations(s, q);
  if (markers.length) return answerBiomarkerTrend(s, markers[0], window);

  const doctor = s.providers.find((p) => {
    const last = p.name.replace(/^Dr\.?\s*/, "").split(" ").at(-1)!.toLowerCase();
    return p.kind === "doctor" && new RegExp(`\\b${last}\\b`, "i").test(q);
  });
  if (doctor) return answerProvider(s, doctor.id);
  const facility = s.providers.find((p) => p.kind !== "doctor" && q.toLowerCase().includes(p.name.toLowerCase().split(" ")[0]));
  if (facility) return answerProvider(s, facility.id);

  return answerSearch(s, q);
}

export const SUGGESTED_QUESTIONS = [
  "How have my thyroid levels changed over the last 3 years?",
  "What medicines have I taken for respiratory infections?",
  "Summarize my health history.",
  "Show my cholesterol trend.",
  "What changed between my last two prescriptions?",
  "When did my TSH first become abnormal?",
];
