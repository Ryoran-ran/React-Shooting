import type { Vec2 } from '../core/coordinates';
import type { WorldBody } from './types';

export type EnemyKind = 'small' | 'medium' | 'turret' | 'rusher' | 'large';
export type EnemyAppearance = 'jelly' | 'puffer' | 'anemone' | 'squid' | 'ray';

export type EnemyMotion =
  | { kind: 'linear'; vx: number; vy: number }
  | { kind: 'wave'; vx: number; vy: number; amplitude: number; frequency: number }
  | { kind: 'zigzag'; vx: number; vy: number; amplitude: number; period: number }
  | { kind: 'chase'; speed: number }
  | { kind: 'fixed'; destination: Vec2; speed: number }
  | { kind: 'path'; points: Vec2[]; speed: number; exitAtEnd: boolean };

export interface EnemyAttack {
  kind: 'straight' | 'aimed' | 'laser';
  firstShot: number;
  interval: number;
  speed: number;
  count: number;
  spread: number;
  belowHpRatio?: number;
  laser?: { warning: number; duration: number; width: number; length: number };
}

export interface EnemyDefinition {
  name: string;
  appearance: EnemyAppearance;
  hp: number;
  hitRadius: number;
  visualRadius: number;
  dropRate: number;
  dropCount: number;
  explodeOnContact?: boolean;
  attacks: EnemyAttack[];
}

export interface EnemySpawn {
  time: number;
  kind: EnemyKind;
  position: Vec2;
  motion: EnemyMotion;
  retireAfter?: number;
}

export interface Enemy extends WorldBody {
  kind: EnemyKind;
  origin: Vec2;
  hp: number;
  maxHp: number;
  hitRadius: number;
  age: number;
  hitFlash: number;
  motion: EnemyMotion;
  retireAfter?: number;
  pathIndex: number;
  entered: boolean;
  retired: boolean;
  retreat: { destination: Vec2 } | null;
  attackCooldowns: number[];
}
