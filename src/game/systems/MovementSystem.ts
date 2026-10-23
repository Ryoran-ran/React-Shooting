import { GAME_CONFIG } from '../config';
import type { FieldBounds } from '../core/coordinates';
import type { Player } from '../entities/Player';
import type { InputFrame } from './InputSystem';

export function movePlayer(player: Player, input: InputFrame, field: FieldBounds, dt: number): void {
  // Preserve partial analog-stick input; only normalize vectors above full speed.
  const magnitude = Math.max(1, Math.hypot(input.x, input.y));
  const speed = input.slow ? GAME_CONFIG.player.slowSpeed : GAME_CONFIG.player.speed;
  player.slow = input.slow;
  player.velocity = { x: input.x / magnitude * speed, y: input.y / magnitude * speed };
  const radius = GAME_CONFIG.player.visualRadius;
  player.position.x = Math.max(field.x + radius, Math.min(field.x + field.width - radius, player.position.x + player.velocity.x * dt));
  player.position.y = Math.max(field.y + radius, Math.min(field.y + field.height - radius, player.position.y + player.velocity.y * dt));
}
