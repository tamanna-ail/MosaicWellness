import { RecordDetail } from "@/components/screens/record-detail";
import { seedSnapshot } from "@/lib/data/seed";

/** Pre-renders the demo records for static hosting; other ids render on demand (or via the 404 fallback on static hosts). */
export function generateStaticParams() {
  return seedSnapshot.documents.map((d) => ({ id: d.id }));
}

export default async function Page({ params }: PageProps<"/records/[id]">) {
  const { id } = await params;
  return <RecordDetail id={id} />;
}
