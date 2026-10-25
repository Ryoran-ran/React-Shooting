import { createPlayer } from '../entities/Player';
import { GAME_CONFIG } from '../config';
import type { PracticeTarget } from '../entities/PracticeTarget';
import { trainingGround, type TrainingDefinition } from '../stages/trainingGround';
import { getAimTargets, updateAttack, updateBullets } from '../systems/AttackSystem';
import type { InputFrame } from '../systems/InputSystem';
import { movePlayer } from '../systems/MovementSystem';
import { createDefaultView } from './coordinates';
import type { GameMode, GameState } from './GameState';
import { spawnEnemies } from '../systems/SpawnSystem';
import { moveEnemies } from '../systems/EnemyMovementSystem';
import { updateEnemyAttacks, updateHostileProjectiles } from '../systems/EnemyAttackSystem';
import { resolvePlayerDamage, resolvePlayerShots } from '../systems/CollisionSystem';
import { resolveDefeats, updateItems } from '../systems/DropSystem';
import { updateEffects, updateHealth } from '../systems/HealthSystem';
import type { StageDefinition } from '../stages/stages';
import { resolveBoss, updateStage } from '../systems/StageSystem';
import { updateScoreItems } from '../systems/CollectionSystem';
import { updateGimmick } from '../systems/GimmickSystem';

export class Game {
  state!: GameState;
  private entityId = 0;
  private runId = 0;
  private randomSeed = 0;
  private nextId = () => `entity-${++this.entityId}`;
  private random = () => {
    this.randomSeed = (Math.imul(this.randomSeed, 1664525) + 1013904223) >>> 0;
    return this.randomSeed / 4294967296;
  };

  constructor(public definition: TrainingDefinition = trainingGround, mode: GameMode = 'combat') { this.reset(mode); }

  startStage(definition: StageDefinition): void { this.definition = definition; this.reset('stage'); }

  reset(mode: GameMode = this.state?.mode ?? 'combat'): void {
    this.randomSeed = this.definition.combat.seed;
    const { x, y } = this.definition.playerSpawn;
    this.state = {
      runId: ++this.runId, stage: mode === 'stage' && this.definition.progression
        ? { ...this.definition.progression, id: this.definition.id, name: this.definition.name,
          scene: (this.definition as StageDefinition).scene,
          field: { ...this.definition.field }, gimmicks: structuredClone((this.definition as StageDefinition).gimmicks) } : null,
      stagePhase: 'waves', bossIntroElapsed: 0, boss: null, score: 0, result: null, clearElapsed: 0,
      gimmick: { phase: 'idle', amount: 0, activeCount: 0, events: [] },
      elapsed: 0, paused: false, field: { ...this.definition.field }, view: createDefaultView(),
      player: createPlayer(x, y), bullets: [], targets: mode === 'practice' ? this.createTargets() : [],
      targetsEnabled: true, targetsMoving: true, shotsFired: 0,
      mode, gameOver: false, gameOverElapsed: 0, previousGameOverElapsed: 0,
      enemies: [], enemyBullets: [], lasers: [], items: [], scoreItems: [], effects: [],
      spawnCursor: 0, spawnCycle: 0, defeatedCount: 0, hitsTaken: 0, itemsCollected: 0,
      enemyAttacksEnabled: true, eventMessage: '敵が接近中。Z / Spaceで迎え撃とう。', eventUntil: 5,
    };
  }

  private createTargets(): PracticeTarget[] {
    return this.definition.targets.map((target) => ({
      id: target.id, position: { x: target.x, y: target.y }, previousPosition: { x: target.x, y: target.y },
      velocity: { x: 0, y: 0 }, origin: { x: target.x, y: target.y },
      amplitude: target.amplitude, phase: target.phase,
    }));
  }

  setPaused(paused: boolean): void {
    if (this.state.gameOver || this.state.result) return;
    this.state.paused = paused;
    this.state.player.firing = false;
    this.state.player.slow = false;
    this.state.player.velocity = { x: 0, y: 0 };
    // A paused frame must not interpolate backward from the final world position.
    this.freezeInterpolation();
  }

  private freezeInterpolation(): void {
    for (const body of [this.state.player, ...this.state.targets, ...this.state.bullets, ...this.state.enemies, ...this.state.enemyBullets, ...this.state.items, ...this.state.scoreItems]) {
      body.previousPosition = { ...body.position };
    }
  }

  setTargetsEnabled(enabled: boolean): void {
    if (this.state.mode !== 'practice') return;
    this.state.targetsEnabled = enabled;
    this.state.targets = enabled ? this.createTargets() : [];
    if (!enabled) for (const bullet of this.state.bullets) bullet.targetId = null;
  }

  setTargetsMoving(moving: boolean): void { this.state.targetsMoving = moving; }

  setMode(mode: GameMode): void { if (mode !== 'stage') this.definition = trainingGround; this.reset(mode); }

  setEnemyAttacksEnabled(enabled: boolean): void {
    if (this.state.mode === 'stage') return;
    this.state.enemyAttacksEnabled = enabled;
    if (!enabled) { this.state.enemyBullets = []; this.state.lasers = []; }
  }

  update(dt: number, input: InputFrame): void {
    const state = this.state;
    if (state.paused) return;
    if (state.result) { state.clearElapsed += dt; updateEffects(state, dt); return; }
    if (state.gameOver) {
      state.previousGameOverElapsed = state.gameOverElapsed;
      if (state.gameOverElapsed < GAME_CONFIG.defeat.duration) {
        state.gameOverElapsed = Math.min(GAME_CONFIG.defeat.duration, state.gameOverElapsed + dt);
        updateEffects(state, dt);
      }
      return;
    }
    state.elapsed += dt;
    if (state.mode === 'stage') updateGimmick(state);
    updateHealth(state, dt);
    state.player.previousPosition = { ...state.player.position };
    movePlayer(state.player, input, state.field, dt);
    for (const target of state.targets) {
      target.previousPosition = { ...target.position };
      if (state.targetsMoving) {
        target.position.x = target.origin.x + Math.sin(state.elapsed * GAME_CONFIG.practice.horizontalFrequency + target.phase) * target.amplitude;
        target.position.y = target.origin.y + Math.sin(state.elapsed * GAME_CONFIG.practice.verticalFrequency + target.phase) * GAME_CONFIG.practice.verticalAmplitude;
      }
    }
    if (state.mode !== 'practice') {
      if (state.stagePhase === 'waves') spawnEnemies(state, this.definition, this.nextId);
      if (state.mode === 'stage') updateStage(state, dt, this.nextId,
        this.definition.combat.spawns.length > 0 && state.spawnCursor >= this.definition.combat.spawns.length);
      moveEnemies(state.enemies, state.player.position, state.field, dt);
    }
    updateAttack(state, input, dt, this.nextId);
    state.bullets = updateBullets(state.bullets, getAimTargets(state), state.field, dt);
    if (state.mode !== 'practice') {
      resolvePlayerShots(state);
      resolveDefeats(state, this.nextId, this.random);
      if (state.mode === 'stage') resolveBoss(state, this.nextId);
      if (state.result) { this.freezeInterpolation(); return; }
      if (state.enemyAttacksEnabled) updateEnemyAttacks(state, dt, this.nextId);
      updateHostileProjectiles(state, dt);
      resolvePlayerDamage(state, this.nextId);
      if (state.player.hp === 0) {
        state.gameOver = true;
        state.player.firing = false;
        state.player.slow = false;
        state.player.muzzleFlash = 0;
        state.player.velocity = { x: 0, y: 0 };
        state.bullets = []; state.enemyBullets = []; state.lasers = []; state.scoreItems = [];
        this.freezeInterpolation();
        return;
      }
      updateItems(state, dt, this.nextId);
      updateScoreItems(state, dt, this.nextId);
    }
  }
}
