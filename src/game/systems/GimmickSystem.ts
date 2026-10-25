import { GAME_CONFIG } from '../config';
import type { GameState } from '../core/GameState';
import type { ScreenShrinkEvent } from '../stages/gimmicks';

export type GimmickPhase = 'idle' | 'warning' | 'contracting' | 'active' | 'recovering';

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function shrinkAt(event: ScreenShrinkEvent, elapsed: number): { phase: GimmickPhase; amount: number } {
  const t = elapsed - event.at;
  if (t < 0) return { phase: 'idle', amount: 0 };
  if (t < event.warning) return { phase: 'warning', amount: 0 };
  if (t < event.warning + event.contract)
    return { phase: 'contracting', amount: ease((t - event.warning) / event.contract) };
  if (t < event.warning + event.contract + event.hold) return { phase: 'active', amount: 1 };
  if (t < event.warning + event.contract + event.hold + event.recover)
    return { phase: 'recovering', amount: 1 - ease((t - event.warning - event.contract - event.hold) / event.recover) };
  return { phase: 'idle', amount: 0 };
}

const PHASE_PRIORITY: Record<GimmickPhase, number> = {
  idle: 0, warning: 1, recovering: 2, active: 3, contracting: 4,
};

/** Combine every event's contribution; overlapping events never suppress one another. */
export function updateGimmick(state: GameState): void {
  const stage = state.stage;
  if (!stage) return;
  const previous = new Map(state.gimmick.events.map((event) => [event.id, event.phase]));
  const events: GameState['gimmick']['events'] = [];
  let inset = 0;
  let scale = 1;
  let clearFraction = 1;
  let phase: GimmickPhase = 'idle';
  if (state.stagePhase === 'waves') for (const event of stage.gimmicks) {
    switch (event.kind) {
      case 'screen-shrink': {
        const current = shrinkAt(event, state.elapsed);
        if (current.phase === 'idle') continue;
        events.push({ id: event.id, ...current });
        inset += event.inset * current.amount;
        scale *= 1 - (1 - event.scale) * current.amount;
        clearFraction *= 1 - current.amount;
        if (PHASE_PRIORITY[current.phase] > PHASE_PRIORITY[phase]) phase = current.phase;
        if (previous.get(event.id) !== current.phase) {
          const cue: Record<Exclude<GimmickPhase, 'idle'>, string> = {
            warning: '画面縮小の予兆。安全な位置を見つけよう。',
            contracting: '戦場が縮んでいます。左右からの敵に注意。',
            active: '戦場が縮小中。狭い水路を抜けよう。',
            recovering: '戦場が元の広さに戻ります。',
          };
          state.eventMessage = cue[current.phase];
          state.eventUntil = state.elapsed + 3;
        }
        break;
      }
    }
  }
  // A narrow field remains navigable even if many effects are stacked at full strength.
  const base = stage.field;
  inset = Math.max(0, Math.min(inset, (Math.min(base.width, base.height) - 300) / 2));
  scale = Math.max(.5, scale);
  state.gimmick = { phase, amount: 1 - clearFraction, activeCount: events.length, events };
  state.field = { x: base.x + inset, y: base.y + inset,
    width: base.width - inset * 2, height: base.height - inset * 2 };
  state.view.scale = { x: scale, y: scale };
  state.view.offset = { x: GAME_CONFIG.layout.fieldWidth / 2 - (base.x + base.width / 2) * scale,
    y: GAME_CONFIG.layout.fieldHeight / 2 - (base.y + base.height / 2) * scale };
}
