import type { WorldBody } from './types';

// A practice target is not an enemy: it has no HP, collision, attack or score.
export interface PracticeTarget extends WorldBody {
  origin: { x: number; y: number };
  amplitude: number;
  phase: number;
}
