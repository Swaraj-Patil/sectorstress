export const API_BASE = "http://localhost:8000";

export type Sector = { ticker: string; name: string };

export type StressResponse = {
  sectors: string[];
  dates: string[];
  composite: (number | null)[];
  avg_corr: (number | null)[];
  volatility: number[][];
  window: number;
};

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Request ${path} failed: ${res.status} ${res.statusText}${body ? ` • ${body}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

export function fetchSectors(signal?: AbortSignal): Promise<Sector[]> {
  return getJSON<Sector[]>("/api/sectors", signal);
}

export function fetchStress(
  params: { sectors: string[]; start: string; end: string; window: number },
  signal?: AbortSignal,
): Promise<StressResponse> {
  const q = new URLSearchParams();
  for (const t of params.sectors) q.append("sectors", t);
  q.append("start", params.start);
  q.append("end", params.end);
  q.append("window", String(params.window));
  return getJSON<StressResponse>(`/api/stress?${q.toString()}`, signal);
}
