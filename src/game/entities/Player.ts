import type { WorldBody } from './types';
import { GAME_CONFIG } from '../config';

export interface Player extends WorldBody {
  slow: boolean;
  firing: boolean;
  fireCooldown: number;
  muzzleFlash: number;
  hp: number;
  heal: number;
  invulnerableFor: number;
  hitFlash: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    id: 'player', position: { x, y }, previousPosition: { x, y },
    velocity: { x: 0, y: 0 }, slow: false, firing: false, fireCooldown: 0, muzzleFlash: 0,
    hp: GAME_CONFIG.player.maxHp, heal: 0, invulnerableFor: 0, hitFlash: 0,
  };
}
