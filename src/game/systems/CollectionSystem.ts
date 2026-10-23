import { GAME_CONFIG } from '../config';
import type { GameState } from '../core/GameState';
import type { Vec2 } from '../core/coordinates';
import type { WorldBody } from '../entities/types';
import { sweptCircleTime } from './CollisionSystem';
import { SCORE_CONFIG } from './ScoreSystem';

export function attractItem(item: WorldBody & { age: number }, destination: Vec2, dt: number): void {
  const dx = destination.x - item.position.x, dy = destination.y - item.position.y;
  const length = Math.hypot(dx, dy);
  const distance = Math.min(length, (GAME_CONFIG.collection.speed + item.age * GAME_CONFIG.collection.acceleration) * dt);
  if (length > 0) {
    item.position.x += dx / length * distance;
    item.position.y += dy / length * distance;
  }
  item.velocity = { x: dx / (length || 1) * distance / dt, y: dy / (length || 1) * distance / dt };
}

export function convertPhaseItems(state: GameState, origin: Vec2, nextId: () => string): void {
  const field = state.field;
  const inside = (p: Vec2) => p.x >= field.x && p.x <= field.x + field.width && p.y >= field.y && p.y <= field.y + field.height;
  const add = (position: Vec2, value: number) => state.scoreItems.push({ id: nextId(), position: { ...position },
    previousPosition: { ...position }, velocity: { x: 0, y: -35 }, age: 0, value });
  for (const bullet of state.enemyBullets) if (inside(bullet.position)) add(bullet.position, SCORE_CONFIG.convertedBullet);
  for (const laser of state.lasers) {
    const length = Math.hypot(laser.end.x - laser.origin.x, laser.end.y - laser.origin.y);
    for (let distance = 40; distance < length; distance += 100) {
      const p = { x: laser.origin.x + (laser.end.x - laser.origin.x) * distance / length,
        y: laser.origin.y + (laser.end.y - laser.origin.y) * distance / length };
      if (inside(p)) add(p, SCORE_CONFIG.convertedBullet);
    }
  }
  add(origin, SCORE_CONFIG.phaseBreak);
  for (const item of state.items) item.autoCollect = true;
  if (state.boss) {
    state.boss.collectionTotal = state.scoreItems.length;
    state.boss.collectionValue = state.scoreItems.reduce((sum, item) => sum + item.value, 0);
    state.boss.collected = 0;
  }
  state.effects.push({ id: nextId(), kind: 'phase', position: { ...origin }, age: 0, lifetime: 0.8 });
}

export function updateScoreItems(state: GameState, dt: number, nextId: () => string): void {
  let collected = false;
  state.scoreItems = state.scoreItems.filter((item) => {
    item.previousPosition = { ...item.position };
    item.age += dt;
    if (item.age < GAME_CONFIG.collection.delay) { item.position.y -= 35 * dt; return true; }
    attractItem(item, state.player.position, dt);
    if (sweptCircleTime(item.previousPosition, item.position, GAME_CONFIG.collection.radius,
      state.player.previousPosition, state.player.position, GAME_CONFIG.player.hitRadius) === null) return true;
    state.score += item.value;
    if (state.boss) state.boss.collected++;
    collected = true;
    return false;
  });
  if (collected && !state.effects.some((effect) => effect.kind === 'phase' && effect.age < 0.15)) {
    state.effects.push({ id: nextId(), kind: 'phase', position: { ...state.player.position }, age: 0, lifetime: 0.25 });
  }
}
