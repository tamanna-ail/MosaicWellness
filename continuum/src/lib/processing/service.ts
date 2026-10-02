import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { llmConfigured, structuredCall } from "@/lib/llm/anthropic";
import { demoExtract } from "./demo-extractor";
import { EXTRACTION_SCHEMA, type ExtractionResult } from "./types";

const SYSTEM = `You extract structured data from a patient's own medical document (lab report, prescription, consultation note, imaging report, discharge summary or procedure note), which may be a scan or handwritten.

Rules:
- Transcribe only what is on the page. Never infer values, ranges, diagnoses or doses that are not written.
- Keep each test's reference range exactly as printed on this report; do not substitute "standard" ranges.
- Keep units exactly as printed.
- clinicalDate is when the sample was taken or the visit happened.
- If something is illegible or ambiguous, leave it out and add a warning, and lower confidence.`;

/** Extracts structured data from an uploaded file using the best available engine. */
export async function extractDocument(file: { name: string; type: string; bytes: ArrayBuffer }): Promise<ExtractionResult> {
  const supported = file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp";
  if (!llmConfigured() || !supported) return demoExtract(file.name, file.type);

  const data = Buffer.from(file.bytes).toString("base64");
  const source: Anthropic.Beta.BetaContentBlockParam =
    file.type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: file.type as "image/png", data } };
  try {
    const result = await structuredCall<Omit<ExtractionResult, "engine">>({
      system: SYSTEM,
      content: [source, { type: "text", text: `File name: ${file.name}. Extract this document.` }],
      schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
    });
    return { ...result, engine: "Claude document extraction" };
  } catch (err) {
    console.warn("[continuum] extraction via Claude failed, using demo extractor:", err);
    const fallback = demoExtract(file.name, file.type);
    return { ...fallback, warnings: ["AI extraction was unavailable for this file.", ...fallback.warnings] };
  }
}
