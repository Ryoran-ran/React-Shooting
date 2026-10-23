import type { EnemyKind } from '../entities/Enemy';
import type { GameState } from '../core/GameState';

export type Rank = 'S' | 'A' | 'B' | 'C';
export const SCORE_CONFIG = {
  enemies: { small: 100, medium: 300, turret: 300, rusher: 100, large: 1000, boss: 5000 } satisfies Record<EnemyKind, number>,
  clear: 3000, perHp: 1000, noMiss: 5000, phaseBreak: 100, convertedBullet: 10,
};

export interface StageResult {
  stageId: string;
  score: number;
  rank: Rank;
  combatScore: number;
  clearBonus: number;
  hpBonus: number;
  noMissBonus: number;
  hp: number;
  hitsTaken: number;
  defeatedCount: number;
  elapsed: number;
}

export function calculateResult(state: GameState): StageResult {
  const clearBonus = SCORE_CONFIG.clear;
  const hpBonus = state.player.hp * SCORE_CONFIG.perHp;
  const noMissBonus = state.hitsTaken === 0 ? SCORE_CONFIG.noMiss : 0;
  const score = state.score + clearBonus + hpBonus + noMissBonus;
  const ranks = state.stage!.ranks;
  const rank: Rank = score >= ranks.S ? 'S' : score >= ranks.A ? 'A' : score >= ranks.B ? 'B' : 'C';
  return { stageId: state.stage!.id, score, rank, combatScore: state.score, clearBonus, hpBonus, noMissBonus,
    hp: state.player.hp, hitsTaken: state.hitsTaken, defeatedCount: state.defeatedCount, elapsed: state.elapsed };
}
