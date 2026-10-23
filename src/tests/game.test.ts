import { describe, expect, it } from 'vitest';
import { Game } from '../game/core/Game';
import { FixedStepClock } from '../game/core/GameLoop';
import { createDefaultView, screenToWorld, worldToScreen } from '../game/core/coordinates';
import { GAME_CONFIG } from '../game/config';
import { IDLE_INPUT, type InputFrame } from '../game/systems/InputSystem';
import { selectForwardTarget, steerBullet } from '../game/systems/AttackSystem';
import type { Bullet } from '../game/entities/Bullet';
import type { PracticeTarget } from '../game/entities/PracticeTarget';
import { trainingGround } from '../game/stages/trainingGround';

const step = GAME_CONFIG.loop.step;
const practice = () => new Game(trainingGround, 'practice');
function run(game: Game, seconds: number, input: Partial<InputFrame> = {}) {
  for (let i = 0; i < Math.round(seconds / step); i++) game.update(step, { ...IDLE_INPUT, ...input });
}

function target(id: string, x: number, y: number): PracticeTarget {
  return { id, position: { x, y }, previousPosition: { x, y }, velocity: { x: 0, y: 0 }, origin: { x, y }, amplitude: 0, phase: 0 };
}

function bullet(): Bullet {
  return {
    id: 'test', position: { x: 360, y: 400 }, previousPosition: { x: 360, y: 400 },
    velocity: { x: 0, y: -450 }, mode: 'homing', damage: 1, speed: 450, age: 0, targetId: 't',
  };
}

describe('player movement', () => {
  it('normalizes diagonal movement to the same 300 px/s speed', () => {
    const straight = practice();
    const diagonal = practice();
    run(straight, 0.5, { x: 1 });
    run(diagonal, 0.5, { x: 1, y: -1 });
    expect(straight.state.player.position.x - 360).toBeCloseTo(150);
    expect(Math.hypot(diagonal.state.player.position.x - 360, diagonal.state.player.position.y - 550)).toBeCloseTo(150);
  });

  it('changes speed immediately with Shift without firing', () => {
    const game = practice();
    game.update(step, { ...IDLE_INPUT, x: 1, slow: true });
    expect(game.state.player.position.x).toBeCloseTo(362);
    game.update(step, { ...IDLE_INPUT, x: 1 });
    expect(game.state.player.position.x).toBeCloseTo(367);
    expect(game.state.bullets).toHaveLength(0);
  });

  it('keeps the entire player inside the independently configured field', () => {
    const game = practice();
    game.state.field = { x: 100, y: 200, width: 500, height: 400 };
    run(game, 4, { x: 1, y: 1 });
    expect(game.state.player.position).toEqual({ x: 578, y: 578 });
    run(game, 4, { x: -1, y: -1 });
    expect(game.state.player.position).toEqual({ x: 122, y: 222 });
  });
});

describe('fixed timestep and pause', () => {
  it('produces the same movement and shot count at 30, 60 and 144 FPS', () => {
    const results = [30, 60, 144].map((fps) => {
      const game = practice();
      const clock = new FixedStepClock();
      for (let i = 0; i < fps; i++) clock.advance(1 / fps, (dt) => game.update(dt, { ...IDLE_INPUT, y: -1, fire: true }));
      return { elapsed: game.state.elapsed, y: game.state.player.position.y, shots: game.state.shotsFired };
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0].y).toBeCloseTo(250);
    expect(results[0].shots).toBe(9);
  });

  it('caps catch-up work after a long interruption', () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    clock.advance(120, () => ticks++);
    expect(ticks).toBe(15);
  });

  it('freezes all world simulation and resets cleanly', () => {
    const game = practice();
    run(game, 1, { fire: true, slow: true });
    game.setPaused(true);
    const before = structuredClone(game.state);
    run(game, 1, { x: 1, fire: true });
    expect(game.state).toEqual(before);
    game.reset();
    expect(game.state.elapsed).toBe(0);
    expect(game.state.shotsFired).toBe(0);
    expect(game.state.bullets).toHaveLength(0);
    expect(game.state.player.position).toEqual({ x: 360, y: 550 });
    expect(game.state.paused).toBe(false);
  });
});

describe('shots and homing', () => {
  it('fires straight shots with the configured speed and damage', () => {
    const game = practice();
    run(game, 0.5, { fire: true });
    expect(game.state.shotsFired).toBe(5);
    for (const shot of game.state.bullets) {
      expect(shot.position.x).toBe(360);
      expect(shot.velocity).toEqual({ x: 0, y: -600 });
      expect(shot.damage).toBe(2);
      expect(shot.targetId).toBeNull();
    }
  });

  it('prioritizes forward alignment over a nearer target at the side or behind', () => {
    const targets = [target('side', 395, 500), target('behind', 360, 600), target('front', 365, 100)];
    expect(selectForwardTarget({ x: 360, y: 500 }, targets)?.id).toBe('front');
  });

  it('prefers the closer target when their forward angles match', () => {
    expect(selectForwardTarget({ x: 0, y: 500 }, [target('far', 0, 0), target('near', 0, 200)])?.id).toBe('near');
  });

  it('limits homing turns to 180 degrees per second while preserving speed', () => {
    const shot = bullet();
    steerBullet(shot, [target('t', 600, 400)], 0.1);
    expect(Math.atan2(shot.velocity.y, shot.velocity.x)).toBeCloseTo(-Math.PI / 2 + Math.PI * 0.1);
    expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(450);
    const original = shot.velocity.x;
    steerBullet(shot, [target('t', 100, 300)], 0.1);
    expect(shot.velocity.x).toBeLessThan(original);
  });

  it('continues on the final heading when a target disappears, without retargeting', () => {
    const shot = bullet();
    steerBullet(shot, [target('t', 550, 100)], 0.2);
    const velocity = { ...shot.velocity };
    steerBullet(shot, [target('other', 100, 100)], 0.5);
    expect(shot.targetId).toBeNull();
    expect(shot.velocity).toEqual(velocity);
  });

  it('fires forward with no targets, and existing shots retain their mode when Shift changes', () => {
    const game = practice();
    game.setTargetsEnabled(false);
    game.update(step, { ...IDLE_INPUT, fire: true, slow: true });
    const shot = game.state.bullets[0];
    expect(shot.mode).toBe('homing');
    expect(shot.damage).toBe(1);
    expect(shot.targetId).toBeNull();
    expect(shot.velocity).toEqual({ x: 0, y: -450 });
    run(game, 0.5, { fire: true });
    expect(shot.mode).toBe('homing');
    expect(game.state.bullets.some((entry) => entry.mode === 'straight')).toBe(true);
  });

  it('keeps bullets bounded during sustained homing fire and handles target removal', () => {
    const game = practice();
    run(game, 2, { fire: true, slow: true });
    game.setTargetsEnabled(false);
    run(game, 20, { fire: true, slow: true });
    expect(game.state.bullets.length).toBeLessThanOrEqual(21);
    expect(game.state.bullets.every((shot) => Number.isFinite(shot.position.x) && Number.isFinite(shot.position.y))).toBe(true);
  });
});

describe('coordinate separation', () => {
  it('round-trips a translated, scaled and rotated view without modifying world data', () => {
    const game = practice();
    const original = structuredClone(game.state.player.position);
    const field = { ...game.state.field };
    const view = { offset: { x: 120, y: -30 }, scale: { x: 0.7, y: 1.3 }, rotation: Math.PI / 2 };
    const screen = worldToScreen(game.state.player.position, view);
    const point = screenToWorld(screen, view);
    expect(point.x).toBeCloseTo(original.x);
    expect(point.y).toBeCloseTo(original.y);
    expect(game.state.player.position).toEqual(original);
    expect(game.state.field).toEqual(field);
    expect(worldToScreen(original, createDefaultView())).toEqual(original);
  });
});
