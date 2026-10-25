import type { Vec2 } from '../core/coordinates';
import type { EnemyAppearance, EnemyAttack } from '../entities/Enemy';

export interface BossDefinition {
  id: string;
  name: string;
  appearance: EnemyAppearance;
  hp: number;
  hitRadius: number;
  spawn: Vec2;
  destination: Vec2;
  entrySpeed: number;
  transitionDuration: number;
  phases: { hpRatio: number; name: string; amplitude: number; frequency: number; attacks: EnemyAttack[] }[];
}

export const lagoonGuardian: BossDefinition = {
  id: 'lagoon-guardian', name: 'ラグーンの守り手・アオウミガメ', appearance: 'turtle', hp: 280, hitRadius: 47,
  spawn: { x: 360, y: -100 }, destination: { x: 360, y: 145 }, entrySpeed: 150, transitionDuration: 2.4,
  phases: [
    { hpRatio: 1, name: 'ゆらめく潮', amplitude: 110, frequency: 0.4, attacks: [
      { kind: 'straight', firstShot: 1.4, interval: 2.1, speed: 130, count: 7, spread: 1.65 },
      { kind: 'aimed', firstShot: 2.6, interval: 3.4, speed: 155, count: 3, spread: 0.3 },
    ] },
    { hpRatio: 0.5, name: '光の海流', amplitude: 150, frequency: 0.55, attacks: [
      { kind: 'straight', firstShot: 1.2, interval: 1.55, speed: 158, count: 11, spread: 2 },
      { kind: 'aimed', firstShot: 2, interval: 2.8, speed: 175, count: 3, spread: 0.4 },
      { kind: 'laser', firstShot: 3, interval: 6.5, speed: 0, count: 1, spread: 0,
        laser: { warning: 1.4, duration: 0.6, width: 12, length: 1100 } },
    ] },
  ],
};
