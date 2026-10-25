import type { BossDefinition } from './lagoonGuardian';

export const shoreCrab: BossDefinition = {
  id: 'shore-crab', name: '砂浜の番人・ヤドカリ', appearance: 'hermit-crab', hp: 330, hitRadius: 48,
  spawn: { x: 360, y: -110 }, destination: { x: 360, y: 155 }, entrySpeed: 140, transitionDuration: 2.6,
  phases: [
    { hpRatio: 1, name: '波打ちぎわ', amplitude: 130, frequency: 0.55, attacks: [
      { kind: 'straight', firstShot: 1.3, interval: 2, speed: 145, count: 9, spread: 1.85 },
      { kind: 'aimed', firstShot: 2.5, interval: 3.6, speed: 165, count: 3, spread: 0.3 },
    ] },
    { hpRatio: 0.5, name: '砂のうずしお', amplitude: 175, frequency: 0.7, attacks: [
      { kind: 'straight', firstShot: 1.1, interval: 1.7, speed: 165, count: 11, spread: 2.1 },
      { kind: 'aimed', firstShot: 2, interval: 3.1, speed: 180, count: 3, spread: 0.45 },
      { kind: 'laser', firstShot: 3.1, interval: 7, speed: 0, count: 1, spread: 0,
        laser: { warning: 1.5, duration: 0.65, width: 12, length: 1100 } },
    ] },
  ],
};
