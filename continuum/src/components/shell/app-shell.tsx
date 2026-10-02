"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, ArrowLeft, Bell, CalendarDays, ChevronDown, FileHeart, FileText, House, Menu, Pill, RotateCcw, Settings, Sparkles, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth, useSnapshot } from "@/components/providers/health-store";
import { Sheet } from "@/components/ui/overlay";
import { IconTile } from "@/components/ui/icon-tile";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GlobalSearch } from "@/components/search/global-search";
import { biomarkerSeries, fmtDate, getProvider, upcomingAppointments } from "@/lib/health/selectors";
import { formatValue } from "@/lib/health/biomarkers";
import { Logo, Wordmark } from "./logo";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/timeline", label: "Timeline", icon: Waypoints },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/health", label: "Health Data", icon: Activity },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/ask", label: "Ask AI", icon: Sparkles },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavItem({ href, label, icon: Icon, onNavigate, badge }: { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; onNavigate?: () => void; badge?: React.ReactNode }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn("group flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[15px] transition-colors", active ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink")}
    >
      <Icon className={cn("size-[19px]", active ? "text-accent" : "text-ink-2 group-hover:text-ink")} strokeWidth={active ? 2.1 : 1.7} />
      <span className="flex-1">{label}</span>
      {badge}
    </Link>
  );
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void }) {
  const { documents } = useSnapshot();
  const processing = documents.filter((d) => d.status === "processing" || d.status === "uploading").length;
  const review = documents.filter((d) => d.status === "needs_review").length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[84px] items-center px-6">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <Logo />
          <Wordmark />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 px-3.5 pt-1">
        {NAV.map((n) => (
          <NavItem
            key={n.href}
            {...n}
            onNavigate={onNavigate}
            badge={
              n.href === "/records" && (processing > 0 || review > 0) ? (
                <span className={cn("rounded-full px-1.5 text-[11px] font-medium tabular", processing ? "bg-t-blue-bg text-t-blue" : "bg-high-soft text-high")}>{processing || review}</span>
              ) : undefined
            }
          />
        ))}
      </nav>
      <div className="px-3.5 pb-5">
        <NavItem href="/settings" label="Settings" icon={Settings} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function Notifications() {
  const s = useSnapshot();
  const review = s.documents.filter((d) => d.status === "needs_review");
  const upcoming = upcomingAppointments(s).slice(0, 2);
  const tsh = biomarkerSeries(s, "TSH")?.latest;
  const count = review.length + upcoming.length;
  return (
    <Popover>
      <PopoverTrigger className="relative flex size-10 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-sunken hover:text-ink" aria-label="Notifications">
        <Bell className="size-5" strokeWidth={1.7} />
        {count > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-t-red ring-2 ring-bg" />}
      </PopoverTrigger>
      <PopoverContent>
        <div className="px-2.5 pb-2 pt-1.5 text-[13px] font-medium text-ink">Notifications</div>
        <div className="space-y-0.5">
          {review.map((d) => (
            <PopoverClose asChild key={d.id}>
              <Link href={`/records/${d.id}`} className="flex gap-3 rounded-xl px-2.5 py-2 hover:bg-sunken">
                <IconTile tone="amber" size="sm">
                  <FileText />
                </IconTile>
                <span className="min-w-0 text-[13px]">
                  <span className="block font-medium text-ink">Review “{d.title}”</span>
                  <span className="text-ink-3">Check the extracted details before they’re added</span>
                </span>
              </Link>
            </PopoverClose>
          ))}
          {upcoming.map((a) => (
            <PopoverClose asChild key={a.id}>
              <Link href="/" className="flex gap-3 rounded-xl px-2.5 py-2 hover:bg-sunken">
                <IconTile tone="green" size="sm">
                  <CalendarDays />
                </IconTile>
                <span className="min-w-0 text-[13px]">
                  <span className="block font-medium text-ink">{a.title}</span>
                  <span className="text-ink-3">
                    {fmtDate(a.date, "long")} · {getProvider(s, a.clinicianId)?.name ?? getProvider(s, a.providerId)?.name}
                  </span>
                </span>
              </Link>
            </PopoverClose>
          ))}
          {tsh && (
            <PopoverClose asChild>
              <Link href="/health/tsh" className="flex gap-3 rounded-xl px-2.5 py-2 hover:bg-sunken">
                <IconTile tone="blue" size="sm">
                  <Activity />
                </IconTile>
                <span className="min-w-0 text-[13px]">
                  <span className="block font-medium text-ink">
                    Latest TSH: {formatValue(tsh.canonicalValue!, 1)} mIU/L
                  </span>
                  <span className="text-ink-3">Added {fmtDate(tsh.date, "long")}</span>
                </span>
              </Link>
            </PopoverClose>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProfileMenu() {
  const { snapshot: s, resetDemo } = useHealth();
  const [confirm, setConfirm] = React.useState(false);
  const p = s.patient;
  return (
    <Popover onOpenChange={() => setConfirm(false)}>
      <PopoverTrigger className="flex items-center gap-3 rounded-2xl py-1 pl-1 pr-2 transition-colors hover:bg-sunken">
        <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-t-green-bg to-t-amber-bg text-[13px] font-semibold text-accent-ink ring-2 ring-surface">
          {p.firstName[0]}
          {p.lastName[0]}
        </span>
        <span className="hidden text-[15px] font-medium text-ink sm:block">
          {p.firstName} {p.lastName}
        </span>
        <ChevronDown className="hidden size-4 text-ink-2 sm:block" />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="px-2.5 pb-2 pt-1.5">
          <div className="text-[14px] font-medium text-ink">
            {p.firstName} {p.lastName}
          </div>
          <div className="text-[12.5px] text-ink-3">
            {p.bloodGroup} · {p.city}
          </div>
        </div>
        <div className="space-y-0.5 border-t border-line-2 pt-1.5">
          <PopoverClose asChild>
            <Link href="/summary" className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] text-ink-2 hover:bg-sunken hover:text-ink">
              <FileHeart className="size-4" /> Medical summary for a doctor
            </Link>
          </PopoverClose>
          <PopoverClose asChild>
            <Link href="/settings" className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] text-ink-2 hover:bg-sunken hover:text-ink">
              <Settings className="size-4" /> Profile & settings
            </Link>
          </PopoverClose>
          {confirm ? (
            <PopoverClose asChild>
              <button onClick={resetDemo} className="flex w-full items-center gap-2.5 rounded-xl bg-danger-soft px-2.5 py-2 text-left text-[13.5px] text-danger">
                <RotateCcw className="size-4" /> Confirm: remove my uploads & edits
              </button>
            </PopoverClose>
          ) : (
            <button onClick={() => setConfirm(true)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink-2 hover:bg-sunken hover:text-ink">
              <RotateCcw className="size-4" /> Reset demo data
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Where "back" goes when there is no earlier screen in this visit (e.g. a link opened directly). */
function parentOf(pathname: string) {
  const m = pathname.match(/^\/(records|health)\/.+/);
  return m ? `/${m[1]}` : "/";
}

/**
 * Remembers the screens visited in this session so the back button can
 * return to the previous one. Revisiting the second-to-last screen is
 * treated as going back (covers both this button and the browser's).
 */
function useVisitTrail(pathname: string) {
  const [trail, setTrail] = React.useState<string[]>([pathname]);
  if (trail[trail.length - 1] !== pathname) {
    setTrail((t) => (t.length > 1 && t[t.length - 2] === pathname ? t.slice(0, -1) : [...t, pathname]));
  }
  return trail;
}

function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const trail = useVisitTrail(pathname);
  const hasHistory = trail.length > 1;
  if (!hasHistory && pathname === "/") return null;
  return (
    <button
      onClick={() => (hasHistory ? router.back() : router.push(parentOf(pathname)))}
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface pl-2.5 pr-3 text-[14px] font-medium text-ink-2 shadow-card transition-colors hover:border-accent/40 hover:text-ink"
      aria-label="Go back"
    >
      <ArrowLeft className="size-[18px]" strokeWidth={1.9} />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const isPrint = pathname.startsWith("/summary");

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-[232px] shrink-0 bg-sidebar lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContents />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line-2/70 bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex h-[76px] w-full max-w-[1320px] items-center gap-3 px-4 sm:px-8 lg:px-10">
            <button onClick={() => setOpen(true)} className="-ml-1 rounded-xl p-2 text-ink-2 hover:bg-sunken lg:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <Logo className="size-7" />
              <span className="hidden sm:block">
                <Wordmark />
              </span>
            </Link>
            <BackButton />
            <div className="hidden min-w-0 flex-1 md:block md:max-w-[790px]">
              <GlobalSearch variant="bar" />
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <Notifications />
              <ProfileMenu />
            </div>
          </div>
          <div className="px-4 pb-3 sm:px-8 md:hidden">
            <GlobalSearch variant="bar" />
          </div>
        </header>
        <Sheet open={open} onOpenChange={setOpen} title="Navigation" side="left" className="bg-sidebar">
          <SidebarContents onNavigate={() => setOpen(false)} />
        </Sheet>

        <main className={cn("mx-auto w-full flex-1", isPrint ? "max-w-[920px] px-4 py-8 sm:px-8" : "max-w-[1320px] px-4 pb-24 pt-8 sm:px-8 lg:px-10 lg:pt-10")}>{children}</main>
      </div>
    </div>
  );
}
