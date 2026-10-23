import type { Vec2 } from '../core/coordinates';
import type { WorldBody } from './types';

export interface HealItem extends WorldBody { age: number }
export interface CombatEffect {
  id: string;
  kind: 'burst' | 'hit' | 'heal' | 'explosion';
  position: Vec2;
  age: number;
  lifetime: number;
}
