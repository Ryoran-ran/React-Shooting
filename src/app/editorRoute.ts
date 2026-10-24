import type { Vec2 } from '../game/core/coordinates';
import type { EnemySpawn } from '../game/entities/Enemy';

export const ROUTE_VIEW_MIN = -100;
export const ROUTE_VIEW_MAX = 820;
export const ROUTE_PREVIEW_SECONDS = 3;

export function snapRoutePoint(point: Vec2, gridSize: number): Vec2 {
  if (gridSize <= 0) return point;
  const min = Math.ceil(ROUTE_VIEW_MIN / gridSize) * gridSize;
  const max = Math.floor(ROUTE_VIEW_MAX / gridSize) * gridSize;
  return { x: Math.max(min, Math.min(max, Math.round(point.x / gridSize) * gridSize)),
    y: Math.max(min, Math.min(max, Math.round(point.y / gridSize) * gridSize)) };
}

export type RouteHandle = 'origin' | number;

export function routePoints(spawn: EnemySpawn, seconds: number): Vec2[] {
  const start = spawn.position;
  const motion = spawn.motion;
  if (motion.kind === 'path') return [start, ...motion.points];
  if (motion.kind === 'fixed') return [start, motion.destination];
  if ('vx' in motion) return [start, { x: start.x + motion.vx * seconds, y: start.y + motion.vy * seconds }];
  return [start];
}

/** The preview's arrow tip is the base-motion position after `seconds`, not a separate game target. */
export function moveRouteHandle(spawn: EnemySpawn, handle: RouteHandle, point: Vec2, seconds: number): void {
  if (handle === 'origin') {
    spawn.position = { ...point };
    return;
  }
  const motion = spawn.motion;
  if ('vx' in motion) {
    motion.vx = Math.round((point.x - spawn.position.x) / seconds * 10) / 10;
    motion.vy = Math.round((point.y - spawn.position.y) / seconds * 10) / 10;
  } else if (motion.kind === 'fixed' && handle === 1) {
    motion.destination = { ...point };
  } else if (motion.kind === 'path' && handle > 0 && handle <= motion.points.length) {
    motion.points[handle - 1] = { ...point };
  }
}

function fieldCrossing(start: Vec2, velocity: Vec2): { entry: number; exit: number } | null {
  let entry = -Infinity;
  let exit = Infinity;
  for (const axis of ['x', 'y'] as const) {
    const origin = start[axis];
    const speed = velocity[axis];
    if (speed === 0) {
      if (origin < 0 || origin > 720) return null;
      continue;
    }
    const first = (0 - origin) / speed;
    const last = (720 - origin) / speed;
    entry = Math.max(entry, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
  }
  if (exit < 0 || exit < entry) return null;
  return { entry: Math.max(0, entry), exit };
}

export interface RouteTiming {
  speed: number;
  distance: number | null;
  duration: number | null;
  arrivalAt: number | null;
  fieldEntryAt: number | null;
  fieldExitAt: number | null;
  approximate: boolean;
}

export function routeTiming(spawn: EnemySpawn, seconds: number): RouteTiming {
  const motion = spawn.motion;
  if ('vx' in motion) {
    const speed = Math.hypot(motion.vx, motion.vy);
    const crossing = fieldCrossing(spawn.position, { x: motion.vx, y: motion.vy });
    const retirement = spawn.retireAfter ?? Infinity;
    return {
      speed, distance: speed * seconds, duration: seconds, arrivalAt: spawn.time + seconds,
      fieldEntryAt: crossing && crossing.entry <= retirement ? spawn.time + crossing.entry : null,
      fieldExitAt: crossing && Number.isFinite(crossing.exit) && crossing.exit <= retirement ? spawn.time + crossing.exit : null,
      approximate: motion.kind !== 'linear',
    };
  }
  if (motion.kind === 'chase') return { speed: motion.speed, distance: null, duration: null,
    arrivalAt: null, fieldEntryAt: null, fieldExitAt: null, approximate: false };
  const points = routePoints(spawn, seconds);
  const distance = points.slice(1).reduce((sum, point, index) =>
    sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  const duration = distance / motion.speed;
  return { speed: motion.speed, distance, duration, arrivalAt: spawn.time + duration,
    fieldEntryAt: null, fieldExitAt: null, approximate: false };
}
