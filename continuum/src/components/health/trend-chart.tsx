"use client";

/**
 * Longitudinal chart for one biomarker.
 * The shaded band is a *stepped* band: each segment shows the reference
 * range printed on that specific report, so lab-to-lab differences stay visible.
 */
import * as React from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { fmtDate } from "@/lib/health/selectors";
import { formatValue } from "@/lib/health/biomarkers";
import type { Flag } from "@/lib/types";

export interface TrendPoint {
  date: string;
  value: number;
  refLow?: number;
  refHigh?: number;
  flag: Flag;
  label?: string; // source title
  provider?: string;
  converted?: boolean;
  documentId?: string;
}

const dotColor = (f: Flag) => (f === "high" ? "var(--high)" : f === "low" ? "var(--low)" : "var(--accent)");

export function TrendChart({ points, unit, decimals = 1, height = 300, compact = false, onPointClick }: { points: TrendPoint[]; unit: string; decimals?: number; height?: number; compact?: boolean; onPointClick?: (p: TrendPoint) => void }) {
  // Fit the data first; include reference limits only when they are near the data, so a wide range can't flatten the line.
  const vals = points.map((p) => p.value);
  const vmax = Math.max(...vals);
  const vmin = Math.min(...vals);
  const top = Math.max(vmax, ...points.map((p) => p.refHigh).filter((r): r is number => r !== undefined && r <= vmax * 1.6));
  const bottom = Math.min(vmin, ...points.map((p) => p.refLow).filter((r): r is number => r !== undefined && r >= vmin * 0.6));
  const span = top - bottom || Math.abs(top) || 1;
  const step = niceStep((span * 1.4) / 4);
  const domain: [number, number] = [Math.max(0, Math.floor((bottom - span * 0.15) / step) * step), Math.ceil((top + span * 0.15) / step) * step];
  const yTicks = Array.from({ length: Math.round((domain[1] - domain[0]) / step) + 1 }, (_, i) => +(domain[0] + i * step).toFixed(6));
  const data = points.map((p) => ({
    ...p,
    t: new Date(p.date + "T00:00:00Z").getTime(),
    band: p.refLow !== undefined || p.refHigh !== undefined ? [p.refLow ?? domain[0], Math.min(p.refHigh ?? domain[1], domain[1])] : undefined,
  }));

  // Ticks: one per year boundary for long ranges, otherwise per point.
  const years = [...new Set(points.map((p) => p.date.slice(0, 4)))];
  const ticks = years.length > 1 ? years.map((y) => new Date(`${y}-01-01T00:00:00Z`).getTime()).filter((t) => t >= data[0].t - 1e10) : data.map((d) => d.t);

  return (
    <div style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: compact ? -12 : -4 }}>
          <CartesianGrid vertical={false} stroke="var(--line-2)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[data[0].t - 1000 * 3600 * 24 * 40, data.at(-1)!.t + 1000 * 3600 * 24 * 40]}
            ticks={ticks}
            tickFormatter={(t) => (years.length > 1 ? new Date(t).getUTCFullYear().toString() : fmtDate(new Date(t).toISOString(), "monthShort"))}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickMargin={8}
          />
          <YAxis domain={domain} ticks={yTicks} allowDataOverflow tickLine={false} axisLine={false} tick={{ fill: "var(--ink-3)", fontSize: 11 }} width={44} tickFormatter={(v) => formatValue(v, decimals > 1 ? 1 : decimals)} />
          <Area dataKey="band" type="stepAfter" stroke="none" fill="var(--ok)" fillOpacity={0.07} isAnimationActive={false} connectNulls activeDot={false} />
          <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload} unit={unit} decimals={decimals} />} cursor={{ stroke: "var(--ink-4)", strokeDasharray: "3 3" }} />
          <Line
            dataKey="value"
            type="monotone"
            stroke="var(--accent)"
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
            dot={(props) => {
              const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: TrendPoint; index: number };
              return <circle key={index} cx={cx} cy={cy} r={compact ? 3.5 : 4.5} fill={dotColor(payload.flag)} stroke="var(--surface)" strokeWidth={2} />;
            }}
            activeDot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: TrendPoint };
              return <circle cx={cx} cy={cy} r={7} fill={dotColor(payload.flag)} stroke="var(--surface)" strokeWidth={2.5} style={{ cursor: onPointClick ? "pointer" : "default" }} onClick={() => onPointClick?.(payload)} />;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function ChartTooltip({ active, payload, unit, decimals }: Pick<Partial<TooltipContentProps<number, string>>, "active"> & { payload?: ReadonlyArray<{ payload?: unknown }>; unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TrendPoint;
  if (!p) return null;
  return (
    <div className="min-w-[180px] rounded-xl border border-line bg-surface px-3 py-2.5 shadow-pop">
      <div className="text-[11px] text-ink-3">{fmtDate(p.date, "long")}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[17px] font-semibold tabular text-ink">{formatValue(p.value, decimals)}</span>
        <span className="text-[12px] text-ink-3">{unit}</span>
        <span className="ml-auto text-[11px] font-medium" style={{ color: dotColor(p.flag) }}>
          {p.flag === "high" ? "High" : p.flag === "low" ? "Low" : p.flag === "normal" ? "In range" : ""}
        </span>
      </div>
      {(p.refLow !== undefined || p.refHigh !== undefined) && (
        <div className="mt-1 text-[11px] text-ink-3 tabular">
          Report range {p.refLow !== undefined ? formatValue(p.refLow, decimals) : "<"}
          {p.refLow !== undefined && p.refHigh !== undefined ? "–" : " "}
          {p.refHigh !== undefined ? formatValue(p.refHigh, decimals) : ""}
          {p.converted && " · converted"}
        </div>
      )}
      {p.label && <div className="mt-1.5 border-t border-line-2 pt-1.5 text-[11px] text-ink-2">{p.label}{p.provider ? ` · ${p.provider}` : ""}</div>}
    </div>
  );
}
