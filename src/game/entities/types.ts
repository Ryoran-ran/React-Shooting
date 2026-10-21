import type { Vec2 } from '../core/coordinates';

export interface WorldBody {
  id: string;
  position: Vec2;
  previousPosition: Vec2;
  velocity: Vec2;
}
