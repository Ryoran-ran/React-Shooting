// All provisional gameplay values live here. Distances are world pixels; time is seconds.
export const GAME_CONFIG = {
  layout: { width: 1280, height: 720, panelWidth: 280, fieldWidth: 720, fieldHeight: 720 },
  loop: { step: 1 / 60, maxFrameTime: 0.25 },
  player: { speed: 300, slowSpeed: 120, visualRadius: 22, hitRadius: 4, maxHp: 10 },
  practice: { horizontalFrequency: 0.65, verticalFrequency: 0.85, verticalAmplitude: 15 },
  shot: {
    straight: { interval: 0.12, damage: 2, speed: 600 },
    homing: { interval: 0.20, damage: 1, speed: 450, turnRate: Math.PI },
    radius: 3,
    lifetime: 4,
    cullMargin: 60,
    muzzleOffset: 23,
  },
  ui: { updateInterval: 0.1 },
} as const;
