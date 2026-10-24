import type { BossDefinition } from '../bosses/lagoonGuardian';
import { lagoonGuardian } from '../bosses/lagoonGuardian';
import { shoreCrab } from '../bosses/shoreCrab';
import type { EnemyAttack, EnemySpawn } from '../entities/Enemy';
import { trainingGround, type TrainingDefinition } from './trainingGround';

export interface StageProgression {
  bossAt: number;
  boss: BossDefinition;
  ranks: { S: number; A: number; B: number };
}

export interface StageDefinition extends TrainingDefinition {
  description: string;
  gimmick?: { kind: 'screen-shrink'; inset: number; scale: number;
    windows: { at: number; warning: number; contract: number; hold: number; recover: number }[] };
  scene: {
    course: 'lagoon' | 'shallows'; boss: 'lagoon' | 'beach';
    label: string; bossLabel: string; depth: string; intro: string; clear: string;
  };
  progression: StageProgression;
}

export const stageOne: StageDefinition = {
  ...trainingGround, id: 'stage-01', name: 'サンライト・ラグーン',
  description: '木漏れ日の浅瀬を抜けて、ラグーンの守り手に会いにいこう。',
  scene: { course: 'lagoon', boss: 'lagoon', label: 'SUNLIGHT LAGOON', bossLabel: 'GUARDIAN BATTLE',
    depth: '012', intro: 'ラグーンの守り手、接近。', clear: 'ラグーンの先へ。' },
  combat: { ...trainingGround.combat, spawns: trainingGround.combat.spawns.map((spawn) => ({
    ...spawn, retireAfter: Math.min(spawn.retireAfter ?? 18, 49 - spawn.time),
  })) },
  progression: { bossAt: 49, boss: lagoonGuardian, ranks: { S: 24000, A: 19000, B: 14000 } },
};

// Stage 2's schools cross from the sides and form pincers around the contracting field.
const crossCurrent: EnemyAttack[] = [
  { kind: 'aimed', firstShot: 2, interval: 4.4, speed: 120, count: 1, spread: 0 },
];
const sandFan: EnemyAttack[] = [
  { kind: 'straight', firstShot: 2.2, interval: 3.4, speed: 145, count: 5, spread: 1.1 },
];
const squeezeFan: EnemyAttack[] = [
  { kind: 'aimed', firstShot: 2.8, interval: 4.1, speed: 145, count: 5, spread: 0.9 },
];
const raySweep: EnemyAttack[] = [
  { kind: 'aimed', firstShot: 2.5, interval: 3.8, speed: 160, count: 5, spread: 0.8 },
];
const shallowSpawns: EnemySpawn[] = [
  ...[145, 225, 305].flatMap((y, index): EnemySpawn[] => ([-1, 1] as const).map((side) => ({
    time: 1.2 + index * 0.48 + (side === 1 ? 0.22 : 0), kind: 'small',
    position: { x: side === -1 ? -35 : 755, y },
    motion: { kind: 'linear', vx: side === -1 ? 105 : -105, vy: 13 },
    attacks: crossCurrent,
    retireAfter: 9,
  }))),
  { time: 7, kind: 'medium', position: { x: -45, y: 155 }, motion: { kind: 'path', points: [
    { x: 220, y: 210 }, { x: 490, y: 265 }, { x: 770, y: 320 },
  ], speed: 120, exitAtEnd: true }, attacks: sandFan },
  { time: 8.3, kind: 'medium', position: { x: 765, y: 165 }, motion: { kind: 'path', points: [
    { x: 500, y: 220 }, { x: 230, y: 275 }, { x: -50, y: 330 },
  ], speed: 120, exitAtEnd: true }, attacks: sandFan },
  { time: 11.4, kind: 'rusher', position: { x: -35, y: 235 }, motion: { kind: 'path', points: [
    { x: 230, y: 335 }, { x: 490, y: 465 }, { x: 770, y: 590 },
  ], speed: 205, exitAtEnd: true } },
  { time: 12.6, kind: 'rusher', position: { x: 755, y: 235 }, motion: { kind: 'path', points: [
    { x: 490, y: 335 }, { x: 230, y: 465 }, { x: -50, y: 590 },
  ], speed: 205, exitAtEnd: true } },
  { time: 16.2, kind: 'turret', position: { x: -40, y: 155 }, motion: { kind: 'fixed', destination: { x: 215, y: 155 }, speed: 115 }, attacks: squeezeFan, retireAfter: 10 },
  { time: 17, kind: 'turret', position: { x: 760, y: 155 }, motion: { kind: 'fixed', destination: { x: 505, y: 155 }, speed: 115 }, attacks: squeezeFan, retireAfter: 10 },
  ...[250, 330, 410].flatMap((y, index): EnemySpawn[] => ([-1, 1] as const).map((side) => ({
    time: 20.3 + index * 0.5 + (side === 1 ? 0.22 : 0), kind: 'small',
    position: { x: side === -1 ? -35 : 755, y },
    motion: { kind: 'linear', vx: side === -1 ? 130 : -130, vy: -14 }, attacks: crossCurrent, retireAfter: 7,
  }))),
  { time: 27, kind: 'large', position: { x: -60, y: 130 }, motion: { kind: 'path', points: [
    { x: 210, y: 180 }, { x: 440, y: 225 }, { x: 770, y: 280 },
  ], speed: 105, exitAtEnd: true }, attacks: raySweep, retireAfter: 16 },
  { time: 32.7, kind: 'medium', position: { x: 765, y: 115 }, motion: { kind: 'path', points: [
    { x: 525, y: 190 }, { x: 330, y: 270 }, { x: -50, y: 345 },
  ], speed: 145, exitAtEnd: true }, attacks: sandFan },
  { time: 34.3, kind: 'medium', position: { x: -45, y: 140 }, motion: { kind: 'path', points: [
    { x: 195, y: 215 }, { x: 390, y: 295 }, { x: 770, y: 370 },
  ], speed: 145, exitAtEnd: true }, attacks: sandFan },
  { time: 36.1, kind: 'rusher', position: { x: -35, y: 365 }, motion: { kind: 'path', points: [
    { x: 225, y: 430 }, { x: 470, y: 525 }, { x: 770, y: 620 },
  ], speed: 210, exitAtEnd: true } },
  { time: 37.3, kind: 'rusher', position: { x: 755, y: 365 }, motion: { kind: 'path', points: [
    { x: 495, y: 430 }, { x: 250, y: 525 }, { x: -50, y: 620 },
  ], speed: 210, exitAtEnd: true } },
  { time: 40.5, kind: 'turret', position: { x: 760, y: 125 }, motion: { kind: 'fixed', destination: { x: 520, y: 145 }, speed: 120 }, attacks: squeezeFan, retireAfter: 10 },
  ...[165, 265, 365].map((y, index): EnemySpawn => ({
    time: 45.2 + index * 0.6, kind: 'small', position: { x: index % 2 ? 755 : -35, y },
    motion: { kind: 'linear', vx: index % 2 ? -145 : 145, vy: 10 }, attacks: crossCurrent, retireAfter: 7,
  })),
];

export const stageTwo: StageDefinition = {
  ...trainingGround, id: 'stage-02', name: 'ひかりの浅瀬',
  description: '砂の波紋が光る浅瀬を抜け、砂浜の番人に挑もう。',
  gimmick: { kind: 'screen-shrink', inset: 45, scale: 0.82, windows: [
    { at: 14, warning: 1.8, contract: 2, hold: 6, recover: 2 },
    { at: 32, warning: 1.8, contract: 2, hold: 6, recover: 2 },
  ] },
  scene: { course: 'shallows', boss: 'beach', label: 'SHIMMERING SHALLOWS', bossLabel: 'SANDY SHORE',
    depth: '003', intro: '砂浜の番人、接近。', clear: '波打ちぎわを越えて。' },
  combat: { cycleDuration: 55, seed: 82461, spawns: shallowSpawns },
  progression: { bossAt: 55, boss: shoreCrab, ranks: { S: 27000, A: 22000, B: 16000 } },
};

export const STAGES: StageDefinition[] = [stageOne, stageTwo];
