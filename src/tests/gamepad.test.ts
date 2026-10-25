import { describe, expect, it } from 'vitest';
import { Game } from '../game/core/Game';
import { trainingGround } from '../game/stages/trainingGround';
import { GamepadSystem, stickDirection } from '../game/systems/GamepadSystem';
import { combineInputs, IDLE_INPUT } from '../game/systems/InputSystem';

function buttons(pressed: number[] = []): GamepadButton[] {
  return Array.from({ length: 17 }, (_, index) => ({ pressed: pressed.includes(index), value: Number(pressed.includes(index)), touched: pressed.includes(index) }));
}

function pad(overrides: Partial<Gamepad> = {}): Gamepad {
  return { id: 'Test standard pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: buttons(), timestamp: 0, ...overrides } as Gamepad;
}

function setup(initial = pad()) {
  let current: readonly (Gamepad | null)[] | null = [initial];
  const input = new GamepadSystem(() => current);
  input.poll();
  return { input, set: (value: readonly (Gamepad | null)[] | null) => { current = value; } };
}

describe('gamepad movement and actions', () => {
  it('rejects small drift, preserves analog strength and caps diagonal magnitude', () => {
    expect(stickDirection(0.1, -0.1)).toEqual({ x: 0, y: 0 });
    expect(stickDirection(0.59, 0).x).toBeCloseTo(0.5);
    expect(Math.hypot(...Object.values(stickDirection(1, 1)))).toBeCloseTo(1);
    expect(stickDirection(NaN, Infinity)).toEqual({ x: 0, y: 0 });
    const game = new Game(trainingGround, 'practice');
    const direction = stickDirection(0.59, 0);
    for (let i = 0; i < 30; i++) game.update(1 / 60, { ...IDLE_INPUT, ...direction });
    expect(game.state.player.position.x - 360).toBeCloseTo(75);
    game.update(0.5, { ...IDLE_INPUT, ...direction, slow: true });
    expect(game.state.player.position.x - 360).toBeCloseTo(105);
  });

  it('uses the d-pad ahead of the stick and does not double movement with a keyboard', () => {
    const { input, set } = setup();
    set([pad({ axes: [1, 0], buttons: buttons([12, 14]) })]); input.poll();
    expect(input.read()).toEqual({ x: -1, y: -1, slow: false, fire: false });
    const combined = combineInputs({ x: 1, y: 0, fire: false, slow: true }, { x: 1, y: 1, fire: true, slow: false });
    expect(combined).toEqual({ x: 1, y: 0, fire: true, slow: true });
  });

  it('maps the bottom face button to fire and either shoulder, right face button or trigger to focus', () => {
    const { input, set } = setup();
    for (const index of [4, 5, 1, 6, 7]) {
      set([pad({ buttons: buttons([index]) })]); input.poll();
      expect(input.read()).toEqual({ ...IDLE_INPUT, slow: true });
    }
    set([pad({ buttons: buttons([0, 4]) })]);
    expect(input.poll().confirmPressed).toBe(true);
    expect(input.read()).toEqual({ ...IDLE_INPUT, fire: true, slow: true });
    expect(input.poll().confirmPressed).toBe(false);
  });

  it('detects Start once per press, including after pause clears the input', () => {
    const { input, set } = setup();
    set([pad({ buttons: buttons([9]) })]);
    expect(input.poll().pausePressed).toBe(true);
    input.clear();
    for (let i = 0; i < 100; i++) expect(input.poll().pausePressed).toBe(false);
    set([pad()]); input.poll();
    set([pad({ buttons: buttons([9]) })]);
    expect(input.poll().pausePressed).toBe(true);
  });

  it('uses only the right face button for menu back, with release gating and no repeat', () => {
    const { input, set } = setup();
    for (const index of [4, 5, 6, 7]) {
      set([pad({ buttons: buttons([index]) })]); expect(input.poll().backPressed).toBe(false);
    }
    set([pad({ buttons: buttons([1]) })]); expect(input.poll().backPressed).toBe(true);
    expect(input.poll().backPressed).toBe(false);
    input.clear(); expect(input.poll().backPressed).toBe(false);
    set([pad()]); input.poll();
    set([pad({ buttons: buttons([1]) })]); expect(input.poll().backPressed).toBe(true);
  });

  it('waits for neutral after connection, focus loss and reset, preventing stuck movement or fire', () => {
    const held = pad({ axes: [0.8, 0], buttons: buttons([0, 9]) });
    const { input, set } = setup(held);
    expect(input.read()).toEqual(IDLE_INPUT);
    expect(input.status.needsRelease).toBe(true);
    set([pad()]); input.poll();
    set([held]); expect(input.poll().pausePressed).toBe(true);
    expect(input.read().fire).toBe(true);
    input.poll(false);
    expect(input.read()).toEqual(IDLE_INPUT);
    expect(input.poll(true).confirmPressed).toBe(false);
    expect(input.read()).toEqual(IDLE_INPUT);
    set([pad()]); input.poll(); set([held]); input.poll();
    expect(input.read().fire).toBe(true);
    input.clear(); input.poll();
    expect(input.read()).toEqual(IDLE_INPUT);
  });

  it('moves a menu after a screen change even with a held stick or shoulder, without carrying confirm into play', () => {
    const { input, set } = setup();
    set([pad({ buttons: buttons([0, 4]) })]);
    expect(input.poll(true, true).confirmPressed).toBe(true);
    input.clear(); // Opening stage selection while L is still held.
    set([pad({ axes: [0, 1], buttons: buttons([0, 4, 13]) })]);
    expect(input.poll(true, true).confirmPressed).toBe(false);
    expect(input.readMenuDirection()).toBe(1);
    expect(input.status.needsRelease).toBe(true);
    set([pad({ axes: [0, 1], buttons: buttons([4, 13]) })]);
    input.poll(true, true);
    expect(input.status.needsRelease).toBe(false);
    set([pad({ axes: [0, 1], buttons: buttons([0, 4, 13]) })]);
    expect(input.poll(true, true).confirmPressed).toBe(true);
    input.clear(); // Launching a stage must still wait for neutral before gameplay input.
    input.poll(true, false);
    expect(input.read()).toEqual(IDLE_INPUT);
    expect(input.status.needsRelease).toBe(true);
  });

  it('reads a pad in a sparse slot and reports disconnect exactly once', () => {
    const { input, set } = setup(pad({ index: 2 }));
    set([null, null, pad({ index: 2, axes: [-1, 0] })]); input.poll();
    expect(input.read().x).toBe(-1);
    set([null, null, null]);
    expect(input.poll().disconnected).toBe(true);
    expect(input.read()).toEqual(IDLE_INPUT);
    expect(input.status.kind).toBe('disconnected');
    expect(input.poll().disconnected).toBe(false);
  });

  it('does not inherit held inputs if another device reuses a slot', () => {
    const { input, set } = setup();
    set([pad({ buttons: buttons([0]) })]); input.poll();
    set([pad({ id: 'Replacement pad', buttons: buttons([0, 9]) })]);
    const actions = input.poll();
    expect(actions.disconnected).toBe(true);
    expect(actions.pausePressed).toBe(false);
    expect(actions.confirmPressed).toBe(false);
    expect(input.read()).toEqual(IDLE_INPUT);
    expect(input.status.needsRelease).toBe(true);
  });

  it('keeps the selected pad when other pads connect or disconnect', () => {
    const { input, set } = setup(pad({ index: 1 }));
    set([pad({ id: 'Other' }), pad({ index: 1, axes: [0, -1] })]);
    expect(input.poll().disconnected).toBe(false);
    expect(input.read().y).toBe(-1);
    set([null, pad({ index: 1, axes: [0, -1] })]);
    expect(input.poll().disconnected).toBe(false);
    expect(input.read().y).toBe(-1);
  });

  it('falls back safely for unsupported layouts, missing APIs and security errors', () => {
    const { input, set } = setup();
    set([pad({ mapping: '', axes: [1, 0], buttons: buttons([0]) })]);
    expect(input.poll().disconnected).toBe(true);
    expect(input.status.kind).toBe('unsupported');
    expect(input.read()).toEqual(IDLE_INPUT);
    set(null); input.poll();
    expect(input.status.kind).toBe('unavailable');
    const blocked = new GamepadSystem(() => { throw new Error('SecurityError'); });
    expect(() => blocked.poll()).not.toThrow();
    expect(blocked.read()).toEqual(IDLE_INPUT);
    expect(blocked.status.kind).toBe('unavailable');
  });
});
