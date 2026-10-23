import { GAME_CONFIG } from '../config';
import type { GameState } from '../core/GameState';

export function updateHealth(state: GameState, dt: number): void {
  state.player.invulnerableFor = Math.max(0, state.player.invulnerableFor - dt);
  state.player.hitFlash = Math.max(0, state.player.hitFlash - dt);
  updateEffects(state, dt);
}

export function updateEffects(state: GameState, dt: number): void {
  state.effects = state.effects.filter((effect) => { effect.age += dt; return effect.age < effect.lifetime; });
}

export function damagePlayer(state: GameState, amount: number, nextId: () => string): boolean {
  const player = state.player;
  if (player.hp <= 0 || player.invulnerableFor > 1e-9) return false;
  player.hp = Math.max(0, player.hp - amount);
  player.invulnerableFor = GAME_CONFIG.player.invulnerability;
  player.hitFlash = GAME_CONFIG.player.hitFlash;
  state.hitsTaken++;
  state.effects.push({ id: nextId(), kind: 'hit', position: { ...player.position }, age: 0, lifetime: GAME_CONFIG.effects.hitLifetime });
  state.eventMessage = 'ぱしゅん！ 被弾後はしばらく無敵です。';
  state.eventUntil = state.elapsed + 3;
  return true;
}

export function addHealing(state: GameState, amount: number, nextId: () => string): void {
  const player = state.player;
  if (player.hp <= 0 || player.hp >= GAME_CONFIG.player.maxHp) return;
  player.heal += amount;
  let healed = false;
  while (player.heal >= GAME_CONFIG.heal.maximum && player.hp < GAME_CONFIG.player.maxHp) {
    player.heal -= GAME_CONFIG.heal.maximum;
    player.hp++;
    healed = true;
  }
  state.effects.push({ id: nextId(), kind: 'heal', position: { ...player.position }, age: 0, lifetime: GAME_CONFIG.effects.healLifetime });
  state.eventMessage = healed ? 'HPが1回復しました。' : `回復ゲージ +${amount}。100でHPが1回復します。`;
  state.eventUntil = state.elapsed + 3;
}
