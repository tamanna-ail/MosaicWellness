import { Badge } from "@/components/ui/primitives";
import type { DocumentStatus } from "@/lib/types";

export function StatusPill({ status }: { status: DocumentStatus }) {
  switch (status) {
    case "processed":
      return <Badge tone="ok">Processed</Badge>;
    case "needs_review":
      return <Badge tone="high">Needs review</Badge>;
    case "failed":
      return <Badge tone="danger">Failed</Badge>;
    default:
      return (
        <Badge tone="accent">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Processing
        </Badge>
      );
  }
}
