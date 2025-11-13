import type { SummaryStats, RecentScrobble } from '../types/api';

const API_BASE = '/api';

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Accept': 'application/json', ...(init?.headers||{}) } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchSummaryStats(): Promise<SummaryStats | null> {
  try {
    const data = await get<SummaryStats>('/v2/stats/summary');
    return data;
  } catch (e) {
    console.warn('fetchSummaryStats failed', e);
    return null;
  }
}

interface RecentResponse { scrobbles: RecentScrobble[]; beforeCursor?: string; }
export async function fetchRecentScrobbles(limit = 10): Promise<RecentScrobble[]> {
  try {
    const data = await get<RecentResponse>(`/v2/scrobbles/recent?limit=${limit}`);
    return data.scrobbles || [];
  } catch (e) {
    console.warn('fetchRecentScrobbles failed', e);
    return [];
  }
}
