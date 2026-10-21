import type { WorldBody } from './types';

export interface Player extends WorldBody {
  slow: boolean;
  firing: boolean;
  fireCooldown: number;
  muzzleFlash: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    id: 'player', position: { x, y }, previousPosition: { x, y },
    velocity: { x: 0, y: 0 }, slow: false, firing: false, fireCooldown: 0, muzzleFlash: 0,
  };
}
