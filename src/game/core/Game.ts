import { createPlayer } from '../entities/Player';
import { GAME_CONFIG } from '../config';
import type { PracticeTarget } from '../entities/PracticeTarget';
import { trainingGround, type TrainingDefinition } from '../stages/trainingGround';
import { updateAttack, updateBullets } from '../systems/AttackSystem';
import type { InputFrame } from '../systems/InputSystem';
import { movePlayer } from '../systems/MovementSystem';
import { createDefaultView } from './coordinates';
import type { GameState } from './GameState';

export class Game {
  state!: GameState;
  private bulletId = 0;

  constructor(readonly definition: TrainingDefinition = trainingGround) { this.reset(); }

  reset(): void {
    this.bulletId = 0;
    const { x, y } = this.definition.playerSpawn;
    this.state = {
      elapsed: 0, paused: false, field: { ...this.definition.field }, view: createDefaultView(),
      player: createPlayer(x, y), bullets: [], targets: this.createTargets(),
      targetsEnabled: true, targetsMoving: true, shotsFired: 0,
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
    this.state.paused = paused;
    this.state.player.firing = false;
    this.state.player.slow = false;
    this.state.player.velocity = { x: 0, y: 0 };
    // A paused frame must not interpolate backward from the final world position.
    for (const body of [this.state.player, ...this.state.targets, ...this.state.bullets]) {
      body.previousPosition = { ...body.position };
    }
  }

  setTargetsEnabled(enabled: boolean): void {
    this.state.targetsEnabled = enabled;
    this.state.targets = enabled ? this.createTargets() : [];
    if (!enabled) for (const bullet of this.state.bullets) bullet.targetId = null;
  }

  setTargetsMoving(moving: boolean): void { this.state.targetsMoving = moving; }

  update(dt: number, input: InputFrame): void {
    const state = this.state;
    if (state.paused) return;
    state.elapsed += dt;
    state.player.previousPosition = { ...state.player.position };
    movePlayer(state.player, input, state.field, dt);
    for (const target of state.targets) {
      target.previousPosition = { ...target.position };
      if (state.targetsMoving) {
        target.position.x = target.origin.x + Math.sin(state.elapsed * GAME_CONFIG.practice.horizontalFrequency + target.phase) * target.amplitude;
        target.position.y = target.origin.y + Math.sin(state.elapsed * GAME_CONFIG.practice.verticalFrequency + target.phase) * GAME_CONFIG.practice.verticalAmplitude;
      }
    }
    updateAttack(state, input, dt, () => `shot-${++this.bulletId}`);
    state.bullets = updateBullets(state.bullets, state.targets, state.field, dt);
  }
}
