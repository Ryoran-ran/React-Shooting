import { GAME_CONFIG } from '../config';
import { IDLE_INPUT, type InputFrame } from './InputSystem';

export interface GamepadStatus {
  kind: 'disconnected' | 'connected' | 'unsupported' | 'unavailable';
  name: string;
  needsRelease: boolean;
}

export const INITIAL_GAMEPAD_STATUS: GamepadStatus = { kind: 'disconnected', name: '', needsRelease: false };
export interface GamepadActions { pausePressed: boolean; confirmPressed: boolean; disconnected: boolean }
type GamepadReader = () => readonly (Gamepad | null)[] | null;

function browserGamepads(): readonly (Gamepad | null)[] | null {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : null;
}

export function stickDirection(x: number, y: number): { x: number; y: number } {
  x = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
  y = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  const magnitude = Math.hypot(x, y);
  const deadZone = GAME_CONFIG.gamepad.deadZone;
  if (magnitude <= deadZone) return { x: 0, y: 0 };
  const strength = (Math.min(1, magnitude) - deadZone) / (1 - deadZone);
  return { x: x / magnitude * strength, y: y / magnitude * strength };
}

/** Poll once per displayed frame, including while the simulation is paused. */
export class GamepadSystem {
  status: GamepadStatus = INITIAL_GAMEPAD_STATUS;
  private frame: InputFrame = { ...IDLE_INPUT };
  private selected: { index: number; id: string } | null = null;
  private needsRelease = true;
  private previousPause = false;
  private previousConfirm = false;

  constructor(private readGamepads: GamepadReader = browserGamepads) {}

  read(): InputFrame { return this.frame; }

  clear(): void {
    this.frame = { ...IDLE_INPUT };
    this.needsRelease = true;
    // Keep edge history: a held Start button must never toggle pause repeatedly.
  }

  poll(active = true): GamepadActions {
    const actions: GamepadActions = { pausePressed: false, confirmPressed: false, disconnected: false };
    let pads: readonly (Gamepad | null)[] | null;
    try { pads = this.readGamepads(); } catch { pads = null; }
    const available = pads?.filter((pad): pad is Gamepad => pad !== null && pad.connected) ?? [];
    const supported = available.filter((pad) => pad.mapping === 'standard');
    const pad = supported.find((candidate) => candidate.index === this.selected?.index && candidate.id === this.selected?.id) ?? supported[0];
    if (!pad) {
      actions.disconnected = this.selected !== null;
      this.selected = null;
      this.clear(); this.previousPause = false; this.previousConfirm = false;
      this.status = { kind: pads === null ? 'unavailable' : available.length ? 'unsupported' : 'disconnected', name: available[0]?.id ?? '', needsRelease: false };
      return actions;
    }
    if (pad.index !== this.selected?.index || pad.id !== this.selected?.id) {
      actions.disconnected = this.selected !== null;
      this.selected = { index: pad.index, id: pad.id };
      this.clear();
      this.previousPause = false; this.previousConfirm = false;
    }
    const pressed = (index: number) => {
      const button = pad.buttons[index];
      return button?.pressed === true || (button?.value ?? 0) > GAME_CONFIG.gamepad.buttonThreshold;
    };
    const stick = stickDirection(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const dpad = [12, 13, 14, 15].some(pressed);
    const direction = dpad ? { x: Number(pressed(15)) - Number(pressed(14)), y: Number(pressed(13)) - Number(pressed(12)) } : stick;
    const fire = pressed(GAME_CONFIG.gamepad.fire);
    const slow = GAME_CONFIG.gamepad.slow.some(pressed);
    const pause = pressed(GAME_CONFIG.gamepad.pause);
    const neutral = stick.x === 0 && stick.y === 0 && !dpad && !fire && !slow && !pause;
    if (!active) this.clear();
    else if (this.needsRelease) {
      this.frame = { ...IDLE_INPUT };
      if (neutral) this.needsRelease = false;
    } else {
      this.frame = { ...direction, fire, slow };
      actions.pausePressed = pause && !this.previousPause;
      actions.confirmPressed = fire && !this.previousConfirm;
    }
    this.previousPause = pause;
    this.previousConfirm = fire;
    this.status = { kind: 'connected', name: pad.id, needsRelease: this.needsRelease };
    return actions;
  }
}
