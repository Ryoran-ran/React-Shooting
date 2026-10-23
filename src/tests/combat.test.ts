import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../data/enemies';
import { GAME_CONFIG } from '../game/config';
import { Game } from '../game/core/Game';
import { FixedStepClock } from '../game/core/GameLoop';
import type { GameState } from '../game/core/GameState';
import type { EnemyKind, EnemyMotion } from '../game/entities/Enemy';
import { trainingGround, type TrainingDefinition } from '../game/stages/trainingGround';
import { getAimTargets } from '../game/systems/AttackSystem';
import { resolvePlayerDamage, resolvePlayerShots, sweptCircleTime } from '../game/systems/CollisionSystem';
import { resolveDefeats, updateItems } from '../game/systems/DropSystem';
import { updateEnemyAttacks, updateHostileProjectiles } from '../game/systems/EnemyAttackSystem';
import { moveEnemies } from '../game/systems/EnemyMovementSystem';
import { addHealing, damagePlayer, updateHealth } from '../game/systems/HealthSystem';
import { IDLE_INPUT } from '../game/systems/InputSystem';
import { createEnemy } from '../game/systems/SpawnSystem';
import { getHudSnapshot } from '../game/core/GameState';
import { getPlayerPose } from '../game/rendering/playerPose';

const step = GAME_CONFIG.loop.step;
let id = 0;
const nextId = () => `test-${++id}`;
function run(game: Game, seconds: number) {
  for (let i = 0; i < Math.round(seconds / step); i++) game.update(step, IDLE_INPUT);
}
function emptyGame() {
  const definition: TrainingDefinition = { ...trainingGround, combat: { ...trainingGround.combat, spawns: [] } };
  return new Game(definition);
}
function enemy(kind: EnemyKind = 'small', x = 360, y = 200, motion: EnemyMotion = { kind: 'linear', vx: 0, vy: 0 }) {
  const value = createEnemy({ time: 0, kind, position: { x, y }, motion }, nextId());
  value.entered = true;
  return value;
}
function shot(state: GameState, x = 360, y = 200, damage = 2) {
  state.bullets.push({
    id: nextId(), position: { x, y }, previousPosition: { x, y: y + 10 },
    velocity: { x: 0, y: -600 }, mode: 'straight', damage, age: 0, speed: 600, targetId: null,
  });
}
function hostile(state: GameState, x = state.player.position.x, y = state.player.position.y) {
  state.enemyBullets.push({ id: nextId(), position: { x, y }, previousPosition: { x, y }, velocity: { x: 0, y: 0 }, age: 0, hitRadius: 4, damage: 1 });
}

describe('enemy schedule and lifecycle', () => {
  it('reproduces fixed spawn times, positions and types after a retry', () => {
    const game = new Game();
    run(game, 1.1);
    expect(game.state.enemies).toHaveLength(0);
    run(game, 1.1);
    const before = game.state.enemies.map((e) => ({ kind: e.kind, position: { ...e.position }, age: e.age }));
    expect(before).toHaveLength(5);
    game.reset(); run(game, 2.2);
    expect(game.state.enemies.map((e) => ({ kind: e.kind, position: e.position, age: e.age }))).toEqual(before);
  });

  it('keeps movement, spawn counts and enemy firing identical at 30, 60 and 144 FPS', () => {
    const states = [30, 60, 144].map((fps) => {
      const game = new Game();
      const clock = new FixedStepClock();
      for (let i = 0; i < fps * 8; i++) clock.advance(1 / fps, (dt) => game.update(dt, IDLE_INPUT));
      return game.state;
    });
    expect(states[0]).toEqual(states[1]);
    expect(states[1]).toEqual(states[2]);
    expect(states[0].enemies.length).toBeGreaterThan(0);
    expect(states[0].enemyBullets.length).toBeGreaterThan(0);
  });

  it('retires enemies outside the field without defeat counts, effects or drops', () => {
    const state = emptyGame().state;
    const retreating = enemy('large', 360, 809, { kind: 'linear', vx: 0, vy: 120 });
    state.enemies.push(retreating);
    moveEnemies(state.enemies, state.player.position, state.field, step);
    const random = () => { throw new Error('Retreat must not roll drops'); };
    resolveDefeats(state, nextId, random);
    expect(state.enemies).toHaveLength(0);
    expect(state.items).toHaveLength(0);
    expect(state.defeatedCount).toBe(0);
    expect(state.effects).toHaveLength(0);
  });

  it('supports wave, zigzag, chase, fixed and path motion', () => {
    const state = emptyGame().state;
    const wave = enemy('small', 100, 0, { kind: 'wave', vx: 0, vy: 20, amplitude: 30, frequency: 1 });
    const zigzag = enemy('small', 200, 0, { kind: 'zigzag', vx: 0, vy: 20, amplitude: 40, period: 4 });
    const chase = enemy('rusher', 0, 550, { kind: 'chase', speed: 100 });
    const fixed = enemy('turret', 300, 0, { kind: 'fixed', destination: { x: 300, y: 20 }, speed: 100 });
    const path = enemy('rusher', 100, 100, { kind: 'path', points: [{ x: 110, y: 100 }, { x: 120, y: 100 }], speed: 100, exitAtEnd: true });
    state.enemies.push(wave, zigzag, chase, fixed, path);
    moveEnemies(state.enemies, state.player.position, state.field, 1);
    expect(wave.position).toEqual({ x: 100 + Math.sin(1) * 30, y: 20 });
    expect(zigzag.position).toEqual({ x: 240, y: 20 });
    expect(chase.position).toEqual({ x: 100, y: 550 });
    expect(fixed.position).toEqual({ x: 300, y: 20 });
    moveEnemies(state.enemies, state.player.position, state.field, 1);
    expect(fixed.position).toEqual({ x: 300, y: 20 });
    expect(path.retreat).not.toBeNull();
    expect(path.retired).toBe(false);
  });

  it('eases timed enemies out of the field instead of removing them in place, without awarding a kill', () => {
    const state = emptyGame().state;
    const departing = enemy('turret', 125, 145);
    departing.retireAfter = 1;
    departing.age = 1 - step;
    departing.attackCooldowns = [0];
    state.enemies.push(departing);
    moveEnemies(state.enemies, state.player.position, state.field, step);
    expect(departing.retreat).not.toBeNull();
    expect(departing.retired).toBe(false);
    expect(departing.position.x).toBeLessThan(125);
    expect(departing.position.x).toBeGreaterThan(124);
    updateEnemyAttacks(state, step, nextId);
    expect(state.lasers).toHaveLength(0);
    expect(getAimTargets(state)).toContain(departing);
    const random = () => { throw new Error('A retreat is not a defeat'); };
    resolveDefeats(state, nextId, random);
    expect(state.enemies).toHaveLength(1);
    for (let i = 0; i < 180; i++) {
      moveEnemies(state.enemies, state.player.position, state.field, step);
      resolveDefeats(state, nextId, random);
    }
    expect(state.enemies).toHaveLength(0);
    expect(state.defeatedCount).toBe(0);
    expect(state.items).toHaveLength(0);
  });

  it('allows a retreating enemy to be defeated normally, while its existing shots remain', () => {
    const state = emptyGame().state;
    const departing = enemy('medium', 360, 200);
    departing.retireAfter = 0;
    state.enemies.push(departing);
    hostile(state, 100, 100);
    moveEnemies(state.enemies, state.player.position, state.field, step);
    shot(state, 360, 200, departing.maxHp);
    resolvePlayerShots(state);
    resolveDefeats(state, nextId, () => 0);
    expect(state.defeatedCount).toBe(1);
    expect(state.items).toHaveLength(1);
    expect(state.enemyBullets).toHaveLength(1);
  });

  it('runs repeated waves without unbounded enemies, projectiles or items', () => {
    const game = new Game();
    for (let i = 0; i < 60 * 180; i++) {
      game.state.player.invulnerableFor = 1;
      game.update(step, { ...IDLE_INPUT, fire: true, slow: true });
      expect(game.state.enemies.length).toBeLessThan(30);
      expect(game.state.enemyBullets.length).toBeLessThan(150);
      expect(game.state.items.length).toBeLessThan(30);
    }
    expect(game.state.spawnCycle).toBeGreaterThanOrEqual(4);
    expect(game.state.defeatedCount).toBeGreaterThan(0);
  });
});

describe('enemy attacks and collision', () => {
  it('explodes a squid on contact exactly once, applies one damage, and grants no defeat or drop', () => {
    const game = emptyGame();
    const squid = enemy('rusher', 360, 550);
    game.state.enemies.push(squid);
    game.update(step, IDLE_INPUT);
    expect(game.state.player.hp).toBe(9);
    expect(game.state.hitsTaken).toBe(1);
    expect(game.state.enemies).toHaveLength(0);
    expect(getAimTargets(game.state)).toHaveLength(0);
    expect(game.state.effects.filter((effect) => effect.kind === 'explosion')).toHaveLength(1);
    expect(game.state.defeatedCount).toBe(0);
    expect(game.state.items).toHaveLength(0);
    game.update(step, IDLE_INPUT);
    expect(game.state.hitsTaken).toBe(1);
    expect(game.state.effects.filter((effect) => effect.kind === 'explosion')).toHaveLength(1);
  });

  it('consumes contact squids during invulnerability, while other enemies survive contact', () => {
    const state = emptyGame().state;
    state.player.invulnerableFor = 1;
    const jelly = enemy('small', 360, 550);
    state.enemies.push(enemy('rusher', 360, 550), enemy('rusher', 360, 550), jelly);
    resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(10);
    expect(state.hitsTaken).toBe(0);
    expect(state.enemies).toEqual([jelly]);
    expect(state.effects.filter((effect) => effect.kind === 'explosion')).toHaveLength(2);
  });

  it('only explodes on actual hitbox contact and retains the normal shot-defeat drop', () => {
    const state = emptyGame().state;
    const squid = enemy('rusher', 380, 550);
    state.enemies.push(squid);
    resolvePlayerDamage(state, nextId);
    expect(state.enemies).toHaveLength(1);
    expect(state.player.hp).toBe(10);
    expect(state.effects).toHaveLength(0);
    shot(state, 380, 550, squid.maxHp);
    resolvePlayerShots(state);
    resolveDefeats(state, nextId, () => 0);
    expect(state.defeatedCount).toBe(1);
    expect(state.items).toHaveLength(1);
    expect(state.effects.some((effect) => effect.kind === 'explosion')).toBe(false);
  });

  it('aims at the player at firing time; fired bullets do not track or depend on their owner', () => {
    const state = emptyGame().state;
    const shooter = enemy('medium', 100, 100);
    shooter.attackCooldowns = [0]; state.enemies.push(shooter);
    updateEnemyAttacks(state, step, nextId);
    expect(state.enemyBullets).toHaveLength(3);
    const middle = state.enemyBullets[1];
    const angle = Math.atan2(450, 260);
    expect(middle.velocity.x).toBeCloseTo(Math.cos(angle) * 155);
    expect(middle.velocity.y).toBeCloseTo(Math.sin(angle) * 155);
    const velocity = { ...middle.velocity };
    shooter.hp = 0;
    resolveDefeats(state, nextId, () => 1);
    state.player.position.x = 600;
    updateHostileProjectiles(state, step);
    expect(state.enemyBullets).toHaveLength(3);
    expect(middle.velocity).toEqual(velocity);
  });

  it('does not damage during a laser warning, then activates and expires', () => {
    const state = emptyGame().state;
    state.lasers.push({ id: nextId(), origin: { x: 360, y: 0 }, end: { x: 360, y: 900 }, age: 0.9, warning: 1, duration: 0.5, width: 10, damage: 1 });
    resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(10);
    updateHostileProjectiles(state, 0.1);
    resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(9);
    resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(9);
    updateHostileProjectiles(state, 0.5);
    expect(state.lasers).toHaveLength(0);
  });

  it('locks the laser direction at warning time and clears warnings when attacks are disabled', () => {
    const game = emptyGame();
    const shooter = enemy('turret'); shooter.attackCooldowns = [0]; game.state.enemies.push(shooter);
    updateEnemyAttacks(game.state, step, nextId);
    expect(game.state.lasers).toHaveLength(1);
    const end = { ...game.state.lasers[0].end };
    game.state.player.position.x += 100;
    updateHostileProjectiles(game.state, 0.3);
    expect(game.state.lasers[0].end).toEqual(end);
    game.setEnemyAttacksEnabled(false);
    expect(game.state.lasers).toHaveLength(0);
    expect(game.state.enemyBullets).toHaveLength(0);
    run(game, 4);
    expect(game.state.lasers).toHaveLength(0);
  });

  it('handles fast bullets and hits the nearest enemy once, irrespective of array order', () => {
    const state = emptyGame().state;
    const far = enemy('small', 360, 140);
    const near = enemy('small', 360, 200);
    state.enemies.push(far, near);
    shot(state, 360, 100);
    state.bullets[0].previousPosition.y = 250;
    resolvePlayerShots(state);
    expect(near.hp).toBe(2);
    expect(far.hp).toBe(4);
    expect(state.bullets).toHaveLength(0);
    expect(sweptCircleTime({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, { x: 50, y: 0 }, { x: 50, y: 0 }, 1)).toBeCloseTo(0.48);
  });

  it('removes defeated targets from homing candidates and resolves kills only once', () => {
    const state = emptyGame().state;
    const victim = enemy(); state.enemies.push(victim);
    expect(getAimTargets(state)).toContain(victim);
    shot(state, 360, 200, 4);
    resolvePlayerShots(state);
    expect(getAimTargets(state)).toHaveLength(0);
    resolveDefeats(state, nextId, () => 0);
    resolveDefeats(state, nextId, () => 0);
    expect(state.defeatedCount).toBe(1);
    expect(state.items).toHaveLength(1);
  });

  it('uses the small hitbox rather than the dolphin graphic and applies only one damage per invulnerability period', () => {
    const state = emptyGame().state;
    hostile(state, 378, 550); resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(10);
    hostile(state); hostile(state); state.enemies.push(enemy('small', 360, 550));
    resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(9);
    expect(state.hitsTaken).toBe(1);
    updateHealth(state, 1.4); resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(9);
    updateHealth(state, 0.1); resolvePlayerDamage(state, nextId);
    expect(state.player.hp).toBe(8);
  });
});

describe('drops, healing, terminal state and reset', () => {
  it('honors drop rates and gives two items for a large enemy', () => {
    for (const [kind, definition] of Object.entries(ENEMY_DEFINITIONS)) {
      const state = emptyGame().state;
      const victim = enemy(kind as EnemyKind); victim.hp = 0; state.enemies.push(victim);
      resolveDefeats(state, nextId, () => definition.dropRate - 0.001);
      expect(state.items).toHaveLength(definition.dropCount);
      if (definition.dropRate < 1) {
        const missed = enemy(kind as EnemyKind); missed.hp = 0; state.enemies.push(missed);
        resolveDefeats(state, nextId, () => definition.dropRate);
        expect(state.items).toHaveLength(definition.dropCount);
      }
    }
  });

  it('heals at 100, carries the remainder and does not accumulate at maximum HP', () => {
    const state = emptyGame().state;
    state.player.hp = 8; state.player.heal = 90;
    addHealing(state, 20, nextId);
    expect(state.player.hp).toBe(9);
    expect(state.player.heal).toBe(10);
    addHealing(state, 100, nextId);
    expect(state.player.hp).toBe(10);
    expect(state.player.heal).toBe(10);
    addHealing(state, 20, nextId);
    expect(state.player.hp).toBe(10);
    expect(state.player.heal).toBe(10);
  });

  it('collects items by contact; five small items restore one HP', () => {
    const state = emptyGame().state; state.player.hp = 9;
    for (let i = 0; i < 5; i++) {
      const position = { ...state.player.position };
      state.items.push({ id: nextId(), position, previousPosition: { ...position }, velocity: { x: 0, y: 45 }, age: 0 });
    }
    updateItems(state, step, nextId);
    expect(state.items).toHaveLength(0);
    expect(state.itemsCollected).toBe(5);
    expect(state.player.hp).toBe(10);
    expect(state.player.heal).toBe(0);
  });

  it('stops at HP zero, prevents post-mortem healing and restores all combat state on retry', () => {
    const game = emptyGame(); game.state.player.hp = 1; game.state.player.heal = 80;
    hostile(game.state);
    game.update(step, IDLE_INPUT);
    expect(game.state.gameOver).toBe(true);
    expect(game.state.player.hp).toBe(0);
    expect(game.state.enemyBullets).toHaveLength(0);
    addHealing(game.state, 200, nextId);
    const stoppedTime = game.state.elapsed;
    const worldPosition = { ...game.state.player.position };
    expect(getHudSnapshot(game.state).gameOverReady).toBe(false);
    run(game, GAME_CONFIG.defeat.duration / 2);
    expect(game.state.elapsed).toBe(stoppedTime);
    expect(game.state.player.position).toEqual(worldPosition);
    expect(getPlayerPose(game.state, 1).position.y).toBeGreaterThan(worldPosition.y);
    expect(getHudSnapshot(game.state).gameOverReady).toBe(false);
    run(game, GAME_CONFIG.defeat.duration);
    expect(getHudSnapshot(game.state).gameOverReady).toBe(true);
    expect(getPlayerPose(game.state, 1).opacity).toBe(0);
    expect(getPlayerPose(game.state, 1).position.y).toBeGreaterThan(game.state.field.y + game.state.field.height);
    const before = structuredClone(game.state);
    run(game, 2);
    expect(game.state).toEqual(before);
    game.reset();
    expect(game.state.player.hp).toBe(10);
    expect(game.state.player.heal).toBe(0);
    expect(game.state.gameOver).toBe(false);
    expect(game.state.gameOverElapsed).toBe(0);
    expect(game.state.defeatedCount).toBe(0);
    expect(game.state.elapsed).toBe(0);
    expect(game.state.items).toHaveLength(0);
    expect(game.state.lasers).toHaveLength(0);
  });

  it('keeps the fall presentation independent of FPS and resets an interrupted fall', () => {
    const results = [30, 60, 144].map((fps) => {
      const game = emptyGame(); game.state.player.hp = 1;
      hostile(game.state); game.update(step, IDLE_INPUT);
      const clock = new FixedStepClock();
      for (let i = 0; i < fps / 2; i++) clock.advance(1 / fps, (dt) => game.update(dt, { ...IDLE_INPUT, x: 1, fire: true }));
      const pose = getPlayerPose(game.state, 1);
      expect(game.state.player.position).toEqual({ x: 360, y: 550 });
      expect(game.state.shotsFired).toBe(0);
      game.reset();
      expect(getPlayerPose(game.state, 1).position).toEqual({ x: 360, y: 550 });
      expect(getPlayerPose(game.state, 1).opacity).toBe(1);
      expect(getHudSnapshot(game.state).gameOverReady).toBe(false);
      return pose;
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });

  it('freezes enemies, bullets, lasers, items and invulnerability timers while paused', () => {
    const game = new Game(); run(game, 15);
    damagePlayer(game.state, 1, nextId);
    game.setPaused(true);
    const before = structuredClone(game.state);
    run(game, 3);
    expect(game.state).toEqual(before);
  });

  it('preserves the Phase 1 practice mode without enemy spawning or collision', () => {
    const game = new Game(); run(game, 3);
    game.setMode('practice'); run(game, 30);
    expect(game.state.enemies).toHaveLength(0);
    expect(game.state.enemyBullets).toHaveLength(0);
    expect(game.state.targets).toHaveLength(3);
    expect(game.state.player.hp).toBe(10);
    game.setMode('combat');
    expect(game.state.targets).toHaveLength(0);
    expect(game.state.elapsed).toBe(0);
  });
});
