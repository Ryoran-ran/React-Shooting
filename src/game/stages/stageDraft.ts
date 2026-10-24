import type { EnemyAttack, EnemyMotion, EnemySpawn } from '../entities/Enemy';
import type { Vec2 } from '../core/coordinates';
import type { GimmickEvent } from './gimmicks';
import { STAGES, type StageDefinition } from './stages';

export type BeatKey = 'ki' | 'sho' | 'ten' | 'ketsu';
export interface StageBeat { key: BeatKey; start: number; title: string; intent: string }
export interface DraftSpawn extends EnemySpawn { editorId: string; groupId?: string }
export interface FormationGroup { id: string; name: string; origin: Vec2 }

/** Only authored values live in the draft. Runtime definitions stay shared with the game. */
export interface StageDraft {
  version: 3;
  baseStageId: string;
  name: string;
  description: string;
  bossAt: number;
  beats: StageBeat[];
  spawns: DraftSpawn[];
  groups: FormationGroup[];
  gimmicks: GimmickEvent[];
}

const STORAGE_PREFIX = 'blue-current-stage-draft-v1:';
const BEAT_KEYS: BeatKey[] = ['ki', 'sho', 'ten', 'ketsu'];
const BEAT_TITLES = ['起・導入', '承・展開', '転・変化', '結・決戦へ'];
const STAGE_INTENTS: Record<string, string[]> = {
  'stage-01': ['基本の敵の動きと海の広さを知る', '敵の種類と攻撃を少しずつ重ねる', '位置取りを変えて弾幕を抜ける', '間をつくり、守り手の登場に備える'],
  'stage-02': ['横切る群れから浅瀬の流れを感じる', '左右の挟み込みと縮小の予告に慣れる', '二度目の縮小で位置取りを変える', '圧を緩めて砂浜のボスへつなぐ'],
};

export function createStageDraft(base: StageDefinition): StageDraft {
  const duration = base.progression.bossAt;
  return {
    version: 3, baseStageId: base.id, name: base.name, description: base.description,
    bossAt: duration,
    beats: BEAT_KEYS.map((key, index) => ({
      key, start: index === 0 ? 0 : Math.round(duration * [0, .25, .52, .78][index] * 10) / 10,
      title: BEAT_TITLES[index], intent: STAGE_INTENTS[base.id]?.[index] ?? '',
    })),
    spawns: structuredClone(base.combat.spawns).map((spawn, index) => ({ ...spawn, editorId: `${base.id}-enemy-${index + 1}` })),
    groups: [],
    gimmicks: structuredClone(base.gimmicks),
  };
}

export function compileStageDraft(draft: StageDraft): StageDefinition {
  const base = STAGES.find((stage) => stage.id === draft.baseStageId);
  if (!base) throw new Error('元になるステージが見つかりません。');
  return {
    ...base, name: draft.name, description: draft.description,
    combat: { ...base.combat, cycleDuration: Math.max(base.combat.cycleDuration, draft.bossAt + 1),
      spawns: structuredClone(draft.spawns).sort((a, b) => a.time - b.time).map(({ editorId: _editorId, groupId: _groupId, ...spawn }) => spawn) },
    gimmicks: structuredClone(draft.gimmicks).sort((a, b) => a.at - b.at),
    progression: { ...base.progression, bossAt: draft.bossAt },
  };
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown, min = -Infinity, max = Infinity): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const point = (value: unknown): boolean => object(value) && number(value.x, -200, 920) && number(value.y, -200, 920);

function validMotion(value: unknown): value is EnemyMotion {
  if (!object(value)) return false;
  switch (value.kind) {
    case 'linear': return number(value.vx, -1000, 1000) && number(value.vy, -1000, 1000);
    case 'wave': return number(value.vx, -1000, 1000) && number(value.vy, -1000, 1000)
      && number(value.amplitude, 0, 500) && number(value.frequency, 0, 20);
    case 'zigzag': return number(value.vx, -1000, 1000) && number(value.vy, -1000, 1000)
      && number(value.amplitude, 0, 500) && number(value.period, .1, 60);
    case 'chase': return number(value.speed, 1, 1000);
    case 'fixed': return point(value.destination) && number(value.speed, 1, 1000);
    case 'path': return Array.isArray(value.points) && value.points.length > 0 && value.points.length <= 20
      && value.points.every(point) && number(value.speed, 1, 1000) && typeof value.exitAtEnd === 'boolean';
    default: return false;
  }
}

function validAttack(value: unknown): value is EnemyAttack {
  if (!object(value) || !['straight', 'aimed', 'laser'].includes(String(value.kind))) return false;
  if (!number(value.firstShot, 0, 120) || !number(value.interval, .1, 120)
    || !number(value.speed, 0, 1000) || !number(value.count, 1, 100) || !Number.isInteger(value.count)
    || !number(value.spread, 0, 7)) return false;
  if (value.belowHpRatio !== undefined && !number(value.belowHpRatio, 0, 1)) return false;
  if (value.kind === 'laser') return object(value.laser) && number(value.laser.warning, 0, 20)
    && number(value.laser.duration, .1, 20) && number(value.laser.width, 1, 100)
    && number(value.laser.length, 1, 2000);
  return true;
}

function validSpawn(value: unknown, bossAt: number): value is EnemySpawn {
  return object(value) && number(value.time, 0, bossAt)
    && ['small', 'medium', 'turret', 'rusher', 'large'].includes(String(value.kind))
    && point(value.position) && validMotion(value.motion)
    && (value.retireAfter === undefined || number(value.retireAfter, 0, 300))
    && (value.attacks === undefined || (Array.isArray(value.attacks) && value.attacks.length <= 8 && value.attacks.every(validAttack)));
}

function validDraftSpawn(value: unknown, bossAt: number): value is DraftSpawn {
  return validSpawn(value, bossAt) && object(value)
    && typeof value.editorId === 'string' && value.editorId.length > 0 && value.editorId.length <= 100
    && (value.groupId === undefined || (typeof value.groupId === 'string' && value.groupId.length > 0 && value.groupId.length <= 100));
}

function validGroup(value: unknown): value is FormationGroup {
  return object(value) && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100
    && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 80
    && point(value.origin);
}

function validGimmick(value: unknown, bossAt: number): value is GimmickEvent {
  return object(value) && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100
    && value.kind === 'screen-shrink' && number(value.at, 0, bossAt)
    && number(value.warning, 0, 20) && number(value.contract, .1, 20)
    && number(value.hold, 0, 120) && number(value.recover, .1, 20)
    && number(value.inset, 0, 250) && number(value.scale, .3, 1);
}

/** Keep drafts saved before the event-list format usable in the same browser. */
function migrateLegacyDraft(value: unknown): unknown {
  if (!object(value) || value.version !== 1) return value;
  const old = value.gimmick;
  let gimmicks: unknown[] = [];
  if (old !== undefined) {
    if (!object(old) || old.kind !== 'screen-shrink' || !Array.isArray(old.windows))
      throw new Error('旧形式の画面縮小設定を読み込めません。');
    gimmicks = old.windows.map((window, index) => object(window) ? {
      ...window, id: `${String(value.baseStageId)}-shrink-${index + 1}`,
      kind: 'screen-shrink', inset: old.inset, scale: old.scale,
    } : window);
  }
  return { version: 2, baseStageId: value.baseStageId, name: value.name,
    description: value.description, bossAt: value.bossAt, beats: value.beats,
    spawns: value.spawns, gimmicks };
}

/** Version 2 had no editor identities or grouping. Keep every authored enemy unchanged. */
function migrateUngroupedDraft(value: unknown): unknown {
  if (!object(value) || value.version !== 2) return value;
  return { ...value, version: 3, groups: [],
    spawns: Array.isArray(value.spawns) ? value.spawns.map((spawn, index) => object(spawn)
      ? { ...spawn, editorId: `${String(value.baseStageId)}-enemy-${index + 1}` } : spawn) : value.spawns };
}

/** Imported files are untrusted; check every field used by the simulation before accepting one. */
export function parseStageDraft(value: unknown): StageDraft {
  value = migrateUngroupedDraft(migrateLegacyDraft(value));
  if (!object(value) || value.version !== 3 || typeof value.baseStageId !== 'string'
    || !STAGES.some((stage) => stage.id === value.baseStageId)) throw new Error('対応していないステージファイルです。');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80
    || typeof value.description !== 'string' || value.description.length > 400
    || !number(value.bossAt, 5, 600)) throw new Error('ステージ名・説明・ボス開始時刻を確認してください。');
  if (!Array.isArray(value.beats) || value.beats.length !== 4 || !value.beats.every((beat, index) =>
    object(beat) && beat.key === BEAT_KEYS[index] && number(beat.start, 0, value.bossAt as number)
    && typeof beat.title === 'string' && beat.title.length <= 80
    && typeof beat.intent === 'string' && beat.intent.length <= 400)) throw new Error('起承転結の区間を確認してください。');
  const beats = value.beats as StageBeat[];
  if (beats[0].start !== 0 || beats.slice(1).some((beat, index) => beat.start <= beats[index].start)
    || beats[3].start >= value.bossAt) throw new Error('起承転結の開始時刻は 0 秒から順番に設定してください。');
  if (!Array.isArray(value.spawns) || value.spawns.length > 300
    || !value.spawns.every((spawn) => validDraftSpawn(spawn, value.bossAt as number))
    || new Set(value.spawns.map((spawn: DraftSpawn) => spawn.editorId)).size !== value.spawns.length)
    throw new Error('敵の出現設定を確認してください。');
  if (!Array.isArray(value.groups) || value.groups.length > 100
    || !value.groups.every(validGroup)
    || new Set(value.groups.map((group: FormationGroup) => group.id)).size !== value.groups.length)
    throw new Error('編隊グループを確認してください。');
  const groups = new Set((value.groups as FormationGroup[]).map((group) => group.id));
  if ((value.spawns as DraftSpawn[]).some((spawn) => spawn.groupId !== undefined && !groups.has(spawn.groupId))
    || (value.groups as FormationGroup[]).some((group) => !(value.spawns as DraftSpawn[]).some((spawn) => spawn.groupId === group.id)))
    throw new Error('編隊グループと敵の対応を確認してください。');
  if (!Array.isArray(value.gimmicks) || value.gimmicks.length > 30
    || !value.gimmicks.every((event) => validGimmick(event, value.bossAt as number))
    || new Set(value.gimmicks.map((event: GimmickEvent) => event.id)).size !== value.gimmicks.length)
    throw new Error('ギミックの設定を確認してください。');
  return structuredClone(value) as unknown as StageDraft;
}

export function loadStageDraft(stageId: string): StageDraft | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + stageId);
    return stored ? parseStageDraft(JSON.parse(stored) as unknown) : null;
  } catch { return null; }
}

export function saveStageDraft(draft: StageDraft): void {
  const valid = parseStageDraft(draft);
  window.localStorage.setItem(STORAGE_PREFIX + valid.baseStageId, JSON.stringify(valid));
}

export function getPlayableStages(): StageDefinition[] {
  return STAGES.map((stage) => {
    const draft = loadStageDraft(stage.id);
    return draft?.baseStageId === stage.id ? compileStageDraft(draft) : stage;
  });
}
