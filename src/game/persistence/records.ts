import type { Rank, StageResult } from '../systems/ScoreSystem';

export const SAVE_KEY = 'blue-current.records';
export interface StageRecord {
  cleared: boolean;
  bestScore: number;
  bestRank: Rank | null;
  noMiss: boolean;
  fastestTime: number | null;
  plays: number;
  clears: number;
}
export interface SaveData { version: 1; stages: Record<string, StageRecord> }
export interface RecordStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const rankOrder: Rank[] = ['C', 'B', 'A', 'S'];
export const emptyRecord = (): StageRecord => ({ cleared: false, bestScore: 0, bestRank: null, noMiss: false, fastestTime: null, plays: 0, clears: 0 });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Validate each record; unavailable, malformed or future-version saves never prevent play. */
export function readRecords(storage: RecordStorage): SaveData {
  const empty: SaveData = { version: 1, stages: {} };
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SAVE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 || !('stages' in parsed)
      || !parsed.stages || typeof parsed.stages !== 'object' || Array.isArray(parsed.stages)) return empty;
    for (const [id, value] of Object.entries(parsed.stages)) {
      if (!value || typeof value !== 'object') continue;
      const r = value as StageRecord;
      if (typeof r.cleared !== 'boolean' || !finite(r.bestScore) || !finite(r.plays) || !finite(r.clears)
        || !Number.isInteger(r.plays) || !Number.isInteger(r.clears) || r.clears > r.plays
        || typeof r.noMiss !== 'boolean' || !(r.bestRank === null || rankOrder.includes(r.bestRank))
        || !(r.fastestTime === null || finite(r.fastestTime))) continue;
      Object.defineProperty(empty.stages, id, { value: { ...r }, enumerable: true, writable: true, configurable: true });
    }
  } catch { /* Storage may be blocked or contain invalid JSON. */ }
  return empty;
}

export class RecordStore {
  data: SaveData;
  available = true;
  private completed = new Set<number>();
  constructor(private storage: RecordStorage) { this.data = readRecords(storage); }
  private save(): void {
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); this.available = true; }
    catch { this.available = false; }
  }
  start(stageId: string): void {
    const record = this.data.stages[stageId] ?? emptyRecord();
    this.data.stages[stageId] = { ...record, plays: record.plays + 1 };
    this.save();
  }
  clear(runId: number, result: StageResult): void {
    if (this.completed.has(runId)) return;
    this.completed.add(runId);
    const record = this.data.stages[result.stageId] ?? emptyRecord();
    this.data.stages[result.stageId] = {
      ...record, cleared: true, clears: record.clears + 1, plays: Math.max(record.plays, record.clears + 1),
      bestScore: Math.max(record.bestScore, result.score),
      bestRank: record.bestRank && rankOrder.indexOf(record.bestRank) > rankOrder.indexOf(result.rank) ? record.bestRank : result.rank,
      noMiss: record.noMiss || result.hitsTaken === 0,
      fastestTime: Math.min(record.fastestTime ?? Infinity, result.elapsed),
    };
    this.save();
  }
}

export function browserStorage(): RecordStorage {
  return { getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
}
