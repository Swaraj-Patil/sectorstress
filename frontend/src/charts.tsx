import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StressResponse } from "./api";

// Stable per-ticker palette. Ordered to give the default selection
// (XLF/XLE/XLK) three highly distinct hues, then fan out for the rest.
// All hues sit far enough from navy-700 to read against the composite line above.
export const SECTOR_PALETTE: Record<string, string> = {
  XLF: "#0d9488", // teal-600
  XLE: "#d97706", // amber-600
  XLK: "#7c3aed", // violet-600
  XLV: "#0ea5e9", // sky-500
  XLI: "#e11d48", // rose-600
  XLP: "#65a30d", // lime-600
  XLY: "#db2777", // pink-600
  XLU: "#0891b2", // cyan-600
  XLB: "#ca8a04", // yellow-600
  XLRE: "#475569", // slate-600
  XLC: "#9333ea", // purple-600
};

const FALLBACK_PALETTE = [
  "#0d9488",
  "#d97706",
  "#7c3aed",
  "#0ea5e9",
  "#e11d48",
  "#65a30d",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#475569",
  "#9333ea",
];

export function colorFor(ticker: string, index: number): string {
  return (
    SECTOR_PALETTE[ticker] ??
    FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]
  );
}

const AXIS_COLOR = "#c9d3e6"; // navy-200
const GRID_COLOR = "#e4eaf3"; // navy-100
const TICK_COLOR = "#5d75a2"; // navy-400
const ACCENT = "#1c2d50"; // navy-700

export function fmtMonth(iso: string): string {
  // ISO YYYY-MM-DD — parse as UTC to avoid local-tz day drift on axis labels.
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtFullDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtNum3(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(3) : "•";
}

type CompositeRow = { date: string; composite: number | null };

export function CompositeChart({ stress }: { stress: StressResponse }) {
  const data: CompositeRow[] = stress.dates.map((date, i) => ({
    date,
    composite: stress.composite[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
      >
        <CartesianGrid
          stroke={GRID_COLOR}
          strokeDasharray="2 4"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={fmtMonth}
          minTickGap={48}
          tickLine={false}
          axisLine={{ stroke: AXIS_COLOR }}
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          padding={{ left: 4, right: 4 }}
        />
        <YAxis
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={(v: number) => v.toFixed(2)}
          tickLine={false}
          axisLine={{ stroke: AXIS_COLOR }}
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          width={44}
        />
        <Tooltip
          cursor={{ stroke: AXIS_COLOR, strokeDasharray: "2 4" }}
          content={CompositeTooltip}
        />
        <Line
          type="monotone"
          dataKey="composite"
          stroke={ACCENT}
          strokeWidth={2.25}
          dot={false}
          activeDot={{ r: 4, fill: ACCENT, stroke: "#fff", strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ readonly value?: unknown }>;
  label?: unknown;
};

function CompositeTooltip(props: TooltipProps) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const v = typeof raw === "number" ? raw : null;
  return (
    <div className="rounded-md border border-navy-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[11px] uppercase tracking-wider text-navy-400">
        {fmtFullDate(String(label))}
      </div>
      <div className="tnum mt-0.5 font-mono text-sm text-navy-900">
        {fmtNum3(v)}
      </div>
    </div>
  );
}

type VolatilityRow = { date: string } & Record<string, number | string | null>;

export function VolatilityChart({ stress }: { stress: StressResponse }) {
  // movstd reports partial-window values for the first (window - 1) rows,
  // which makes the lines ramp up from ~0 on the left. Null them out so the
  // chart gaps the leading region — matches the composite's connectNulls={false}
  // behavior and keeps the two charts visually aligned on the x-axis.
  const leadingNulls = Math.max(0, stress.window - 1);
  const data: VolatilityRow[] = stress.dates.map((date, i) => {
    const row: VolatilityRow = { date };
    stress.sectors.forEach((ticker, j) => {
      const v = stress.volatility[i]?.[j];
      row[ticker] =
        i < leadingNulls || typeof v !== "number" || !Number.isFinite(v)
          ? null
          : v;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
      >
        <CartesianGrid
          stroke={GRID_COLOR}
          strokeDasharray="2 4"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={fmtMonth}
          minTickGap={48}
          tickLine={false}
          axisLine={{ stroke: AXIS_COLOR }}
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          padding={{ left: 4, right: 4 }}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => v.toFixed(3)}
          tickLine={false}
          axisLine={{ stroke: AXIS_COLOR }}
          tick={{ fill: TICK_COLOR, fontSize: 11 }}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: AXIS_COLOR, strokeDasharray: "2 4" }}
          content={VolatilityTooltip}
        />
        <Legend content={VolatilityLegend} verticalAlign="bottom" />
        {stress.sectors.map((ticker, idx) => (
          <Line
            key={ticker}
            type="monotone"
            dataKey={ticker}
            name={ticker}
            stroke={colorFor(ticker, idx)}
            strokeWidth={1.5}
            dot={false}
            activeDot={{
              r: 3,
              fill: colorFor(ticker, idx),
              stroke: "#fff",
              strokeWidth: 1.5,
            }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

type LegendEntry = { readonly value?: unknown; readonly color?: string };
type LegendProps = { payload?: ReadonlyArray<LegendEntry> };

function VolatilityLegend(props: LegendProps) {
  const { payload } = props;
  if (!payload || payload.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
      {payload.map((entry) => (
        <li
          key={String(entry.value)}
          className="flex items-center gap-2 text-xs text-navy-600"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: entry.color }}
          />
          <span className="font-mono font-semibold tracking-wide">
            {String(entry.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

type MultiTooltipEntry = {
  readonly name?: unknown;
  readonly value?: unknown;
  readonly color?: string;
  readonly dataKey?: unknown;
};
type MultiTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<MultiTooltipEntry>;
  label?: unknown;
};

function VolatilityTooltip(props: MultiTooltipProps) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-navy-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[11px] uppercase tracking-wider text-navy-400">
        {fmtFullDate(String(label))}
      </div>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => {
          const raw = entry.value;
          const v = typeof raw === "number" ? raw : null;
          return (
            <li
              key={String(entry.dataKey ?? entry.name)}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: entry.color }}
                />
                <span className="font-mono font-semibold text-navy-600">
                  {String(entry.name ?? entry.dataKey)}
                </span>
              </span>
              <span className="tnum font-mono text-navy-900">
                {fmtNum3(v)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
