import { GAME_CONFIG } from '../config';
import type { GameState } from '../core/GameState';

export type GimmickPhase = 'idle' | 'warning' | 'contracting' | 'active' | 'recovering';

const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Stage data sets the clock; Field and View change independently of world positions. */
export function updateGimmick(state: GameState): void {
  const stage = state.stage;
  const config = stage?.gimmick;
  if (!stage || !config || state.stagePhase !== 'waves') return;
  let phase: GimmickPhase = 'idle';
  let amount = 0;
  for (const window of config.windows) {
    const t = state.elapsed - window.at;
    if (t < 0) break;
    if (t < window.warning) { phase = 'warning'; break; }
    if (t < window.warning + window.contract) {
      phase = 'contracting'; amount = ease((t - window.warning) / window.contract); break;
    }
    if (t < window.warning + window.contract + window.hold) { phase = 'active'; amount = 1; break; }
    if (t < window.warning + window.contract + window.hold + window.recover) {
      phase = 'recovering'; amount = 1 - ease((t - window.warning - window.contract - window.hold) / window.recover);
      break;
    }
  }
  if (phase !== state.gimmick.phase) {
    if (phase === 'warning') state.eventMessage = '潮の圧力！ 画面と戦場が縮みます。中央へ寄ろう。';
    if (phase === 'contracting') state.eventMessage = '画面縮小中。左右からの敵に注意。';
    if (phase === 'active') state.eventMessage = '戦場が縮小中。狭い水路を抜けよう。';
    if (phase === 'recovering') state.eventMessage = '潮が引き、戦場が元に戻ります。';
    if (phase !== 'idle') state.eventUntil = state.elapsed + 3;
  }
  state.gimmick = { phase, amount };
  const base = stage.field;
  const inset = config.inset * amount;
  state.field = { x: base.x + inset, y: base.y + inset,
    width: base.width - inset * 2, height: base.height - inset * 2 };
  const scale = 1 - (1 - config.scale) * amount;
  state.view.scale = { x: scale, y: scale };
  state.view.offset = { x: GAME_CONFIG.layout.fieldWidth / 2 - (base.x + base.width / 2) * scale,
    y: GAME_CONFIG.layout.fieldHeight / 2 - (base.y + base.height / 2) * scale };
}
