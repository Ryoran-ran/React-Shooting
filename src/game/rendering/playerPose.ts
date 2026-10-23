import { GAME_CONFIG } from '../config';
import { interpolate, type Vec2 } from '../core/coordinates';
import type { GameState } from '../core/GameState';

interface PlayerPose { position: Vec2; rotation: number; opacity: number }

/** Presentation only: the defeat animation never changes collision or saved world data. */
export function getPlayerPose(state: GameState, alpha: number): PlayerPose {
  const player = state.player;
  if (!state.gameOver) {
    return {
      position: interpolate(player.previousPosition, player.position, alpha),
      rotation: player.velocity.x / GAME_CONFIG.player.speed * 0.17,
      opacity: player.invulnerableFor > 0 && Math.floor(state.elapsed * 14) % 2 === 0 ? 0.3 : 1,
    };
  }
  const elapsed = state.previousGameOverElapsed + (state.gameOverElapsed - state.previousGameOverElapsed) * alpha;
  const progress = Math.min(1, elapsed / GAME_CONFIG.defeat.duration);
  const fallDistance = state.field.y + state.field.height + GAME_CONFIG.player.visualRadius
    + GAME_CONFIG.defeat.exitPadding - player.position.y;
  const fall = progress * 0.15 + progress * progress * 0.85;
  return {
    position: {
      x: player.position.x + Math.sin(progress * Math.PI) * GAME_CONFIG.defeat.drift,
      y: player.position.y + fallDistance * fall,
    },
    rotation: progress * GAME_CONFIG.defeat.roll,
    opacity: 1 - Math.max(0, (progress - GAME_CONFIG.defeat.fadeStart) / (1 - GAME_CONFIG.defeat.fadeStart)),
  };
}
