import { GAME_CONFIG } from '../config';
import type { Vec2, FieldBounds } from '../core/coordinates';
import type { Bullet } from '../entities/Bullet';
import type { AimTarget } from '../entities/types';
import type { GameState } from '../core/GameState';
import type { InputFrame } from './InputSystem';

export function selectForwardTarget<T extends AimTarget>(origin: Vec2, targets: T[]): T | undefined {
  // Compare angle to straight ahead first; use distance to break angular ties.
  return targets.reduce<T | undefined>((best, target) => {
    if (!best) return target;
    const angle = (point: Vec2) => Math.abs(Math.atan2(point.x - origin.x, origin.y - point.y));
    const delta = angle(target.position) - angle(best.position);
    if (Math.abs(delta) > 0.000001) return delta < 0 ? target : best;
    return Math.hypot(target.position.x - origin.x, target.position.y - origin.y)
      < Math.hypot(best.position.x - origin.x, best.position.y - origin.y) ? target : best;
  }, undefined);
}

export function getAimTargets(state: GameState): AimTarget[] {
  return state.mode === 'practice' ? state.targets : state.enemies.filter((enemy) => enemy.hp > 0 && enemy.entered && !enemy.retired);
}

export function updateAttack(state: GameState, input: InputFrame, dt: number, nextId: () => string): void {
  const player = state.player;
  player.firing = input.fire;
  player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
  player.fireCooldown -= dt;
  if (!input.fire) { player.fireCooldown = Math.max(0, player.fireCooldown); return; }

  const mode = input.slow ? 'homing' : 'straight';
  const config = GAME_CONFIG.shot[mode];
  while (player.fireCooldown <= 0) {
    const position = { x: player.position.x, y: player.position.y - GAME_CONFIG.shot.muzzleOffset };
    const target = mode === 'homing' ? selectForwardTarget(player.position, getAimTargets(state)) : undefined;
    state.bullets.push({
      id: nextId(), position, previousPosition: { ...position }, velocity: { x: 0, y: -config.speed },
      mode, speed: config.speed, damage: config.damage, age: 0, targetId: target?.id ?? null,
    });
    state.shotsFired += 1;
    player.muzzleFlash = 0.075;
    player.fireCooldown += config.interval;
  }
}

export function steerBullet(bullet: Bullet, targets: AimTarget[], dt: number): void {
  if (bullet.mode !== 'homing' || !bullet.targetId) return;
  const target = targets.find((candidate) => candidate.id === bullet.targetId);
  if (!target) { bullet.targetId = null; return; } // Continue on the last heading; never retarget.
  const dx = target.position.x - bullet.position.x;
  const dy = target.position.y - bullet.position.y;
  if (Math.hypot(dx, dy) < 0.001) return;
  const current = Math.atan2(bullet.velocity.y, bullet.velocity.x);
  const desired = Math.atan2(dy, dx);
  const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
  const maxTurn = GAME_CONFIG.shot.homing.turnRate * dt;
  const angle = current + Math.max(-maxTurn, Math.min(maxTurn, delta));
  bullet.velocity = { x: Math.cos(angle) * bullet.speed, y: Math.sin(angle) * bullet.speed };
}

export function updateBullets(bullets: Bullet[], targets: AimTarget[], field: FieldBounds, dt: number): Bullet[] {
  const margin = GAME_CONFIG.shot.cullMargin;
  return bullets.filter((bullet) => {
    bullet.previousPosition = { ...bullet.position };
    steerBullet(bullet, targets, dt);
    bullet.position.x += bullet.velocity.x * dt;
    bullet.position.y += bullet.velocity.y * dt;
    bullet.age += dt;
    return bullet.age < GAME_CONFIG.shot.lifetime
      && bullet.position.x >= field.x - margin && bullet.position.x <= field.x + field.width + margin
      && bullet.position.y >= field.y - margin && bullet.position.y <= field.y + field.height + margin;
  });
}
