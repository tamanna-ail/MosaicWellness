"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Check, ShieldCheck, Sparkles } from "lucide-react";
import { useSnapshot } from "@/components/providers/health-store";
import { AnswerView } from "@/components/ask/answer-view";
import { DocumentDrawer } from "@/components/records/document-drawer";
import { answerQuestion, collectSources, SUGGESTED_QUESTIONS } from "@/lib/ai/engine";
import { buildDigest } from "@/lib/ai/digest";
import type { AiAnswer } from "@/lib/ai/types";
import { isUsable } from "@/lib/health/selectors";
import { cn } from "@/lib/utils";

interface Turn {
  id: string;
  question: string;
  answer?: AiAnswer;
  step: number;
}

const STEPS = ["Understanding your question", "Searching your records", "Checking each report’s reference ranges", "Writing your answer"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AskPage() {
  return (
    <React.Suspense>
      <Ask />
    </React.Suspense>
  );
}

function Ask() {
  const s = useSnapshot();
  const params = useSearchParams();
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const snapRef = React.useRef(s);
  React.useEffect(() => {
    snapRef.current = s;
  });
  const asked = React.useRef(false);

  const ask = React.useCallback(async (question: string) => {
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setInput("");
    const id = Math.random().toString(36).slice(2);
    const update = (patch: Partial<Turn>) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setTurns((ts) => [...ts, { id, question: q, step: 0 }]);

    const snap = snapRef.current;
    const draft = answerQuestion(snap, q);
    await sleep(450);
    update({ step: 1 });
    const remote = fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, draft, digest: buildDigest(snap) }) })
      .then((r) => r.json())
      .catch(() => ({ engine: "local" }));
    await sleep(550);
    update({ step: 2 });
    await sleep(500);
    update({ step: 3 });
    const [r] = await Promise.all([Promise.race([remote, sleep(45000).then(() => ({ engine: "local" }))]), sleep(400)]);

    let answer: AiAnswer = draft;
    if (r?.engine === "claude" && r.summary) {
      answer = { ...draft, engine: "claude", summary: r.summary, facts: r.facts, calculations: r.calculations, interpretation: r.interpretation, gaps: r.gaps };
      const chartIds = draft.chart?.points.map((p) => p.documentId) ?? [];
      answer.sources = collectSources(snap, answer.facts, answer.calculations, answer.interpretation, chartIds);
    }
    update({ answer, step: STEPS.length });
    setBusy(false);
  }, []);

  React.useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      void ask(q);
    }
  }, [params, ask]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const usable = s.documents.filter(isUsable).length;
  const empty = turns.length === 0;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[820px] flex-col">
      {empty ? (
        <div className="flex flex-1 flex-col justify-center pb-10 pt-6 animate-fade-up">
          <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[#6f86f0] text-white shadow-[0_8px_24px_-8px_rgba(61,92,224,0.6)]">
            <Sparkles className="size-6" />
          </div>
          <h1 className="font-serif text-[42px] leading-[1.05] text-ink sm:text-[52px]">Ask your health history</h1>
          <p className="mt-3 text-[16px] text-ink-2">Ask questions across all your medical records.</p>
          <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
            <ShieldCheck className="size-3.5 text-ok" /> Answers use only your {usable} confirmed records, and every claim links to its source.
          </div>
          <div className="mt-9 grid gap-2 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left text-[14px] text-ink shadow-card transition-all hover:-translate-y-0.5 hover:border-ink-4 hover:shadow-pop animate-fade-up"
                style={{ animationDelay: `${80 + i * 40}ms` }}
              >
                “{q}”
                <ArrowUp className="size-4 shrink-0 rotate-45 text-ink-4 transition-colors group-hover:text-accent" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-10 pb-8">
          <div className="flex items-center justify-between border-b border-line-2 pb-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold">
              <Sparkles className="size-4 text-accent" /> Ask your health history
            </div>
            <button onClick={() => setTurns([])} disabled={busy} className="text-[13px] text-ink-3 hover:text-ink disabled:opacity-40">
              New conversation
            </button>
          </div>
          {turns.map((t) => (
            <div key={t.id} className="space-y-5">
              <div className="flex justify-end animate-fade-up">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-white">{t.question}</div>
              </div>
              {t.answer ? (
                <div className="animate-fade-up">
                  <div className="mb-3 flex items-center gap-2 text-[12px] text-ink-3">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-accent text-white">
                      <Sparkles className="size-3.5" />
                    </span>
                    Answered from your records · {t.answer.sources.length} source{t.answer.sources.length === 1 ? "" : "s"}
                    <span className="rounded bg-sunken px-1.5 py-px text-[10.5px]">{t.answer.engine === "claude" ? "Claude" : "On-device engine"}</span>
                  </div>
                  <AnswerView answer={t.answer} onOpen={setDrawer} onFollowUp={(q) => !busy && ask(q)} />
                </div>
              ) : (
                <div className="space-y-2 pl-1">
                  {STEPS.map((label, i) => (
                    <div key={label} className={cn("flex items-center gap-2.5 text-[13.5px] transition-opacity", i > t.step ? "opacity-0" : "opacity-100")}>
                      {i < t.step ? <Check className="size-3.5 text-ok" /> : <span className="size-3.5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />}
                      <span className={i === t.step ? "shimmer-text font-medium" : "text-ink-3"}>
                        {label}
                        {i === 1 && i <= t.step ? ` · ${usable} records` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pb-4 pt-6 sm:mx-0 sm:px-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) ask(input);
          }}
          className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-pop transition-[border,box-shadow] focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/8"
        >
          <textarea
            ref={textRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) ask(input);
              }
            }}
            placeholder="Ask anything about your medical history..."
            className="max-h-40 flex-1 resize-none bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-3"
            aria-label="Ask a question"
          />
          <button type="submit" disabled={busy || !input.trim()} className="flex size-9 items-center justify-center rounded-xl bg-ink text-white transition-opacity disabled:opacity-25" aria-label="Send">
            <ArrowUp className="size-4" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11.5px] text-ink-3">Continuum organises and explains your records. It isn’t a doctor and doesn’t give medical advice.</p>
      </div>
      <DocumentDrawer documentId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
