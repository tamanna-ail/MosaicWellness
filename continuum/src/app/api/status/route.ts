import { llmConfigured, LLM_MODEL } from "@/lib/llm/anthropic";

export async function GET() {
  return Response.json({ llm: llmConfigured(), model: llmConfigured() ? LLM_MODEL : null, database: !!process.env.DATABASE_URL });
}
