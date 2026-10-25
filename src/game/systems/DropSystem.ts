import { ENEMY_DEFINITIONS } from '../../data/enemies';
import { GAME_CONFIG } from '../config';
import type { GameState } from '../core/GameState';
import { addHealing } from './HealthSystem';
import { sweptCircleTime } from './CollisionSystem';
import { SCORE_CONFIG } from './ScoreSystem';
import { attractItem } from './CollectionSystem';

export function resolveDefeats(state: GameState, nextId: () => string, random: () => number): void {
  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.kind === 'boss') return true; // Boss defeat belongs to stage progression.
    if (enemy.hp > 0) return !enemy.retired;
    // Retreats never enter the defeat path or roll for a drop.
    if (enemy.retired) return false;
    state.defeatedCount++;
    state.score += SCORE_CONFIG.enemies[enemy.kind];
    const definition = ENEMY_DEFINITIONS[enemy.kind];
    state.effects.push({ id: nextId(), kind: 'burst', variant: enemy.kind,
      position: { ...enemy.position }, age: 0, lifetime: GAME_CONFIG.effects.burstLifetime });
    state.eventMessage = `${definition.name}を撃破！`;
    state.eventUntil = state.elapsed + 2;
    if (random() < definition.dropRate) {
      for (let i = 0; i < definition.dropCount; i++) {
        const position = { x: enemy.position.x + (i - (definition.dropCount - 1) / 2) * GAME_CONFIG.heal.dropSpread, y: enemy.position.y };
        state.items.push({ id: nextId(), position, previousPosition: { ...position }, velocity: { x: 0, y: GAME_CONFIG.heal.fallSpeed }, age: 0 });
      }
    }
    return false;
  });
}

export function updateItems(state: GameState, dt: number, nextId: () => string): void {
  state.items = state.items.filter((item) => {
    item.previousPosition = { ...item.position };
    item.age += dt;
    if (item.autoCollect) attractItem(item, state.player.position, dt);
    else item.position.y += item.velocity.y * dt;
    if (sweptCircleTime(item.previousPosition, item.position, GAME_CONFIG.heal.pickupRadius,
      state.player.previousPosition, state.player.position, GAME_CONFIG.player.hitRadius) !== null) {
      state.itemsCollected++;
      addHealing(state, GAME_CONFIG.heal.itemValue, nextId);
      return false;
    }
    return item.autoCollect || item.age < GAME_CONFIG.heal.lifetime && item.position.y < state.field.y + state.field.height + GAME_CONFIG.heal.pickupRadius;
  });
}
