// All provisional gameplay values live here. Distances are world pixels; time is seconds.
export const GAME_CONFIG = {
  layout: { width: 1280, height: 720, panelWidth: 280, fieldWidth: 720, fieldHeight: 720 },
  loop: { step: 1 / 60, maxFrameTime: 0.25 },
  player: { speed: 300, slowSpeed: 120, visualRadius: 22, hitRadius: 4, maxHp: 10, invulnerability: 1.5, hitFlash: 0.22 },
  practice: { horizontalFrequency: 0.65, verticalFrequency: 0.85, verticalAmplitude: 15 },
  gamepad: { deadZone: 0.18, buttonThreshold: 0.5, fire: 0, slow: [4, 5, 1, 6, 7], pause: 9 },
  shot: {
    straight: { interval: 0.12, damage: 2, speed: 600 },
    homing: { interval: 0.20, damage: 1, speed: 450, turnRate: Math.PI },
    radius: 3,
    lifetime: 4,
    cullMargin: 60,
    muzzleOffset: 23,
  },
  combat: { cullMargin: 90, enemyBulletRadius: 4, enemyBulletVisualRadius: 6, enemyBulletLifetime: 10, contactDamage: 1, enemyHitFlash: 0.09 },
  heal: { maximum: 100, itemValue: 20, fallSpeed: 45, pickupRadius: 13, lifetime: 20, dropSpread: 22 },
  effects: { burstLifetime: 0.5, hitLifetime: 0.35, healLifetime: 0.6, explosionLifetime: 0.45, explosionRadius: 38 },
  retreat: { speed: 200, acceleration: 360 },
  boss: { introDuration: 3.2, muzzleOffset: 60, vanishDuration: 2.1, clearCueDelay: 1.55, resultDelay: 4.8 },
  collection: { delay: 0.12, speed: 1050, acceleration: 650, radius: 12 },
  defeat: { duration: 1.2, drift: 16, roll: 0.65, exitPadding: 45, fadeStart: 0.75 },
  ui: { updateInterval: 0.1 },
} as const;
