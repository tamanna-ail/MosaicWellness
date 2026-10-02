"use client";

/**
 * On static hosts (GitHub Pages) a record uploaded in the browser has no
 * pre-rendered page, so the host serves this 404. Recognise those URLs and
 * render the screen client-side instead of a dead end.
 */
import * as React from "react";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { RecordDetail } from "@/components/screens/record-detail";
import { BiomarkerDetail } from "@/components/screens/biomarker-detail";
import { Button, EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  const [path, setPath] = React.useState<string | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the requested URL is only known in the browser
    setPath(window.location.pathname.replace(/\/$/, ""));
  }, []);
  if (path === null) return null;
  const record = path.match(/\/records\/([^/]+)$/);
  if (record) return <RecordDetail id={decodeURIComponent(record[1])} />;
  const marker = path.match(/\/health\/([^/]+)$/);
  if (marker) return <BiomarkerDetail code={decodeURIComponent(marker[1])} />;
  return (
    <EmptyState
      icon={<FileQuestion />}
      title="This page doesn’t exist"
      body="The link may be out of date."
      action={
        <Button asChild>
          <Link href="/">Go to Home</Link>
        </Button>
      }
    />
  );
}
