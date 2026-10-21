import type { WorldBody } from './types';

export type ShotMode = 'straight' | 'homing';

export interface Bullet extends WorldBody {
  mode: ShotMode;
  speed: number;
  damage: number;
  age: number;
  targetId: string | null;
}
