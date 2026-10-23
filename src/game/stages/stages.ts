import type { BossDefinition } from '../bosses/lagoonGuardian';
import { lagoonGuardian } from '../bosses/lagoonGuardian';
import { trainingGround, type TrainingDefinition } from './trainingGround';

export interface StageProgression {
  bossAt: number;
  boss: BossDefinition;
  ranks: { S: number; A: number; B: number };
}

export interface StageDefinition extends TrainingDefinition {
  description: string;
  background: 'lagoon';
  progression: StageProgression;
}

export const stageOne: StageDefinition = {
  ...trainingGround, id: 'stage-01', name: 'サンライト・ラグーン',
  description: '木漏れ日の浅瀬を抜けて、ラグーンの守り手に会いにいこう。',
  background: 'lagoon',
  combat: { ...trainingGround.combat, spawns: trainingGround.combat.spawns.map((spawn) => ({
    ...spawn, retireAfter: Math.min(spawn.retireAfter ?? 18, 49 - spawn.time),
  })) },
  progression: { bossAt: 49, boss: lagoonGuardian, ranks: { S: 24000, A: 19000, B: 14000 } },
};

// Add a definition here to make another stage appear in stage selection.
export const STAGES: StageDefinition[] = [stageOne];
