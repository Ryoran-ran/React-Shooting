import { describe, expect, it } from 'vitest';
import { Game } from '../game/core/Game';
import { getHudSnapshot } from '../game/core/GameState';
import { stageOne, type StageDefinition } from '../game/stages/stages';
import { IDLE_INPUT } from '../game/systems/InputSystem';
import { createEnemy } from '../game/systems/SpawnSystem';
import { resolveBoss } from '../game/systems/StageSystem';
import { resolveDefeats } from '../game/systems/DropSystem';
import { calculateResult } from '../game/systems/ScoreSystem';
import { GAME_CONFIG } from '../game/config';
import { RecordStore, readRecords, SAVE_KEY, type RecordStorage } from '../game/persistence/records';

const step = 1 / 60;
let id = 0;
const nextId = () => `stage-test-${++id}`;
function run(game: Game, seconds: number) { for (let i = 0; i < Math.round(seconds / step); i++) game.update(step, IDLE_INPUT); }
function stageGame(bossAt = 1) {
  const definition: StageDefinition = { ...stageOne, combat: { ...stageOne.combat, spawns: [] }, progression: { ...stageOne.progression, bossAt } };
  return new Game(definition, 'stage');
}
function projectiles(game: Game) {
  const p = { x: 60, y: 60 };
  game.state.enemyBullets.push({ id: nextId(), position: p, previousPosition: p, velocity: { x: 0, y: 0 }, hitRadius: 4, damage: 1, age: 0 });
  game.state.lasers.push({ id: nextId(), origin: p, end: { x: 60, y: 700 }, age: 0, warning: 1, duration: 1, width: 10, damage: 1 });
}
function result(score = 5000, hits = 0, hp = 10) {
  const game = stageGame(); game.state.score = score; game.state.hitsTaken = hits; game.state.player.hp = hp;
  return calculateResult(game.state);
}
function memory() {
  const values = new Map<string, string>();
  const storage: RecordStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  return { values, storage };
}

describe('a complete stage', () => {
  it('plays the finite timeline once, arrives at the boss and resets the same stage on retry', () => {
    const game = new Game(stageOne, 'stage');
    game.state.enemyAttacksEnabled = false;
    for (let i = 0; i < 60 * 58; i++) { game.state.player.invulnerableFor = 1; game.update(step, IDLE_INPUT); }
    expect(game.state.spawnCursor).toBe(stageOne.combat.spawns.length);
    expect(game.state.spawnCycle).toBe(0);
    expect(game.state.enemies.filter((e) => e.kind === 'boss')).toHaveLength(1);
    expect(game.state.boss?.entering).toBe(false);
    expect(getHudSnapshot(game.state).boss?.phase).toBe(1);
    const oldRun = game.state.runId;
    game.state.player.hp = 2; game.state.player.heal = 80; game.state.score = 900;
    game.reset();
    expect(game.state.runId).toBeGreaterThan(oldRun);
    expect(game.state.stage?.id).toBe('stage-01');
    expect(game.state.player.hp).toBe(10); expect(game.state.player.heal).toBe(0);
    expect(game.state.score).toBe(0); expect(game.state.elapsed).toBe(0); expect(game.state.boss).toBeNull();
    expect(game.state.enemies).toHaveLength(0); expect(game.state.spawnCursor).toBe(0);
  });

  it('converts bullets and warning lasers, collects items once, then starts the next phase safely', () => {
    const game = stageGame(); run(game, 4.3);
    const enemy = game.state.enemies.find((e) => e.kind === 'boss')!;
    game.state.player.hp = 8; game.state.player.heal = 80;
    game.state.items.push({ id: nextId(), position: { x: 600, y: 20 }, previousPosition: { x: 600, y: 20 }, velocity: { x: 0, y: 45 }, age: 19.9 });
    projectiles(game); enemy.hp = enemy.maxHp / 2; enemy.attackCooldowns.fill(-10);
    resolveBoss(game.state, nextId);
    expect(game.state.boss?.phaseIndex).toBe(0);
    expect(game.state.boss?.pendingPhase).toBe(1);
    expect(enemy.invulnerable).toBe(true);
    expect(game.state.enemyBullets).toHaveLength(0); expect(game.state.lasers).toHaveLength(0);
    expect(game.state.scoreItems).toHaveLength(8);
    const bonus = game.state.scoreItems.reduce((sum, item) => sum + item.value, 0);
    expect(bonus).toBe(170);
    run(game, 0.15);
    expect(game.state.scoreItems.length).toBeGreaterThan(0);
    game.setPaused(true); const frozen = structuredClone(game.state); run(game, 1);
    expect(game.state).toEqual(frozen); game.setPaused(false);
    run(game, 1.5);
    expect(game.state.enemyBullets).toHaveLength(0); expect(game.state.lasers).toHaveLength(0);
    expect(game.state.scoreItems).toHaveLength(0);
    expect(game.state.items).toHaveLength(0); expect(game.state.player.hp).toBe(9);
    expect(game.state.boss?.phaseIndex).toBe(0);
    expect(game.state.boss?.collected).toBe(8); expect(game.state.score).toBe(bonus);
    while (game.state.boss?.pendingPhase !== null) game.update(step, IDLE_INPUT);
    expect(game.state.boss?.phaseIndex).toBe(1);
    expect(enemy.invulnerable).toBe(false);
    enemy.attackCooldowns.forEach((cooldown, index) => expect(cooldown).toBeCloseTo(stageOne.progression.boss.phases[1].attacks[index].firstShot - step));
    run(game, 1.4); expect(game.state.enemyBullets.length).toBeGreaterThan(0);
    expect(game.state.score).toBe(bonus);
  });

  it('starts the arrival animation after the final wave is cleared, without waiting for the time limit', () => {
    const definition: StageDefinition = { ...stageOne, combat: { ...stageOne.combat, spawns: [
      { time: 0.1, kind: 'small', position: { x: 100, y: 100 }, motion: { kind: 'linear', vx: 0, vy: 0 } },
      { time: 1, kind: 'small', position: { x: 100, y: 100 }, motion: { kind: 'linear', vx: 0, vy: 0 } },
    ] } };
    const game = new Game(definition, 'stage'); run(game, 0.2);
    game.state.enemies[0].hp = 0; run(game, 0.2);
    expect(game.state.stagePhase).toBe('waves'); // A scheduled later wave must still appear.
    run(game, 0.7); game.state.enemies[0].hp = 0; run(game, step * 2);
    expect(game.state.stagePhase).toBe('boss-intro');
    expect(game.state.elapsed).toBeLessThan(2);
    expect(game.state.boss?.entering).toBe(true);
    run(game, 1); game.setPaused(true);
    const elapsed = game.state.bossIntroElapsed; run(game, 2);
    expect(game.state.bossIntroElapsed).toBe(elapsed);
    game.setPaused(false); run(game, 2.3);
    expect(game.state.stagePhase).toBe('boss');
    expect(game.state.boss?.entering).toBe(false);
  });

  it('holds the boss at the laser emitter through warning and firing, locks aim, then resumes movement', () => {
    const game = stageGame(); run(game, 4.3);
    const enemy = game.state.enemies.find((e) => e.kind === 'boss')!;
    const laserAttack = stageOne.progression.boss.phases[1].attacks.find((attack) => attack.kind === 'laser')!;
    enemy.attacks = [laserAttack]; enemy.attackCooldowns = [0];
    game.update(step, IDLE_INPUT);
    const beam = game.state.lasers[0];
    expect(beam.emitterId).toBe(enemy.id);
    expect(beam.origin).toEqual({ x: enemy.position.x, y: enemy.position.y + 60 });
    const origin = { ...enemy.position }; const end = { ...beam.end };
    game.state.player.position.x = 100;
    run(game, 1.5);
    expect(enemy.position).toEqual(origin); expect(beam.end).toEqual(end);
    expect(beam.age).toBeGreaterThan(beam.warning);
    run(game, 0.2); expect(enemy.position).toEqual(origin);
    run(game, 0.6); expect(game.state.lasers).toHaveLength(0);
    expect(enemy.position).not.toEqual(origin);
  });

  it('animates the defeated boss, shows clear before results, and awards bonuses only once', () => {
    const game = stageGame(); run(game, 4.2);
    const enemy = game.state.enemies.find((e) => e.kind === 'boss')!;
    game.state.score = 1000; projectiles(game); enemy.hp = 0;
    game.update(step, IDLE_INPUT);
    expect(game.state.result?.combatScore).toBe(6000);
    expect(game.state.result?.score).toBe(24000);
    expect(game.state.result?.rank).toBe('S');
    expect(game.state.enemies).toEqual([enemy]); expect(enemy.attacks).toHaveLength(0);
    expect(game.state.items).toHaveLength(0);
    expect(game.state.enemyBullets).toHaveLength(0); expect(game.state.lasers).toHaveLength(0);
    expect(game.state.bullets).toHaveLength(0); expect(game.state.gameOver).toBe(false);
    expect(getHudSnapshot(game.state).clearCueReady).toBe(false);
    const time = game.state.elapsed; const pos = { ...game.state.player.position };
    run(game, GAME_CONFIG.boss.clearCueDelay + step); resolveBoss(game.state, nextId);
    expect(getHudSnapshot(game.state).clearCueReady).toBe(true);
    expect(getHudSnapshot(game.state).clearReady).toBe(false);
    run(game, GAME_CONFIG.boss.resultDelay - GAME_CONFIG.boss.clearCueDelay);
    expect(game.state.elapsed).toBe(time); expect(game.state.player.position).toEqual(pos);
    expect(game.state.score).toBe(24000); expect(getHudSnapshot(game.state).clearReady).toBe(true);
  });

  it('awards kills only, ignores escapes and contact explosions, and respects stage rank thresholds', () => {
    const game = stageGame();
    const defeated = createEnemy({ time: 0, kind: 'large', position: { x: 360, y: 200 }, motion: { kind: 'linear', vx: 0, vy: 0 } }, nextId());
    const escaped = { ...defeated, id: nextId(), retired: true };
    defeated.hp = 0; game.state.enemies.push(defeated, escaped);
    resolveDefeats(game.state, nextId, () => 1);
    expect(game.state.score).toBe(1000); expect(game.state.defeatedCount).toBe(1);
    expect(result(6000, 0, 10).rank).toBe('S');
    expect(result(6000, 1, 10).rank).toBe('A');
    expect(result(6000, 1, 5).rank).toBe('B');
    expect(result(5000, 1, 1).rank).toBe('C');
    const state = stageGame().state; state.player.hp = 10; state.hitsTaken = 1;
    expect(calculateResult(state).noMissBonus).toBe(0); // Healing cannot undo a hit.
  });

  it('pauses stage and boss clocks, and failure cannot become a clear', () => {
    const game = stageGame(); run(game, 4.2);
    const time = game.state.elapsed; const phaseTime = game.state.boss!.phaseElapsed;
    game.setPaused(true); run(game, 3);
    expect(game.state.elapsed).toBe(time); expect(game.state.boss!.phaseElapsed).toBe(phaseTime);
    game.setPaused(false); game.state.player.hp = 0; game.update(step, IDLE_INPUT); run(game, 3);
    expect(game.state.gameOver).toBe(true); expect(game.state.result).toBeNull();
  });

  it.each([0, 0.12, 0.25])('can finish stage one with normal game input, including a %ss start delay', (offset) => {
    const game = new Game(stageOne, 'stage');
    for (let i = 0; i < 60 * 180 && !game.state.gameOver && !game.state.result; i++) {
      const destination = 360 + Math.sin((game.state.elapsed - offset) * 0.65) * 140;
      const x = Math.max(-1, Math.min(1, (destination - game.state.player.position.x) / 8));
      const destinationY = 550 + Math.sin((game.state.elapsed - offset) * 0.65 * 0.7) * 50;
      const y = Math.max(-1, Math.min(1, (destinationY - game.state.player.position.y) / 8));
      game.update(step, { ...IDLE_INPUT, x, y, fire: game.state.elapsed >= offset, slow: true });
    }
    expect(game.state.result, `HP ${game.state.player.hp}, time ${game.state.elapsed}, boss HP ${getHudSnapshot(game.state).boss?.hp}`).not.toBeNull();
  });
});

describe('versioned stage records', () => {
  it('counts attempts without saving failed scores, saves clears once and retains independent bests', () => {
    const { storage } = memory(); const store = new RecordStore(storage);
    store.start('stage-01'); store.start('stage-01');
    expect(store.data.stages['stage-01']).toMatchObject({ plays: 2, cleared: false, bestScore: 0, clears: 0 });
    store.clear(2, { ...result(6000), elapsed: 100 }); store.clear(2, result(9000));
    expect(store.data.stages['stage-01']).toMatchObject({ plays: 2, bestScore: 24000, bestRank: 'S', noMiss: true, clears: 1, fastestTime: 100 });
    store.start('stage-01'); store.clear(3, { ...result(5000, 1, 2), elapsed: 90 });
    expect(readRecords(storage).stages['stage-01']).toMatchObject({ plays: 3, bestScore: 24000, bestRank: 'S', noMiss: true, clears: 2, fastestTime: 90 });
    expect(readRecords(storage).stages['other-stage']).toBeUndefined();
  });

  it('rejects corrupt or future saves and malformed individual records safely', () => {
    const { storage, values } = memory();
    for (const value of ['bad JSON', 'null', '[]', '{"version":2,"stages":{}}']) {
      values.set(SAVE_KEY, value); expect(readRecords(storage)).toEqual({ version: 1, stages: {} });
    }
    values.set(SAVE_KEY, JSON.stringify({ version: 1, stages: { bad: { bestScore: 'oops' }, other: { plays: -1 } } }));
    expect(readRecords(storage).stages).toEqual({});
  });

  it('keeps play and result available in memory when storage reads and writes fail', () => {
    const store = new RecordStore({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } });
    expect(() => store.start('stage-01')).not.toThrow();
    expect(() => store.clear(1, result())).not.toThrow();
    expect(store.available).toBe(false); expect(store.data.stages['stage-01'].cleared).toBe(true);
  });
});
