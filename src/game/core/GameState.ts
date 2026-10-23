import type { Player } from '../entities/Player';
import type { Bullet } from '../entities/Bullet';
import type { PracticeTarget } from '../entities/PracticeTarget';
import type { FieldBounds, ViewTransform } from './coordinates';
import type { Enemy } from '../entities/Enemy';
import type { EnemyBullet, EnemyLaser } from '../entities/EnemyBullet';
import type { CombatEffect, HealItem } from '../entities/Item';
import { GAME_CONFIG } from '../config';

export type GameMode = 'combat' | 'practice';

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
  mode: GameMode;
  gameOver: boolean;
  gameOverElapsed: number;
  previousGameOverElapsed: number;
  enemies: Enemy[];
  enemyBullets: EnemyBullet[];
  lasers: EnemyLaser[];
  items: HealItem[];
  effects: CombatEffect[];
  spawnCursor: number;
  spawnCycle: number;
  defeatedCount: number;
  hitsTaken: number;
  itemsCollected: number;
  enemyAttacksEnabled: boolean;
  eventMessage: string;
  eventUntil: number;
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
  mode: GameMode;
  gameOver: boolean;
  gameOverReady: boolean;
  hp: number;
  heal: number;
  invulnerable: boolean;
  hit: boolean;
  enemyCount: number;
  hostileCount: number;
  defeatedCount: number;
  cycle: number;
  enemyAttacksEnabled: boolean;
  eventMessage: string;
}

export function getHudSnapshot(state: GameState): HudSnapshot {
  return {
    elapsed: state.elapsed, paused: state.paused, slow: state.player.slow,
    firing: state.player.firing, targetsEnabled: state.targetsEnabled,
    targetsMoving: state.targetsMoving, shotsFired: state.shotsFired,
    bulletCount: state.bullets.length, position: { ...state.player.position },
    mode: state.mode, gameOver: state.gameOver,
    gameOverReady: state.gameOver && state.gameOverElapsed >= GAME_CONFIG.defeat.duration,
    hp: state.player.hp, heal: state.player.heal,
    invulnerable: state.player.invulnerableFor > 0, hit: state.player.hitFlash > 0,
    enemyCount: state.enemies.length, hostileCount: state.enemyBullets.length + state.lasers.length,
    defeatedCount: state.defeatedCount, cycle: Math.max(1, state.spawnCycle + (state.spawnCursor > 0 ? 1 : 0)),
    enemyAttacksEnabled: state.enemyAttacksEnabled,
    eventMessage: state.elapsed < state.eventUntil ? state.eventMessage : '',
  };
}
