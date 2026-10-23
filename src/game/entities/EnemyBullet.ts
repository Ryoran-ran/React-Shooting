import type { Vec2 } from '../core/coordinates';
import type { WorldBody } from './types';

export interface EnemyBullet extends WorldBody {
  age: number;
  hitRadius: number;
  damage: number;
}

// The direction is locked at warning time. No reference to the emitter is retained.
export interface EnemyLaser {
  id: string;
  origin: Vec2;
  end: Vec2;
  age: number;
  warning: number;
  duration: number;
  width: number;
  damage: number;
}
