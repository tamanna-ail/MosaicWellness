import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude provider. Optional: every caller has a local fallback, so the
 * product works without a key and gets better with one.
 */
export const LLM_MODEL = process.env.CONTINUUM_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;

export function llmConfigured() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getClaude() {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * One structured-output call. Returns parsed JSON matching `schema`, or throws.
 * Server-side refusal fallback is enabled so a safety decline on a medical
 * document is retried on a fallback model instead of failing the upload.
 */
export async function structuredCall<T>({
  system,
  content,
  schema,
  effort = "medium",
  maxTokens = 16000,
}: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<T> {
  const res = await getClaude().beta.messages.create({
    model: LLM_MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error(`Model declined: ${res.stop_details?.category ?? "unspecified"}`);
  if (res.stop_reason === "max_tokens") throw new Error("Model output was truncated");
  const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
  if (!text) throw new Error("Model returned no text");
  return JSON.parse(text) as T;
}
