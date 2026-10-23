import type { EnemyDefinition, EnemyKind } from '../game/entities/Enemy';

// Enemy balance and appearance are data, independent of motion and rendering code.
export const ENEMY_DEFINITIONS: Record<EnemyKind, EnemyDefinition> = {
  boss: { name: 'アオウミガメ', appearance: 'turtle', hp: 280, hitRadius: 47, visualRadius: 85,
    dropRate: 0, dropCount: 0, attacks: [] },
  small: {
    name: 'ミズクラゲ', appearance: 'jelly', hp: 4, hitRadius: 14, visualRadius: 19,
    dropRate: 0.15, dropCount: 1,
    attacks: [{ kind: 'straight', firstShot: 2.4, interval: 3.4, speed: 135, count: 1, spread: 0 }],
  },
  medium: {
    name: 'ハリセンボン', appearance: 'puffer', hp: 14, hitRadius: 20, visualRadius: 25,
    dropRate: 0.4, dropCount: 1,
    attacks: [{ kind: 'aimed', firstShot: 2.2, interval: 2.6, speed: 155, count: 3, spread: 0.42 }],
  },
  turret: {
    name: 'ヒカリイソギンチャク', appearance: 'anemone', hp: 20, hitRadius: 20, visualRadius: 27,
    dropRate: 0.5, dropCount: 1,
    attacks: [{ kind: 'laser', firstShot: 3.2, interval: 5.5, speed: 0, count: 1, spread: 0,
      laser: { warning: 1.2, duration: 0.65, width: 10, length: 1100 } }],
  },
  rusher: {
    name: 'ヤリイカ', appearance: 'squid', hp: 6, hitRadius: 13, visualRadius: 23,
    dropRate: 0.15, dropCount: 1, explodeOnContact: true, attacks: [],
  },
  large: {
    name: 'ユメマンタ', appearance: 'ray', hp: 48, hitRadius: 30, visualRadius: 43,
    dropRate: 1, dropCount: 2,
    attacks: [
      { kind: 'straight', firstShot: 3, interval: 2.2, speed: 140, count: 5, spread: 1.1 },
      { kind: 'aimed', firstShot: 2, interval: 2.8, speed: 165, count: 1, spread: 0, belowHpRatio: 0.5 },
    ],
  },
};
