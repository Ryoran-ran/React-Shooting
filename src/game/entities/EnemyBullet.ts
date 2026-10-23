import type { Vec2 } from '../core/coordinates';
import type { WorldBody } from './types';

export interface EnemyBullet extends WorldBody {
  age: number;
  hitRadius: number;
  damage: number;
}

// Direction is locked at warning time. Boss emitters hold their position until the beam ends.
export interface EnemyLaser {
  id: string;
  emitterId?: string;
  origin: Vec2;
  end: Vec2;
  age: number;
  warning: number;
  duration: number;
  width: number;
  damage: number;
}
