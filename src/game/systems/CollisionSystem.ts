import { GAME_CONFIG } from '../config';
import type { Vec2 } from '../core/coordinates';
import type { GameState } from '../core/GameState';
import { damagePlayer } from './HealthSystem';
import type { Enemy } from '../entities/Enemy';
import { ENEMY_DEFINITIONS } from '../../data/enemies';

export function pointSegmentDistanceSquared(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return (point.x - start.x - t * dx) ** 2 + (point.y - start.y - t * dy) ** 2;
}

/** Earliest contact time for two swept circles, in world coordinates. */
export function sweptCircleTime(a0: Vec2, a1: Vec2, ar: number, b0: Vec2, b1: Vec2, br: number): number | null {
  const x = a0.x - b0.x;
  const y = a0.y - b0.y;
  const vx = a1.x - a0.x - (b1.x - b0.x);
  const vy = a1.y - a0.y - (b1.y - b0.y);
  const c = x * x + y * y - (ar + br) ** 2;
  if (c <= 0) return 0;
  const a = vx * vx + vy * vy;
  if (a < 1e-12) return null;
  const b = 2 * (x * vx + y * vy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function resolvePlayerShots(state: GameState): void {
  state.bullets = state.bullets.filter((shot) => {
    let nearest: Enemy | undefined;
    let nearestTime = Infinity;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.retired) continue;
      const time = sweptCircleTime(shot.previousPosition, shot.position, GAME_CONFIG.shot.radius,
        enemy.previousPosition, enemy.position, enemy.hitRadius);
      if (time !== null && time < nearestTime) { nearest = enemy; nearestTime = time; }
    }
    if (!nearest) return true;
    if (nearest.invulnerable) return false;
    state.effects.push({ id: `${shot.id}-impact`, kind: 'shot', variant: shot.mode,
      position: { x: shot.previousPosition.x + (shot.position.x - shot.previousPosition.x) * nearestTime,
        y: shot.previousPosition.y + (shot.position.y - shot.previousPosition.y) * nearestTime },
      age: 0, lifetime: GAME_CONFIG.effects.shotLifetime });
    nearest.hp = Math.max(0, nearest.hp - shot.damage);
    nearest.hitFlash = GAME_CONFIG.combat.enemyHitFlash;
    return false;
  });
}

export function resolvePlayerDamage(state: GameState, nextId: () => string): void {
  const player = state.player;
  const radius = GAME_CONFIG.player.hitRadius;
  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    const contact = sweptCircleTime(player.previousPosition, player.position, radius,
      bullet.previousPosition, bullet.position, bullet.hitRadius);
    if (contact === null) return true;
    damagePlayer(state, bullet.damage, nextId);
    return false; // A bullet touching the hitbox is consumed even during invulnerability.
  });
  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.retired || enemy.hp <= 0) return true;
    const contact = sweptCircleTime(player.previousPosition, player.position, radius, enemy.previousPosition, enemy.position, enemy.hitRadius);
    if (contact !== null) {
      damagePlayer(state, GAME_CONFIG.combat.contactDamage, nextId);
      const definition = ENEMY_DEFINITIONS[enemy.kind];
      if (definition.explodeOnContact) {
        state.effects.push({
          id: nextId(), kind: 'explosion', age: 0, lifetime: GAME_CONFIG.effects.explosionLifetime,
          position: {
            x: enemy.previousPosition.x + (enemy.position.x - enemy.previousPosition.x) * contact,
            y: enemy.previousPosition.y + (enemy.position.y - enemy.previousPosition.y) * contact,
          },
        });
        state.eventMessage = `${definition.name}が接触して爆発！`;
        state.eventUntil = state.elapsed + 2;
        // Contact consumes the squid even during invulnerability. Self-destruction
        // does not enter the shot-defeat path, so it grants no kill or item drop.
        return false;
      }
    }
    return true;
  });
  for (const laser of state.lasers) {
    if (laser.age + 1e-9 < laser.warning || laser.age >= laser.warning + laser.duration) continue;
    // Both endpoints plus segment intersection cover a fast player crossing a thin beam.
    const sweep = sweptCircleTime(player.previousPosition, player.position, radius + laser.width / 2,
      laser.origin, laser.origin, 0);
    const r2 = (radius + laser.width / 2) ** 2;
    const crossing = segmentsCross(player.previousPosition, player.position, laser.origin, laser.end);
    if (sweep !== null || crossing || pointSegmentDistanceSquared(player.position, laser.origin, laser.end) <= r2
      || pointSegmentDistanceSquared(player.previousPosition, laser.origin, laser.end) <= r2
      || pointSegmentDistanceSquared(laser.end, player.previousPosition, player.position) <= r2) {
      damagePlayer(state, laser.damage, nextId);
    }
  }
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ex = d.x - c.x;
  const ey = d.y - c.y;
  const determinant = dx * ey - dy * ex;
  if (Math.abs(determinant) < 1e-10) return false;
  const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / determinant;
  const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / determinant;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
