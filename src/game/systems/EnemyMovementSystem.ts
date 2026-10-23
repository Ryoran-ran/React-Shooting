import { GAME_CONFIG } from '../config';
import type { FieldBounds, Vec2 } from '../core/coordinates';
import type { Enemy } from '../entities/Enemy';

function approach(position: Vec2, destination: Vec2, distance: number): boolean {
  const dx = destination.x - position.x;
  const dy = destination.y - position.y;
  const length = Math.hypot(dx, dy);
  if (length <= distance) { position.x = destination.x; position.y = destination.y; return true; }
  position.x += dx / length * distance;
  position.y += dy / length * distance;
  return false;
}

function beginRetreat(enemy: Enemy, field: FieldBounds): void {
  const p = enemy.position;
  const padding = GAME_CONFIG.combat.cullMargin + 1;
  const exits = [
    { distance: p.y - field.y, destination: { x: p.x, y: field.y - padding } },
    { distance: p.x - field.x, destination: { x: field.x - padding, y: p.y } },
    { distance: field.x + field.width - p.x, destination: { x: field.x + field.width + padding, y: p.y } },
  ];
  const exit = exits.reduce((nearest, candidate) => candidate.distance < nearest.distance ? candidate : nearest);
  enemy.retreat = { destination: exit.destination };
}

function moveRetreat(enemy: Enemy, dt: number): void {
  const destination = enemy.retreat!.destination;
  const dx = destination.x - enemy.position.x;
  const dy = destination.y - enemy.position.y;
  const length = Math.hypot(dx, dy);
  const vx = length > 0 ? dx / length * GAME_CONFIG.retreat.speed : 0;
  const vy = length > 0 ? dy / length * GAME_CONFIG.retreat.speed : 0;
  const changeX = vx - enemy.velocity.x;
  const changeY = vy - enemy.velocity.y;
  const changeLength = Math.hypot(changeX, changeY);
  const blend = changeLength === 0 ? 1 : Math.min(1, GAME_CONFIG.retreat.acceleration * dt / changeLength);
  enemy.velocity.x += changeX * blend;
  enemy.velocity.y += changeY * blend;
  enemy.position.x += enemy.velocity.x * dt;
  enemy.position.y += enemy.velocity.y * dt;
}

export function moveEnemies(enemies: Enemy[], player: Vec2, field: FieldBounds, dt: number): void {
  for (const enemy of enemies) {
    enemy.previousPosition = { ...enemy.position };
    enemy.age += dt;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (!enemy.retreat && enemy.retireAfter !== undefined && enemy.age + 1e-9 >= enemy.retireAfter) beginRetreat(enemy, field);
    const motion = enemy.motion;
    if (enemy.retreat) moveRetreat(enemy, dt);
    else switch (motion.kind) {
      case 'linear':
        enemy.position.x += motion.vx * dt;
        enemy.position.y += motion.vy * dt;
        break;
      case 'wave':
        enemy.position.x = enemy.origin.x + motion.vx * enemy.age + Math.sin(enemy.age * motion.frequency) * motion.amplitude;
        enemy.position.y = enemy.origin.y + motion.vy * enemy.age;
        break;
      case 'zigzag': {
        const phase = (enemy.age / motion.period) % 1;
        const triangle = phase < 0.25 ? phase * 4 : phase < 0.75 ? 2 - phase * 4 : phase * 4 - 4;
        enemy.position.x = enemy.origin.x + motion.vx * enemy.age + triangle * motion.amplitude;
        enemy.position.y = enemy.origin.y + motion.vy * enemy.age;
        break;
      }
      case 'chase': approach(enemy.position, player, motion.speed * dt); break;
      case 'fixed': approach(enemy.position, motion.destination, motion.speed * dt); break;
      case 'path': {
        const point = motion.points[enemy.pathIndex];
        if (point && approach(enemy.position, point, motion.speed * dt)) enemy.pathIndex++;
        if (motion.exitAtEnd && enemy.pathIndex >= motion.points.length) beginRetreat(enemy, field);
        break;
      }
    }
    enemy.velocity = { x: (enemy.position.x - enemy.previousPosition.x) / dt, y: (enemy.position.y - enemy.previousPosition.y) / dt };
    const p = enemy.position;
    if (p.x >= field.x && p.x <= field.x + field.width && p.y >= field.y && p.y <= field.y + field.height) enemy.entered = true;
    const margin = GAME_CONFIG.combat.cullMargin;
    const outside = p.x < field.x - margin || p.x > field.x + field.width + margin || p.y < field.y - margin || p.y > field.y + field.height + margin;
    // Removal happens only after the whole creature is beyond the field, never on a timer.
    if ((enemy.entered || enemy.retreat) && outside) enemy.retired = true;
  }
}
