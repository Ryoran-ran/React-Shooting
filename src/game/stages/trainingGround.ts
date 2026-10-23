import { GAME_CONFIG } from '../config';
import type { FieldBounds, Vec2 } from '../core/coordinates';
import type { EnemySpawn } from '../entities/Enemy';
import type { StageProgression } from './stages';

export interface TrainingDefinition {
  id: string;
  name: string;
  field: FieldBounds;
  playerSpawn: Vec2;
  targets: { id: string; x: number; y: number; amplitude: number; phase: number }[];
  combat: { cycleDuration: number; seed: number; spawns: EnemySpawn[] };
  progression?: StageProgression;
}

export const trainingGround: TrainingDefinition = {
  id: 'training-01',
  name: 'サンライト・ラグーン',
  field: { x: 0, y: 0, width: GAME_CONFIG.layout.fieldWidth, height: GAME_CONFIG.layout.fieldHeight },
  playerSpawn: { x: 360, y: 550 },
  targets: [
    { id: 'jelly-left', x: 165, y: 220, amplitude: 42, phase: 0 },
    { id: 'jelly-center', x: 360, y: 155, amplitude: 58, phase: 2.1 },
    { id: 'jelly-right', x: 550, y: 255, amplitude: 38, phase: 4.2 },
  ],
  combat: {
    cycleDuration: 42,
    seed: 12457,
    spawns: [
      ...[120, 240, 360, 480, 600].map((x, index): EnemySpawn => ({
        time: 1.2 + index * 0.25, kind: 'small', position: { x, y: -35 },
        motion: { kind: 'wave', vx: 0, vy: 62, amplitude: 28, frequency: 1.3 },
      })),
      { time: 6, kind: 'medium', position: { x: 210, y: -40 }, motion: { kind: 'linear', vx: 15, vy: 40 } },
      { time: 7.5, kind: 'medium', position: { x: 510, y: -40 }, motion: { kind: 'linear', vx: -15, vy: 40 } },
      { time: 10, kind: 'turret', position: { x: 125, y: -40 }, motion: { kind: 'fixed', destination: { x: 125, y: 145 }, speed: 95 }, retireAfter: 17 },
      { time: 12, kind: 'rusher', position: { x: 70, y: -35 }, motion: { kind: 'chase', speed: 145 }, retireAfter: 7 },
      { time: 14, kind: 'rusher', position: { x: 650, y: -35 }, motion: { kind: 'path', points: [{ x: 560, y: 300 }, { x: 180, y: 550 }, { x: -60, y: 750 }], speed: 190, exitAtEnd: true } },
      { time: 16, kind: 'large', position: { x: 360, y: -65 }, motion: { kind: 'fixed', destination: { x: 360, y: 170 }, speed: 80 }, retireAfter: 23 },
      ...[160, 320, 480, 600].map((x, index): EnemySpawn => ({
        time: 21 + index * 0.35, kind: 'small', position: { x, y: -35 },
        motion: { kind: 'zigzag', vx: 0, vy: 80, amplitude: 40, period: 2.5 },
      })),
      { time: 28, kind: 'turret', position: { x: 595, y: -40 }, motion: { kind: 'fixed', destination: { x: 595, y: 150 }, speed: 95 }, retireAfter: 12 },
      { time: 31, kind: 'medium', position: { x: 180, y: -40 }, motion: { kind: 'wave', vx: 0, vy: 48, amplitude: 55, frequency: 1 }, retireAfter: 17 },
      { time: 33, kind: 'medium', position: { x: 540, y: -40 }, motion: { kind: 'wave', vx: 0, vy: 48, amplitude: 55, frequency: 1 }, retireAfter: 17 },
    ],
  },
};
