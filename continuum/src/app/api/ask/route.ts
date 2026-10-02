import { llmConfigured, structuredCall } from "@/lib/llm/anthropic";
import type { AiAnswer, AnswerItem } from "@/lib/ai/types";

export const maxDuration = 60;

const ITEM = { type: "object", additionalProperties: false, required: ["text", "sources"], properties: { text: { type: "string" }, sources: { type: "array", items: { type: "string" } } } };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "facts", "calculations", "interpretation", "gaps"],
  properties: {
    summary: { type: "string", description: "2-3 sentence direct answer" },
    facts: { type: "array", items: ITEM, description: "Statements copied from the records, each citing document ids" },
    calculations: { type: "array", items: ITEM, description: "Arithmetic on recorded values (differences, percentages, counts, durations)" },
    interpretation: { type: "array", items: ITEM, description: "Cautious pattern-level observations. Never a diagnosis or treatment advice." },
    gaps: { type: "array", items: { type: "string" }, description: "Missing periods or information the records don't cover" },
  },
};

const SYSTEM = `You are the retrieval assistant inside Continuum, a personal medical-records app. You answer the patient's question using ONLY their records below.

Rules:
- Every factual claim must cite the bracketed document id(s) it comes from in "sources". Never cite an id that isn't in the records.
- Never invent values, dates, diagnoses or medications. If the records don't contain something, say so in "gaps" (e.g. "I found reports from March 2025 and September 2026, but none between them.").
- Compare each lab value against the reference range printed on its own report. Don't treat ranges as universal. Don't compare values in different units without stating the conversion.
- A value mentioned in a doctor's note without an uploaded report is not a measurement; say where it came from.
- Keep facts, calculations and interpretation strictly separate. Interpretation is cautious, pattern-level, and defers to the patient's doctor. You are not a replacement for a physician; don't diagnose or recommend treatment changes.
- A deterministic analysis has already been computed from the same records; its numbers are reliable. Use it, correct it only if the records clearly contradict it, and write naturally and concisely in the second person.`;

export async function POST(req: Request) {
  const { question, digest, draft } = (await req.json()) as { question: string; digest: string; draft: AiAnswer };
  if (!llmConfigured() || !digest) return Response.json({ engine: "local" });

  const validIds = new Set([...digest.matchAll(/^\[([^\]]+)\]/gm)].map((m) => m[1]));
  const clean = (items: AnswerItem[]) => items.map((i) => ({ text: i.text, sources: (i.sources ?? []).filter((id) => validIds.has(id)) }));
  try {
    const draftText = JSON.stringify({ summary: draft.summary, facts: draft.facts, calculations: draft.calculations, interpretation: draft.interpretation, gaps: draft.gaps });
    const out = await structuredCall<Pick<AiAnswer, "summary" | "facts" | "calculations" | "interpretation" | "gaps">>({
      system: SYSTEM,
      content: [
        { type: "text", text: `<records>\n${digest}\n</records>`, cache_control: { type: "ephemeral" } },
        { type: "text", text: `<deterministic_analysis>\n${draftText}\n</deterministic_analysis>\n\nQuestion: ${question}` },
      ],
      schema: SCHEMA,
      effort: "medium",
    });
    return Response.json({ engine: "claude", summary: out.summary, facts: clean(out.facts), calculations: clean(out.calculations), interpretation: clean(out.interpretation), gaps: out.gaps });
  } catch (err) {
    console.warn("[continuum] Claude answer failed, using local engine:", err);
    return Response.json({ engine: "local" });
  }
}
