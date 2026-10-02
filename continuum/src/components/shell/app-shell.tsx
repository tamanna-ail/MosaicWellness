"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderClosed, House, Menu, Pill, Sparkles, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSnapshot } from "@/components/providers/health-store";
import { Sheet } from "@/components/ui/overlay";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/timeline", label: "Timeline", icon: Waypoints },
  { href: "/records", label: "Records", icon: FolderClosed },
  { href: "/health", label: "Health Data", icon: Activity },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/ask", label: "Ask AI", icon: Sparkles },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function SidebarContents({ onNavigate, dataSource }: { onNavigate?: () => void; dataSource: string }) {
  const pathname = usePathname();
  const { patient, documents } = useSnapshot();
  const processing = documents.filter((d) => d.status === "processing" || d.status === "uploading").length;
  const review = documents.filter((d) => d.status === "needs_review").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Continuum</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[14px] transition-colors",
                active ? "bg-surface font-medium text-ink shadow-card ring-1 ring-line" : "text-ink-2 hover:bg-sunken/70 hover:text-ink",
              )}
            >
              <Icon className={cn("size-[17px]", active ? (href === "/ask" ? "text-accent" : "text-ink") : "text-ink-3 group-hover:text-ink-2")} strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              {href === "/records" && (processing > 0 || review > 0) && (
                <span className={cn("rounded-full px-1.5 text-[11px] tabular font-medium", processing ? "bg-accent-soft text-accent-ink" : "bg-high-soft text-high")}>{processing || review}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <div className="mb-3 rounded-xl border border-line-2 bg-surface-2/60 px-3 py-2.5 text-[11.5px] leading-snug text-ink-3">
          <span className="mb-0.5 flex items-center gap-1.5 font-medium text-ink-2">
            <span className="size-1.5 rounded-full bg-ok" /> Private to you
          </span>
          {dataSource === "postgres" ? "Synced to your secure vault." : "Demo vault · changes stay in this browser."}
        </div>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sunken/70", isActive(pathname, "/settings") && "bg-surface shadow-card ring-1 ring-line")}
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#dfe6fb] to-[#f3e9dc] text-[12px] font-semibold text-ink-2">
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="text-[11.5px] text-ink-3">Profile & settings</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children, dataSource }: { children: React.ReactNode; dataSource: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const isPrint = pathname.startsWith("/summary");

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-line-2 bg-bg lg:block">
        <SidebarContents dataSource={dataSource} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line-2 bg-bg/85 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 text-ink-2 hover:bg-sunken" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Continuum</span>
          </Link>
        </div>
        <Sheet open={open} onOpenChange={setOpen} title="Navigation" side="left" className="bg-bg">
          <SidebarContents onNavigate={() => setOpen(false)} dataSource={dataSource} />
        </Sheet>

        <main className={cn("mx-auto w-full flex-1", isPrint ? "max-w-[920px] px-4 py-8 sm:px-8" : "max-w-[1160px] px-4 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-14")}>{children}</main>
      </div>
    </div>
  );
}
