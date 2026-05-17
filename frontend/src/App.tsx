import { useEffect, useMemo, useState } from "react";
import {
  fetchSectors,
  fetchStress,
  type Sector,
  type StressResponse,
} from "./api";
import { CompositeChart, VolatilityChart } from "./charts";

const DEFAULT_SELECTED = ["XLF", "XLE", "XLK"];
const DEFAULT_WINDOW = 21;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  return { start: isoDate(start), end: isoDate(end) };
}

export default function App() {
  // Sectors directory
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorsError, setSectorsError] = useState<string | null>(null);
  const [sectorsLoading, setSectorsLoading] = useState(true);

  // Controls
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_SELECTED),
  );
  const initialRange = useMemo(defaultRange, []);
  const [start, setStart] = useState(initialRange.start);
  const [end, setEnd] = useState(initialRange.end);
  const [windowSize, setWindowSize] = useState<number>(DEFAULT_WINDOW);

  // Stress response
  const [stress, setStress] = useState<StressResponse | null>(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [stressError, setStressError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSectors(ctrl.signal)
      .then((data) => {
        setSectors(data);
        setSectorsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSectorsError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setSectorsLoading(false));
    return () => ctrl.abort();
  }, []);

  function toggle(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  // Order selected tickers by their display order in the sectors list
  // so the request param is deterministic and matches chart series order.
  const selectedOrdered = useMemo(
    () => sectors.filter((s) => selected.has(s.ticker)).map((s) => s.ticker),
    [sectors, selected],
  );

  const canSubmit =
    !stressLoading &&
    selectedOrdered.length > 0 &&
    !!start &&
    !!end &&
    start <= end &&
    windowSize >= 2 &&
    windowSize <= 252;

  async function onUpdate() {
    if (!canSubmit) return;
    setStressLoading(true);
    setStressError(null);
    try {
      const data = await fetchStress({
        sectors: selectedOrdered,
        start,
        end,
        window: windowSize,
      });
      setStress(data);
      // eslint-disable-next-line no-console
      console.log("[/api/stress]", data);
    } catch (err: unknown) {
      setStressError(err instanceof Error ? err.message : String(err));
    } finally {
      setStressLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto max-w-[1400px] px-6 py-5">
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">
            SectorStress
          </h1>
          <p className="mt-0.5 text-sm text-navy-400">
            Sectoral financial stress, computed in MATLAB.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr] lg:gap-8">
          <aside className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                Sectors
              </h2>
              <div className="mt-3">
                {sectorsLoading && (
                  <p className="text-sm text-navy-400">Loading sectors…</p>
                )}
                {sectorsError && (
                  <p className="text-sm text-red-600">
                    Could not load sectors. {sectorsError}
                  </p>
                )}
                {!sectorsLoading && !sectorsError && (
                  <SectorChips
                    sectors={sectors}
                    selected={selected}
                    onToggle={toggle}
                  />
                )}
              </div>
              {!sectorsLoading && !sectorsError && (
                <p className="mt-3 tnum text-xs text-navy-400">
                  {selected.size} of {sectors.length} selected
                </p>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                Date range
              </h2>
              <div className="mt-3 space-y-2">
                <Field label="Start">
                  <input
                    type="date"
                    value={start}
                    max={end || undefined}
                    onChange={(e) => setStart(e.target.value)}
                    className="tnum w-full rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-900 focus:border-navy-500 focus:outline-none"
                  />
                </Field>
                <Field label="End">
                  <input
                    type="date"
                    value={end}
                    min={start || undefined}
                    onChange={(e) => setEnd(e.target.value)}
                    className="tnum w-full rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-900 focus:border-navy-500 focus:outline-none"
                  />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                Rolling window
              </h2>
              <div className="mt-3">
                <Field label="Trading days">
                  <input
                    type="number"
                    min={2}
                    max={252}
                    step={1}
                    value={windowSize}
                    onChange={(e) =>
                      setWindowSize(
                        Number.isFinite(e.target.valueAsNumber)
                          ? e.target.valueAsNumber
                          : DEFAULT_WINDOW,
                      )
                    }
                    className="tnum w-full rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-sm text-navy-900 focus:border-navy-500 focus:outline-none"
                  />
                </Field>
              </div>
            </section>

            <button
              type="button"
              onClick={onUpdate}
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-navy-300 cursor-pointer"
            >
              {stressLoading ? (
                <>
                  <Spinner />
                  <span>Computing…</span>
                </>
              ) : (
                <span>Update</span>
              )}
            </button>
          </aside>

          <div className="space-y-3">
            <section className="rounded-lg border border-navy-100 bg-white p-6 min-h-[420px]">
              <ChartPanel
                stress={stress}
                loading={stressLoading}
                error={stressError}
              />
            </section>
            <StatusFooter stress={stress} />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusFooter({ stress }: { stress: StressResponse | null }) {
  if (!stress || stress.dates.length === 0) {
    return (
      <p className="px-1 text-xs text-navy-400">
        Data range • waiting for first request
      </p>
    );
  }
  const first = stress.dates[0];
  const last = stress.dates[stress.dates.length - 1];
  return (
    <p className="tnum px-1 text-xs text-navy-500">
      <span className="text-navy-400">Data range:</span>{" "}
      <span className="font-mono">{first}</span>
      <span className="text-navy-300"> &rarr; </span>
      <span className="font-mono">{last}</span>
      <span className="px-2 text-navy-300">&middot;</span>
      <span className="font-mono">{stress.dates.length}</span>{" "}
      <span className="text-navy-400">trading days</span>
      <span className="px-2 text-navy-300">&middot;</span>
      <span className="text-navy-400">window </span>
      <span className="font-mono">{stress.window}</span>
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-navy-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectorChips({
  sectors,
  selected,
  onToggle,
}: {
  sectors: Sector[];
  selected: Set<string>;
  onToggle: (ticker: string) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {sectors.map((s) => {
        const on = selected.has(s.ticker);
        return (
          <li key={s.ticker}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(s.ticker)}
              title={s.name}
              className={
                "group flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer " +
                (on
                  ? "border-navy-700 bg-navy-700 text-white hover:bg-navy-800"
                  : "border-navy-200 bg-white text-navy-600 hover:border-navy-300 hover:bg-navy-50")
              }
            >
              <span className="font-mono font-semibold tracking-wide">
                {s.ticker}
              </span>
              <span
                className={
                  "text-[10px] " + (on ? "text-navy-100" : "text-navy-400")
                }
              >
                {s.name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ChartPanel({
  stress,
  loading,
  error,
}: {
  stress: StressResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex h-[380px] flex-col items-center justify-center gap-3 text-navy-400">
        <Spinner size={20} />
        <p className="text-sm">
          Computing stress metrics in MATLAB. The first run cold-starts the
          engine and may take 5–10 seconds.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-[380px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-red-600">
          /api/stress request failed
        </p>
        <p className="max-w-md text-xs text-navy-500">{error}</p>
      </div>
    );
  }
  if (!stress) {
    return (
      <div className="flex h-[380px] items-center justify-center text-center">
        <p className="text-sm text-navy-400">
          Pick sectors and a date range, then click <b>Update</b>.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-navy-900">
            Composite stress index
          </h3>
          <p className="text-[11px] uppercase tracking-wider text-navy-400">
            Normalized 0 – 1
          </p>
        </div>
        <CompositeChart stress={stress} />
      </div>
      <div className="space-y-2 border-t border-navy-100 pt-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-navy-900">
            Per-sector rolling volatility
          </h3>
          <p className="text-[11px] uppercase tracking-wider text-navy-400">
            σ &middot; window {stress.window}
          </p>
        </div>
        <VolatilityChart stress={stress} />
      </div>
    </div>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
