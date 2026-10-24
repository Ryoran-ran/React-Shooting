import { expect, it } from 'vitest';
import type { EnemySpawn } from '../game/entities/Enemy';
import { moveRouteHandle, routePoints, routeTiming, snapRoutePoint } from '../app/editorRoute';

function linear(): EnemySpawn {
  return { time: 12, kind: 'small', position: { x: -60, y: 300 },
    motion: { kind: 'linear', vx: 120, vy: 0 } };
}

it('moves the spawn independently and calculates velocity from the dragged arrow and time', () => {
  const spawn = linear();
  moveRouteHandle(spawn, 'origin', { x: -40, y: 310 }, 3);
  expect(spawn.position).toEqual({ x: -40, y: 310 });
  expect(spawn.motion).toMatchObject({ vx: 120, vy: 0 });
  moveRouteHandle(spawn, 1, { x: 260, y: 460 }, 3);
  expect(spawn.motion).toMatchObject({ vx: 100, vy: 50 });
  expect(routePoints(spawn, 3)[1]).toEqual({ x: 260, y: 460 });
  expect(routeTiming(spawn, 3).arrivalAt).toBe(15);
});

it('calculates entry and exit stage times from a straight route', () => {
  const timing = routeTiming(linear(), 3);
  expect(timing.fieldEntryAt).toBe(12.5);
  expect(timing.fieldExitAt).toBe(18.5);
  expect(timing.distance).toBe(360);
  expect(timing.approximate).toBe(false);
  const retiring = linear(); retiring.retireAfter = 2;
  expect(routeTiming(retiring, 3)).toMatchObject({ fieldEntryAt: 12.5, fieldExitAt: null });
  const wave = linear(); wave.motion = { kind: 'wave', vx: 120, vy: 0, amplitude: 55, frequency: 2 };
  expect(routeTiming(wave, 3).approximate).toBe(true);
});

it('moves fixed destinations and path waypoints and calculates their travel time', () => {
  const spawn: EnemySpawn = { time: 10, kind: 'medium', position: { x: 0, y: 0 },
    motion: { kind: 'path', points: [{ x: 30, y: 40 }, { x: 30, y: 80 }], speed: 10, exitAtEnd: true } };
  expect(routeTiming(spawn, 3)).toMatchObject({ distance: 90, duration: 9, arrivalAt: 19 });
  moveRouteHandle(spawn, 2, { x: 30, y: 100 }, 3);
  expect(routeTiming(spawn, 3)).toMatchObject({ distance: 110, duration: 11, arrivalAt: 21 });
  spawn.motion = { kind: 'fixed', destination: { x: 5, y: 5 }, speed: 5 };
  moveRouteHandle(spawn, 1, { x: 30, y: 40 }, 3);
  expect(routeTiming(spawn, 3)).toMatchObject({ distance: 50, duration: 10, arrivalAt: 20 });
});

it('does not invent an arrival time for a player-seeking enemy', () => {
  const spawn = linear(); spawn.motion = { kind: 'chase', speed: 140 };
  expect(routePoints(spawn, 3)).toHaveLength(1);
  expect(routeTiming(spawn, 3)).toMatchObject({ speed: 140, duration: null, arrivalAt: null });
});

it('snaps pointer positions to visible grid cells while leaving numeric positions free', () => {
  expect(snapRoutePoint({ x: -35, y: 225 }, 40)).toEqual({ x: -40, y: 240 });
  expect(snapRoutePoint({ x: -100, y: 820 }, 40)).toEqual({ x: -80, y: 800 });
  expect(snapRoutePoint({ x: -35, y: 225 }, 0)).toEqual({ x: -35, y: 225 });
});
