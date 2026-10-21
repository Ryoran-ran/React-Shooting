import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_INPUT, InputSystem } from '../game/systems/InputSystem';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  vi.stubGlobal('Element', class {});
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const input = new InputSystem();
  const pause = vi.fn();
  const deactivate = vi.fn();
  const detach = input.attach(win as unknown as Window, doc as unknown as Document, pause, deactivate);
  const key = (code: string, type = 'keydown', repeat = false) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { code, repeat, ctrlKey: false, metaKey: false, altKey: false });
    win.dispatchEvent(event);
  };
  return { win, doc, input, pause, deactivate, detach, key };
}

describe('keyboard lifecycle', () => {
  it('combines alternate movement keys and releases each key independently', () => {
    const { input, key, detach } = setup();
    key('KeyW'); key('ArrowUp'); key('ShiftRight'); key('Space');
    key('KeyW', 'keyup');
    expect(input.read()).toEqual({ x: 0, y: -1, slow: true, fire: true });
    key('ArrowUp', 'keyup');
    expect(input.read().y).toBe(0);
    detach();
    expect(input.read()).toEqual(IDLE_INPUT);
  });

  it('clears held keys on window blur and tab hiding', () => {
    const { win, doc, input, key, deactivate, detach } = setup();
    key('KeyD'); key('KeyZ');
    win.dispatchEvent(new Event('blur'));
    expect(input.read()).toEqual(IDLE_INPUT);
    key('KeyW');
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(input.read()).toEqual(IDLE_INPUT);
    expect(deactivate).toHaveBeenCalledTimes(2);
    detach();
    key('KeyW');
    expect(input.read()).toEqual(IDLE_INPUT);
  });

  it('toggles pause only once per Escape press and clears the previous inputs', () => {
    const { input, key, pause, detach } = setup();
    key('ArrowRight'); key('Escape'); key('Escape', 'keydown', true);
    expect(pause).toHaveBeenCalledOnce();
    expect(input.read()).toEqual(IDLE_INPUT);
    detach();
  });
});
