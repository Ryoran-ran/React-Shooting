export interface InputFrame { x: number; y: number; slow: boolean; fire: boolean }
export const IDLE_INPUT: InputFrame = { x: 0, y: 0, slow: false, fire: false };

export function combineInputs(keyboard: InputFrame, gamepad: InputFrame): InputFrame {
  const movement = keyboard.x !== 0 || keyboard.y !== 0 ? keyboard : gamepad;
  return { x: movement.x, y: movement.y, slow: keyboard.slow || gamepad.slow, fire: keyboard.fire || gamepad.fire };
}

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'KeyZ', 'Space', 'ShiftLeft', 'ShiftRight', 'Escape',
]);

export class InputSystem {
  private keys = new Set<string>();

  read(): InputFrame {
    const held = (...codes: string[]) => codes.some((code) => this.keys.has(code));
    return {
      x: Number(held('ArrowRight', 'KeyD')) - Number(held('ArrowLeft', 'KeyA')),
      y: Number(held('ArrowDown', 'KeyS')) - Number(held('ArrowUp', 'KeyW')),
      slow: held('ShiftLeft', 'ShiftRight'), fire: held('KeyZ', 'Space'),
    };
  }

  clear(): void { this.keys.clear(); }

  attach(win: Window, doc: Document, onPause: () => void, onDeactivate: () => void): () => void {
    const down = (event: KeyboardEvent) => {
      if (!GAME_KEYS.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Escape') {
        event.preventDefault();
        if (!event.repeat) { this.clear(); onPause(); }
        return;
      }
      // Keep native keyboard activation and editing intact for the React controls.
      if (event.target instanceof Element && event.target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
      event.preventDefault();
      this.keys.add(event.code);
    };
    const up = (event: KeyboardEvent) => { this.keys.delete(event.code); };
    const deactivate = () => { this.clear(); onDeactivate(); };
    const visibility = () => { if (doc.hidden) deactivate(); };
    win.addEventListener('keydown', down);
    win.addEventListener('keyup', up);
    win.addEventListener('blur', deactivate);
    doc.addEventListener('visibilitychange', visibility);
    return () => {
      this.clear();
      win.removeEventListener('keydown', down);
      win.removeEventListener('keyup', up);
      win.removeEventListener('blur', deactivate);
      doc.removeEventListener('visibilitychange', visibility);
    };
  }
}
