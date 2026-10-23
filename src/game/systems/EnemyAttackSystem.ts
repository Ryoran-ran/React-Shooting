import { ENEMY_DEFINITIONS } from '../../data/enemies';
import { GAME_CONFIG } from '../config';
import type { GameState } from '../core/GameState';

export function updateEnemyAttacks(state: GameState, dt: number, nextId: () => string): void {
  for (const enemy of state.enemies) {
    if (enemy.retired || enemy.retreat || enemy.hp <= 0) continue;
    ENEMY_DEFINITIONS[enemy.kind].attacks.forEach((attack, index) => {
      enemy.attackCooldowns[index] -= dt;
      if (!enemy.entered || (attack.belowHpRatio !== undefined && enemy.hp / enemy.maxHp > attack.belowHpRatio)) {
        enemy.attackCooldowns[index] = Math.max(0, enemy.attackCooldowns[index]);
        return;
      }
      while (enemy.attackCooldowns[index] <= 1e-9) {
        const base = attack.kind === 'straight' ? Math.PI / 2
          : Math.atan2(state.player.position.y - enemy.position.y, state.player.position.x - enemy.position.x);
        for (let i = 0; i < attack.count; i++) {
          const angle = base + (attack.count === 1 ? 0 : (i / (attack.count - 1) - 0.5) * attack.spread);
          if (attack.kind === 'laser' && attack.laser) {
            state.lasers.push({
              id: nextId(), origin: { ...enemy.position },
              end: { x: enemy.position.x + Math.cos(angle) * attack.laser.length, y: enemy.position.y + Math.sin(angle) * attack.laser.length },
              age: 0, ...attack.laser, damage: 1,
            });
          } else {
            state.enemyBullets.push({
              id: nextId(), position: { ...enemy.position }, previousPosition: { ...enemy.position },
              velocity: { x: Math.cos(angle) * attack.speed, y: Math.sin(angle) * attack.speed },
              age: 0, hitRadius: GAME_CONFIG.combat.enemyBulletRadius, damage: 1,
            });
          }
        }
        enemy.attackCooldowns[index] += attack.interval;
      }
    });
  }
}

export function updateHostileProjectiles(state: GameState, dt: number): void {
  const field = state.field;
  const margin = GAME_CONFIG.combat.cullMargin;
  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    bullet.previousPosition = { ...bullet.position };
    bullet.position.x += bullet.velocity.x * dt;
    bullet.position.y += bullet.velocity.y * dt;
    bullet.age += dt;
    return bullet.age < GAME_CONFIG.combat.enemyBulletLifetime && bullet.position.x >= field.x - margin
      && bullet.position.x <= field.x + field.width + margin && bullet.position.y >= field.y - margin
      && bullet.position.y <= field.y + field.height + margin;
  });
  state.lasers = state.lasers.filter((laser) => {
    laser.age += dt;
    return laser.age < laser.warning + laser.duration;
  });
}
