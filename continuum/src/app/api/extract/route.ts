import { extractDocument } from "@/lib/processing/service";

export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is larger than 20 MB" }, { status: 413 });
  const result = await extractDocument({ name: file.name, type: file.type, bytes: await file.arrayBuffer() });
  return Response.json(result);
}
