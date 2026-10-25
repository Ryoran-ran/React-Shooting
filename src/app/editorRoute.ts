import type { Vec2 } from '../game/core/coordinates';
import type { EnemySpawn } from '../game/entities/Enemy';

export const ROUTE_VIEW_MIN = -100;
export const ROUTE_VIEW_MAX = 820;
export const ROUTE_PREVIEW_SECONDS = 3;

export interface RouteGoal { position: Vec2; at: number }
export type EditableRouteSpawn = EnemySpawn & { routeGoal?: RouteGoal };
const round = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function snapRoutePoint(point: Vec2, gridSize: number): Vec2 {
  if (gridSize <= 0) return point;
  const min = Math.ceil(ROUTE_VIEW_MIN / gridSize) * gridSize;
  const max = Math.floor(ROUTE_VIEW_MAX / gridSize) * gridSize;
  return { x: Math.max(min, Math.min(max, Math.round(point.x / gridSize) * gridSize)),
    y: Math.max(min, Math.min(max, Math.round(point.y / gridSize) * gridSize)) };
}

export type RouteHandle = 'origin' | number;

/** Existing stages derive an initial goal from their velocity until the editor stores one. */
export function getRouteGoal(spawn: EditableRouteSpawn, seconds: number): RouteGoal | null {
  if (!('vx' in spawn.motion)) return null;
  if (spawn.routeGoal) return spawn.routeGoal;
  const crossing = fieldCrossing(spawn.position, { x: spawn.motion.vx, y: spawn.motion.vy });
  const elapsed = crossing ? clamp(seconds, crossing.entry, crossing.exit) : seconds;
  return { position: {
    x: clamp(round(spawn.position.x + spawn.motion.vx * elapsed), 0, 720),
    y: clamp(round(spawn.position.y + spawn.motion.vy * elapsed), 0, 720),
  }, at: round(spawn.time + elapsed) };
}

export function setRouteGoal(spawn: EditableRouteSpawn, position: Vec2, requestedAt: number): void {
  if (!('vx' in spawn.motion)) return;
  const goal = { x: clamp(round(position.x), 0, 720), y: clamp(round(position.y), 0, 720) };
  const dx = goal.x - spawn.position.x, dy = goal.y - spawn.position.y;
  const minimumDuration = Math.max(.1, Math.abs(dx) / 1000, Math.abs(dy) / 1000);
  const at = round(Math.max(requestedAt, spawn.time + minimumDuration));
  const duration = at - spawn.time;
  spawn.routeGoal = { position: goal, at };
  spawn.motion.vx = clamp(round(dx / duration), -1000, 1000);
  spawn.motion.vy = clamp(round(dy / duration), -1000, 1000);
}

export function setRouteOrigin(spawn: EditableRouteSpawn, position: Vec2, seconds: number): void {
  const goal = getRouteGoal(spawn, seconds);
  spawn.position = { ...position };
  if (goal) setRouteGoal(spawn, goal.position, goal.at);
}

export function setRouteSpawnTime(spawn: EditableRouteSpawn, time: number, seconds: number): void {
  const goal = getRouteGoal(spawn, seconds);
  spawn.time = time;
  if (goal) setRouteGoal(spawn, goal.position, goal.at);
}

export function shiftRouteTime(spawn: EditableRouteSpawn, delta: number): void {
  spawn.time = round(spawn.time + delta);
  if (spawn.routeGoal) spawn.routeGoal.at = round(spawn.routeGoal.at + delta);
}

/** Translate the whole route without changing its shape, speed or arrival time. */
export function translateRoute(spawn: EditableRouteSpawn, offset: Vec2, seconds: number): void {
  const goal = getRouteGoal(spawn, seconds);
  const shift = (point: Vec2): Vec2 => ({ x: round(point.x + offset.x), y: round(point.y + offset.y) });
  spawn.position = shift(spawn.position);
  if (spawn.motion.kind === 'fixed') spawn.motion.destination = shift(spawn.motion.destination);
  else if (spawn.motion.kind === 'path') spawn.motion.points = spawn.motion.points.map(shift);
  else if (goal) spawn.routeGoal = { position: shift(goal.position), at: goal.at };
}

export function routePoints(spawn: EditableRouteSpawn, seconds: number): Vec2[] {
  const start = spawn.position;
  const motion = spawn.motion;
  if (motion.kind === 'path') return [start, ...motion.points];
  if (motion.kind === 'fixed') return [start, motion.destination];
  if ('vx' in motion) return [start, getRouteGoal(spawn, seconds)!.position];
  return [start];
}

/** The goal stays fixed when the origin moves; speed is derived from both points and arrival time. */
export function moveRouteHandle(spawn: EditableRouteSpawn, handle: RouteHandle, point: Vec2, seconds: number): void {
  if (handle === 'origin') {
    setRouteOrigin(spawn, point, seconds);
    return;
  }
  const motion = spawn.motion;
  if ('vx' in motion) {
    setRouteGoal(spawn, point, getRouteGoal(spawn, seconds)!.at);
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

export function routeTiming(spawn: EditableRouteSpawn, seconds: number): RouteTiming {
  const motion = spawn.motion;
  if ('vx' in motion) {
    const speed = Math.hypot(motion.vx, motion.vy);
    const crossing = fieldCrossing(spawn.position, { x: motion.vx, y: motion.vy });
    const retirement = spawn.retireAfter ?? Infinity;
    const goal = getRouteGoal(spawn, seconds)!;
    return {
      speed, distance: Math.hypot(goal.position.x - spawn.position.x, goal.position.y - spawn.position.y),
      duration: goal.at - spawn.time, arrivalAt: goal.at,
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
