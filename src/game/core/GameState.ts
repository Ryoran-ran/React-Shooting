import type { Player } from '../entities/Player';
import type { Bullet } from '../entities/Bullet';
import type { PracticeTarget } from '../entities/PracticeTarget';
import type { FieldBounds, ViewTransform } from './coordinates';

export interface GameState {
  elapsed: number;
  paused: boolean;
  field: FieldBounds;
  view: ViewTransform;
  player: Player;
  bullets: Bullet[];
  targets: PracticeTarget[];
  targetsEnabled: boolean;
  targetsMoving: boolean;
  shotsFired: number;
}

// React subscribes to this small snapshot at 10 Hz, never to per-frame entities.
export interface HudSnapshot {
  elapsed: number;
  paused: boolean;
  slow: boolean;
  firing: boolean;
  targetsEnabled: boolean;
  targetsMoving: boolean;
  shotsFired: number;
  bulletCount: number;
  position: { x: number; y: number };
}

export function getHudSnapshot(state: GameState): HudSnapshot {
  return {
    elapsed: state.elapsed, paused: state.paused, slow: state.player.slow,
    firing: state.player.firing, targetsEnabled: state.targetsEnabled,
    targetsMoving: state.targetsMoving, shotsFired: state.shotsFired,
    bulletCount: state.bullets.length, position: { ...state.player.position },
  };
}
