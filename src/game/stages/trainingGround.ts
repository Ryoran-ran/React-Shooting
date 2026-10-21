import { GAME_CONFIG } from '../config';
import type { FieldBounds, Vec2 } from '../core/coordinates';

export interface TrainingDefinition {
  id: string;
  name: string;
  field: FieldBounds;
  playerSpawn: Vec2;
  targets: { id: string; x: number; y: number; amplitude: number; phase: number }[];
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
};
