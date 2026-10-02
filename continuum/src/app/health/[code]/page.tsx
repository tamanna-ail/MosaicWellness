import { BiomarkerDetail } from "@/components/screens/biomarker-detail";
import { BIOMARKERS } from "@/lib/health/biomarkers";

export function generateStaticParams() {
  return BIOMARKERS.map((b) => ({ code: b.code.toLowerCase() }));
}

export default async function Page({ params }: PageProps<"/health/[code]">) {
  const { code } = await params;
  return <BiomarkerDetail code={code} />;
}
