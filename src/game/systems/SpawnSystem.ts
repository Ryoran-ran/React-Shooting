import { ENEMY_DEFINITIONS } from '../../data/enemies';
import type { Enemy, EnemySpawn } from '../entities/Enemy';
import type { GameState } from '../core/GameState';
import type { TrainingDefinition } from '../stages/trainingGround';

export function createEnemy(spawn: EnemySpawn, id: string): Enemy {
  const definition = ENEMY_DEFINITIONS[spawn.kind];
  return {
    id, kind: spawn.kind, position: { ...spawn.position }, previousPosition: { ...spawn.position },
    velocity: { x: 0, y: 0 }, origin: { ...spawn.position }, age: 0,
    hp: definition.hp, maxHp: definition.hp, hitRadius: definition.hitRadius, hitFlash: 0,
    motion: structuredClone(spawn.motion), retireAfter: spawn.retireAfter,
    pathIndex: 0, entered: false, retired: false, retreat: null,
    attackCooldowns: definition.attacks.map((attack) => attack.firstShot),
  };
}

export function spawnEnemies(state: GameState, definition: TrainingDefinition, nextId: () => string): void {
  const { spawns, cycleDuration } = definition.combat;
  if (spawns.length === 0) return;
  if (state.mode === 'stage') {
    while (state.spawnCursor < spawns.length && state.elapsed + 1e-9 >= spawns[state.spawnCursor].time) {
      state.enemies.push(createEnemy(spawns[state.spawnCursor++], nextId()));
    }
    return;
  }
  while (true) {
    const spawn = spawns[state.spawnCursor];
    if (state.elapsed + 1e-9 < state.spawnCycle * cycleDuration + spawn.time) break;
    state.enemies.push(createEnemy(spawn, nextId()));
    state.spawnCursor++;
    if (state.spawnCursor === spawns.length) { state.spawnCursor = 0; state.spawnCycle++; }
  }
}
