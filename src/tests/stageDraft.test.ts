import { afterEach, expect, it, vi } from 'vitest';
import { Game } from '../game/core/Game';
import { IDLE_INPUT } from '../game/systems/InputSystem';
import { STAGES, stageTwo } from '../game/stages/stages';
import { compileStageDraft, createStageDraft, getPlayableStages, loadStageDraft, parseStageDraft, saveStageDraft } from '../game/stages/stageDraft';

afterEach(() => vi.unstubAllGlobals());

it('starts with valid drafts for every built-in stage', () => {
  for (const stage of STAGES) expect(parseStageDraft(createStageDraft(stage)).baseStageId).toBe(stage.id);
});

it('uses the edited timeline and gimmick in the real stage simulation without changing the source stage', () => {
  const draft = createStageDraft(stageTwo);
  const sourceTime = stageTwo.combat.spawns[0].time;
  draft.spawns[0].time = 3;
  draft.bossAt = 59;
  draft.gimmicks[0].at = 18;
  const compiled = compileStageDraft(parseStageDraft(draft));
  expect(compiled.combat.spawns[0].time).toBeGreaterThanOrEqual(sourceTime);
  expect(compiled.combat.spawns.some((spawn) => spawn.time === 3)).toBe(true);
  expect(compiled.progression.bossAt).toBe(59);
  expect(compiled.gimmicks[0].at).toBe(18);
  expect(stageTwo.combat.spawns[0].time).toBe(sourceTime);
  expect(stageTwo.gimmicks[0].at).toBe(14);
  const game = new Game();
  game.startStage(compiled);
  for (let i = 0; i < 180; i++) game.update(1 / 60, IDLE_INPUT);
  expect(game.state.elapsed).toBeCloseTo(3, 1);
  expect(game.state.spawnCursor).toBeGreaterThan(0);
});

it('rejects invalid imported events before they reach the game', () => {
  const draft = createStageDraft(stageTwo);
  draft.beats[2].start = draft.beats[1].start;
  expect(() => parseStageDraft(draft)).toThrow('起承転結');
  draft.beats[2].start = 30;
  draft.spawns[0].motion = { kind: 'path', points: [], speed: 1, exitAtEnd: true };
  expect(() => parseStageDraft(draft)).toThrow('敵の出現設定');
});

it('keeps overlapping events independent and rejects duplicate event IDs', () => {
  const draft = createStageDraft(stageTwo);
  draft.gimmicks[1].at = draft.gimmicks[0].at;
  draft.gimmicks[1].inset = 30;
  expect(parseStageDraft(draft).gimmicks).toHaveLength(2);
  expect(compileStageDraft(draft).gimmicks[1].inset).toBe(30);
  draft.gimmicks[1].id = draft.gimmicks[0].id;
  expect(() => parseStageDraft(draft)).toThrow('ギミック');
});

it('migrates saved version 1 shrink windows into independent events', () => {
  const current = createStageDraft(stageTwo);
  const { gimmicks, groups: _groups, ...rest } = current;
  const old = { ...rest, version: 1, gimmick: {
    kind: 'screen-shrink', inset: 45, scale: .82,
    windows: gimmicks.map(({ at, warning, contract, hold, recover }) => ({ at, warning, contract, hold, recover })),
  }, spawns: current.spawns.map(({ editorId: _editorId, groupId: _groupId, ...spawn }) => spawn) };
  const migrated = parseStageDraft(old);
  expect(migrated.version).toBe(3);
  expect(migrated.gimmicks).toHaveLength(2);
  expect(migrated.gimmicks[0]).toMatchObject({ at: 14, inset: 45, scale: .82 });
  expect(migrated.gimmicks[0].id).not.toBe(migrated.gimmicks[1].id);
  expect(migrated.spawns[0].editorId).toBeTruthy();
});

it('migrates version 2 drafts without losing enemies or gimmicks', () => {
  const current = createStageDraft(stageTwo);
  const { groups: _groups, ...old } = current;
  const versionTwo = { ...old, version: 2,
    spawns: current.spawns.map(({ editorId: _editorId, groupId: _groupId, ...spawn }) => spawn) };
  const migrated = parseStageDraft(versionTwo);
  expect(migrated.version).toBe(3);
  expect(migrated.groups).toEqual([]);
  expect(migrated.spawns).toHaveLength(current.spawns.length);
  expect(compileStageDraft(migrated).combat.spawns).toEqual(stageTwo.combat.spawns);
});

it('loads a saved draft in stage selection while keeping other stages unchanged', () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } });
  const draft = createStageDraft(stageTwo);
  draft.name = '調整した浅瀬';
  saveStageDraft(draft);
  expect(loadStageDraft(stageTwo.id)?.name).toBe('調整した浅瀬');
  const stages = getPlayableStages();
  expect(stages[0].id).toBe('stage-01');
  expect(stages[1].name).toBe('調整した浅瀬');
});
