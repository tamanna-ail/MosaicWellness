"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, CornerDownLeft, Pill, Search, Sparkles } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { DocTypeIcon } from "@/components/health/bits";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { Kbd } from "@/components/ui/primitives";
import { BIOMARKERS, formatValue } from "@/lib/health/biomarkers";
import { biomarkerSeries, DOC_TYPE_LABEL, fmtDate, medicationCourses, searchRecords } from "@/lib/health/selectors";
import { cn } from "@/lib/utils";

const EXAMPLES = ["thyroid", "vitamin D", "Dr Mehta", "levothyroxine"];

type Item =
  | { kind: "marker"; key: string; code: string; label: string; detail: string }
  | { kind: "med"; key: string; label: string; detail: string }
  | { kind: "doc"; key: string; id: string; label: string; detail: string; type: Parameters<typeof DocTypeIcon>[0]["type"] }
  | { kind: "ask"; key: string; label: string };

export function GlobalSearch({ variant = "page" }: { variant?: "page" | "bar" }) {
  const s = useSnapshot();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const items = React.useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Item[] = [];
    for (const b of BIOMARKERS) {
      if (b.shortName.toLowerCase().includes(term) || b.aliases.some((a) => a.includes(term) || (term.length > 3 && term.includes(a)))) {
        const ser = biomarkerSeries(s, b.code);
        if (ser?.latest) out.push({ kind: "marker", key: `m-${b.code}`, code: b.code, label: b.shortName, detail: `${formatValue(ser.latest.canonicalValue!, b.decimals)} ${b.canonicalUnit} · ${fmtDate(ser.latest.date)} · ${ser.points.length} results` });
      }
    }
    const meds = new Map<string, string>();
    for (const c of medicationCourses(s)) {
      if (c.drug.toLowerCase().includes(term) || c.drugClass.toLowerCase().includes(term) || (c.current.brand ?? "").toLowerCase().includes(term)) {
        if (!meds.has(c.drug)) meds.set(c.drug, `${c.active ? "Active" : "Past"} · ${c.current.strength} · ${c.events.length} prescription${c.events.length > 1 ? "s" : ""}`);
      }
    }
    for (const [drug, detail] of [...meds].slice(0, 3)) out.push({ kind: "med", key: `rx-${drug}`, label: drug, detail });
    for (const h of searchRecords(s, term).slice(0, 6))
      out.push({ kind: "doc", key: h.document.id, id: h.document.id, type: h.document.type, label: h.document.title, detail: `${fmtDate(h.document.clinicalDate)} · ${h.matches[0] ?? DOC_TYPE_LABEL[h.document.type]}` });
    out.push({ kind: "ask", key: "ask", label: q.trim() });
    return out;
  }, [q, s]);

  const choose = (it: Item) => {
    setOpen(false);
    if (it.kind === "marker") router.push(`/health/${it.code.toLowerCase()}`);
    else if (it.kind === "med") router.push(`/medications?tab=history`);
    else if (it.kind === "doc") setDrawer(it.id);
    else router.push(`/ask?q=${encodeURIComponent(it.label)}`);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className={cn("flex h-12 items-center gap-3 rounded-2xl border bg-surface px-4 transition-[border,box-shadow]", variant === "page" && "shadow-card", open ? "border-accent/40 ring-4 ring-accent/8" : "border-line")}>
        <Search className="size-[18px] text-ink-3" strokeWidth={1.75} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && items[active]) choose(items[active]);
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search your medical history..."
          className="h-full flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          aria-label="Search your medical history"
        />
        <span className="hidden sm:block">
          <Kbd>⌘K</Kbd>
        </span>
      </div>

      {!q && variant === "page" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
          <span>Try</span>
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => {
                setQ(e);
                setOpen(true);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-line bg-surface px-2.5 py-1 text-ink-2 transition-colors hover:border-ink-4 hover:text-ink"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {open && !q && variant === "bar" && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 rounded-2xl border border-line bg-surface p-3 shadow-pop animate-fade-in">
          <div className="px-1 pb-2 text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink-3">Try searching</div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  setQ(e);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-accent/40 hover:text-accent-ink"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && q && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-[420px] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop animate-fade-in">
          {items.map((it, i) => {
            const isActive = i === active;
            const base = cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", isActive ? "bg-sunken" : "hover:bg-sunken/60");
            const icon =
              it.kind === "marker" ? <Activity className="size-4" /> : it.kind === "med" ? <Pill className="size-4" /> : it.kind === "doc" ? <DocTypeIcon type={it.type} /> : <Sparkles className="size-4 text-accent" />;
            return (
              <button key={it.key} className={base} onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-2", it.kind === "ask" ? "bg-accent-soft" : "bg-sunken")}>{icon}</span>
                <span className="min-w-0 flex-1">
                  {it.kind === "ask" ? (
                    <span className="text-[14px] text-ink">
                      Ask AI: <span className="font-medium">“{it.label}”</span>
                    </span>
                  ) : (
                    <>
                      <span className="block truncate text-[14px] font-medium text-ink">{it.label}</span>
                      <span className="block truncate text-[12px] text-ink-3">{it.detail}</span>
                    </>
                  )}
                </span>
                {isActive ? <CornerDownLeft className="size-3.5 text-ink-3" /> : <ArrowRight className="size-3.5 text-ink-4" />}
              </button>
            );
          })}
          {items.length === 1 && <div className="px-3 pb-2 pt-1 text-[12px] text-ink-3">No records match “{q}”.</div>}
        </div>
      )}
      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
