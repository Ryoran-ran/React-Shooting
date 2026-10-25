import type { GameState } from '../core/GameState';
import { createEnemy } from './SpawnSystem';
import { calculateResult, SCORE_CONFIG } from './ScoreSystem';
import { GAME_CONFIG } from '../config';
import { convertPhaseItems } from './CollectionSystem';

export function clearProjectiles(state: GameState): void {
  state.bullets = []; state.enemyBullets = []; state.lasers = [];
}

export function updateStage(state: GameState, dt: number, nextId: () => string, timelineComplete = false): void {
  const stage = state.stage;
  if (!stage) return;
  const waveCleared = timelineComplete && !state.enemies.some((e) => e.hp > 0 && !e.retired && !e.retreat);
  if (!state.boss && (waveCleared || state.elapsed + 1e-9 >= stage.bossAt)) {
    const definition = stage.boss;
    const enemy = createEnemy({ time: 0, kind: 'boss', position: definition.spawn,
      motion: { kind: 'fixed', destination: definition.destination, speed: definition.entrySpeed } }, nextId());
    enemy.hp = enemy.maxHp = definition.hp; enemy.hitRadius = definition.hitRadius;
    enemy.appearance = definition.appearance;
    enemy.invulnerable = true;
    enemy.attacks = definition.phases[0].attacks;
    enemy.attackCooldowns = enemy.attacks.map((a) => a.firstShot);
    // The timeline ends before arrival. Any surviving enemies swim offstage.
    for (const other of state.enemies) other.retireAfter = 0;
    clearProjectiles(state);
    state.enemies.push(enemy);
    state.boss = { entityId: enemy.id, phaseIndex: 0, phaseElapsed: 0, transitionFor: 0, entering: true,
      pendingPhase: null, phaseStartedAt: 0, collectionTotal: 0, collectionValue: 0, collected: 0 };
    state.stagePhase = 'boss-intro';
    state.eventMessage = `大きな影が近づいてきます。${definition.name}、接近中。`;
    state.eventUntil = state.elapsed + 5;
  }
  const runtime = state.boss;
  const enemy = state.enemies.find((e) => e.id === runtime?.entityId);
  if (!runtime || !enemy) return;
  if (runtime.entering) {
    state.bossIntroElapsed += dt;
    state.player.invulnerableFor = Math.max(state.player.invulnerableFor, dt * 2);
    if (state.bossIntroElapsed < GAME_CONFIG.boss.introDuration) return;
    if (Math.hypot(enemy.position.x - stage.boss.destination.x, enemy.position.y - stage.boss.destination.y) > 0.01) return;
    runtime.entering = false;
    runtime.phaseStartedAt = state.elapsed;
    state.stagePhase = 'boss';
    enemy.invulnerable = false;
  }
  if (runtime.pendingPhase !== null) {
    runtime.transitionFor = Math.max(0, runtime.transitionFor - dt);
    state.player.invulnerableFor = Math.max(state.player.invulnerableFor, dt * 2);
    enemy.motion = { kind: 'fixed', destination: { ...enemy.position }, speed: 110 };
    if (runtime.transitionFor > 1e-9 || state.scoreItems.length || state.items.some((item) => item.autoCollect)) return;
    runtime.phaseIndex = runtime.pendingPhase;
    runtime.pendingPhase = null;
    runtime.phaseElapsed = 0;
    runtime.phaseStartedAt = state.elapsed;
    enemy.attacks = stage.boss.phases[runtime.phaseIndex].attacks;
    enemy.attackCooldowns = enemy.attacks.map((a) => a.firstShot);
    enemy.invulnerable = false;
    state.eventMessage = `ボス PHASE ${runtime.phaseIndex + 1}：${stage.boss.phases[runtime.phaseIndex].name}`;
    state.eventUntil = state.elapsed + 3;
    return;
  }
  if (state.lasers.some((laser) => laser.emitterId === enemy.id && laser.age < laser.warning + laser.duration)) {
    enemy.motion = { kind: 'fixed', destination: { ...enemy.position }, speed: 110 };
    return; // Hold both position and movement clock throughout the warning and beam.
  }
  runtime.phaseElapsed += dt;
  const phase = stage.boss.phases[runtime.phaseIndex];
  const destination = { x: stage.boss.destination.x + Math.sin(runtime.phaseElapsed * phase.frequency) * phase.amplitude,
    y: stage.boss.destination.y };
  // Move towards a moving destination so phase changes never teleport the boss.
  enemy.motion = { kind: 'fixed', destination, speed: 110 };
}

/** Runs after player shots and before hostile attacks, so a transition cancels every reservation. */
export function resolveBoss(state: GameState, nextId: () => string): void {
  const runtime = state.boss;
  const stage = state.stage;
  const enemy = state.enemies.find((e) => e.id === runtime?.entityId);
  if (!runtime || !stage || !enemy || state.result) return;
  if (enemy.hp <= 0) {
    state.score += SCORE_CONFIG.enemies.boss;
    state.defeatedCount++;
    clearProjectiles(state);
    // Keep the defeated boss in the frozen scene until its exit animation ends.
    state.enemies = [enemy]; state.items = []; state.scoreItems = [];
    enemy.attacks = []; enemy.attackCooldowns = []; enemy.invulnerable = true;
    for (const offset of [-35, 0, 35]) state.effects.push({ id: nextId(), kind: 'explosion',
      position: { x: enemy.position.x + offset, y: enemy.position.y }, age: 0, lifetime: 1.2 });
    state.stagePhase = 'clear';
    state.result = calculateResult(state);
    state.score = state.result.score;
    state.player.firing = false; state.player.slow = false; state.player.muzzleFlash = 0;
    state.player.velocity = { x: 0, y: 0 };
    state.eventMessage = 'ステージクリア！'; state.eventUntil = Infinity;
    return;
  }
  if (runtime.entering || runtime.pendingPhase !== null) return;
  let nextPhase = runtime.phaseIndex;
  while (nextPhase + 1 < stage.boss.phases.length && enemy.hp / enemy.maxHp <= stage.boss.phases[nextPhase + 1].hpRatio) nextPhase++;
  if (nextPhase === runtime.phaseIndex) return;
  runtime.pendingPhase = nextPhase; runtime.transitionFor = stage.boss.transitionDuration;
  enemy.invulnerable = true;
  enemy.attackCooldowns = [];
  enemy.motion = { kind: 'fixed', destination: { ...enemy.position }, speed: 110 };
  convertPhaseItems(state, { x: enemy.position.x, y: enemy.position.y + GAME_CONFIG.boss.muzzleOffset }, nextId);
  clearProjectiles(state);
  state.player.invulnerableFor = Math.max(state.player.invulnerableFor, stage.boss.transitionDuration);
  state.eventMessage = `PHASE ${runtime.phaseIndex + 1} CLEAR！ 弾をアイテムに変えて自動回収中。`;
  state.eventUntil = state.elapsed + 4;
}
