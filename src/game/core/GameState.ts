import type { Player } from '../entities/Player';
import type { Bullet } from '../entities/Bullet';
import type { PracticeTarget } from '../entities/PracticeTarget';
import type { FieldBounds, ViewTransform } from './coordinates';
import type { Enemy } from '../entities/Enemy';
import type { EnemyBullet, EnemyLaser } from '../entities/EnemyBullet';
import type { CombatEffect, HealItem, ScoreItem } from '../entities/Item';
import { GAME_CONFIG } from '../config';
import type { StageProgression } from '../stages/stages';
import type { StageResult } from '../systems/ScoreSystem';

export type GameMode = 'combat' | 'practice' | 'stage';

export interface GameState {
  runId: number;
  stage: (StageProgression & { id: string; name: string }) | null;
  stagePhase: 'waves' | 'boss-intro' | 'boss' | 'clear';
  bossIntroElapsed: number;
  boss: { entityId: string; phaseIndex: number; phaseElapsed: number; transitionFor: number; entering: boolean;
    pendingPhase: number | null; phaseStartedAt: number; collectionTotal: number; collectionValue: number; collected: number } | null;
  score: number;
  result: StageResult | null;
  clearElapsed: number;
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
  scoreItems: ScoreItem[];
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
  runId: number;
  stageId: string;
  stageName: string;
  stagePhase: GameState['stagePhase'];
  bossIntroProgress: number;
  progress: number;
  boss: { name: string; hp: number; maxHp: number; phase: number; phaseCount: number; phaseName: string; invulnerable: boolean;
    pendingPhase: number | null; collectionTotal: number; collectionValue: number; collected: number; announcing: boolean; laserActive: boolean } | null;
  score: number;
  result: StageResult | null;
  clearCueReady: boolean;
  clearReady: boolean;
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
  const enemy = state.enemies.find((e) => e.id === state.boss?.entityId);
  const boss = state.boss && state.stage && enemy ? {
    name: state.stage.boss.name, hp: enemy.hp, maxHp: enemy.maxHp,
    phase: state.boss.phaseIndex + 1, phaseCount: state.stage.boss.phases.length,
    phaseName: state.stage.boss.phases[state.boss.phaseIndex].name, invulnerable: Boolean(enemy.invulnerable),
    pendingPhase: state.boss.pendingPhase === null ? null : state.boss.pendingPhase + 1,
    collectionTotal: state.boss.collectionTotal, collectionValue: state.boss.collectionValue, collected: state.boss.collected,
    announcing: !state.boss.entering && state.boss.pendingPhase === null && state.elapsed - state.boss.phaseStartedAt < 1.2,
    laserActive: state.lasers.some((laser) => laser.emitterId === enemy.id),
  } : null;
  return {
    runId: state.runId, stageId: state.stage?.id ?? '', stageName: state.stage?.name ?? 'サンライト・ラグーン',
    stagePhase: state.stagePhase, score: state.score, result: state.result,
    bossIntroProgress: Math.min(1, state.bossIntroElapsed / GAME_CONFIG.boss.introDuration),
    clearCueReady: Boolean(state.result) && state.clearElapsed >= GAME_CONFIG.boss.clearCueDelay,
    clearReady: Boolean(state.result) && state.clearElapsed >= GAME_CONFIG.boss.resultDelay,
    progress: state.result ? 100 : state.stagePhase === 'boss' || state.stagePhase === 'boss-intro' ? 80 + (boss ? (1 - boss.hp / boss.maxHp) * 20 : 0)
      : state.stage ? Math.min(80, state.elapsed / state.stage.bossAt * 80) : 0,
    boss,
    elapsed: state.elapsed, paused: state.paused, slow: state.player.slow,
    firing: state.player.firing, targetsEnabled: state.targetsEnabled,
    targetsMoving: state.targetsMoving, shotsFired: state.shotsFired,
    bulletCount: state.bullets.length, position: { ...state.player.position },
    mode: state.mode, gameOver: state.gameOver,
    gameOverReady: state.gameOver && state.gameOverElapsed >= GAME_CONFIG.defeat.duration,
    hp: state.player.hp, heal: state.player.heal,
    invulnerable: state.player.invulnerableFor > 0, hit: state.player.hitFlash > 0,
    enemyCount: state.enemies.filter((entry) => entry.hp > 0 && !entry.retired).length,
    hostileCount: state.enemyBullets.length + state.lasers.length,
    defeatedCount: state.defeatedCount, cycle: Math.max(1, state.spawnCycle + (state.spawnCursor > 0 ? 1 : 0)),
    enemyAttacksEnabled: state.enemyAttacksEnabled,
    eventMessage: state.elapsed < state.eventUntil ? state.eventMessage : '',
  };
}
