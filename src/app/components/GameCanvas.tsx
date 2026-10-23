import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG } from '../../game/config';
import { Game } from '../../game/core/Game';
import { GameLoop } from '../../game/core/GameLoop';
import { getHudSnapshot, type GameMode, type HudSnapshot } from '../../game/core/GameState';
import { PixiRenderer } from '../../game/rendering/PixiRenderer';
import { InputSystem } from '../../game/systems/InputSystem';

export interface GameControls {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  targets: (enabled: boolean) => void;
  motion: (enabled: boolean) => void;
  mode: (mode: GameMode) => void;
  enemyAttacks: (enabled: boolean) => void;
}

interface Props {
  onSnapshot: (snapshot: HudSnapshot) => void;
  onReady: (controls: GameControls | null) => void;
}

export function GameCanvas({ onSnapshot, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    let detachInput: (() => void) | undefined;
    const game = new Game();
    const input = new InputSystem();
    const renderer = new PixiRenderer();
    let lastHudTime = -1;
    let lastGameOver = false;
    let lastGameOverReady = false;
    const publish = () => {
      const snapshot = getHudSnapshot(game.state);
      lastGameOver = snapshot.gameOver;
      lastGameOverReady = snapshot.gameOverReady;
      onSnapshot(snapshot);
    };
    const loop = new GameLoop(
      (step) => game.update(step, input.read()),
      (alpha) => {
        renderer.render(game.state, alpha);
        const gameOverReady = game.state.gameOver && game.state.gameOverElapsed >= GAME_CONFIG.defeat.duration;
        if (game.state.gameOver !== lastGameOver || gameOverReady !== lastGameOverReady
          || game.state.elapsed - lastHudTime >= GAME_CONFIG.ui.updateInterval) {
          lastHudTime = game.state.elapsed;
          publish();
        }
      },
    );
    const setPaused = (paused: boolean) => {
      input.clear(); game.setPaused(paused); loop.resetClock(); publish();
    };
    const controls: GameControls = {
      pause: () => setPaused(!game.state.paused),
      resume: () => setPaused(false),
      reset: () => {
        input.clear(); game.reset(); lastHudTime = -1; loop.resetClock(); publish();
      },
      targets: (enabled) => { game.setTargetsEnabled(enabled); publish(); },
      motion: (enabled) => { game.setTargetsMoving(enabled); publish(); },
      mode: (mode) => { input.clear(); game.setMode(mode); lastHudTime = -1; loop.resetClock(); publish(); },
      enemyAttacks: (enabled) => { game.setEnemyAttacksEnabled(enabled); publish(); },
    };

    void renderer.init(host.current).then((ready) => {
      if (cancelled || !ready) return;
      detachInput = input.attach(window, document, controls.pause, () => setPaused(true));
      // If initialization finished while the page was inactive, start safely paused.
      if (document.hidden || !document.hasFocus()) game.setPaused(true);
      onReady(controls); publish(); loop.start();
    }).catch((cause: unknown) => {
      if (!cancelled) { console.error('PixiJS initialization failed', cause); setError(true); }
    });

    return () => {
      cancelled = true; detachInput?.(); loop.stop(); renderer.destroy(); onReady(null);
    };
  }, [onSnapshot, onReady]);

  return <div className="canvas-host" ref={host}>
    {error && <div className="canvas-error" role="alert">
      <strong>海を描画できませんでした</strong>
      <p>ブラウザのハードウェアアクセラレーションを有効にして、再読み込みしてください。</p>
      <button className="primary-button" onClick={() => window.location.reload()}>再読み込み</button>
    </div>}
  </div>;
}
