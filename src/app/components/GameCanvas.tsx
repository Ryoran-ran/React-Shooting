import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG } from '../../game/config';
import { Game } from '../../game/core/Game';
import { GameLoop } from '../../game/core/GameLoop';
import { getHudSnapshot, type GameMode, type HudSnapshot } from '../../game/core/GameState';
import { PixiRenderer } from '../../game/rendering/PixiRenderer';
import { combineInputs, InputSystem } from '../../game/systems/InputSystem';
import { GamepadSystem, INITIAL_GAMEPAD_STATUS, type GamepadStatus } from '../../game/systems/GamepadSystem';
import type { StageDefinition } from '../../game/stages/stages';
import { browserStorage, RecordStore, type SaveData } from '../../game/persistence/records';
import { backMenu, confirmMenu, moveMenuFocus } from '../menuInput';

export interface GameControls {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  targets: (enabled: boolean) => void;
  motion: (enabled: boolean) => void;
  mode: (mode: GameMode) => void;
  enemyAttacks: (enabled: boolean) => void;
  startStage: (stage: StageDefinition) => void;
}

interface Props {
  onSnapshot: (snapshot: HudSnapshot) => void;
  onReady: (controls: GameControls | null) => void;
  onControllerChange: (status: GamepadStatus) => void;
  onRecordsChange: (data: SaveData, available: boolean) => void;
  menuOpen: boolean;
  menuKey: string;
  recordRuns?: boolean;
}

export function GameCanvas({ onSnapshot, onReady, onControllerChange, onRecordsChange, menuOpen, menuKey, recordRuns = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const menu = useRef(menuOpen);
  const menuDirection = useRef(0);
  const clearInputs = useRef(() => {});
  useEffect(() => { menu.current = menuOpen; menuDirection.current = 0; clearInputs.current(); }, [menuOpen, menuKey]);

  useEffect(() => {
    if (!host.current) return;
    let cancelled = false;
    let detachInput: (() => void) | undefined;
    const game = new Game();
    const input = new InputSystem();
    const gamepad = new GamepadSystem();
    const records = new RecordStore(browserStorage());
    clearInputs.current = () => { input.clear(); gamepad.clear(); };
    let lastControllerStatus = INITIAL_GAMEPAD_STATUS;
    const renderer = new PixiRenderer();
    let lastHudTime = -1;
    let lastHudKey = '';
    let savedRun = -1;
    const publishRecords = () => onRecordsChange({ ...records.data, stages: { ...records.data.stages } }, records.available);
    const publish = () => {
      const snapshot = getHudSnapshot(game.state);
      lastHudKey = `${snapshot.gameOver}-${snapshot.gameOverReady}-${snapshot.clearCueReady}-${snapshot.clearReady}-${snapshot.stagePhase}-${snapshot.boss?.phase}`;
      if (recordRuns && snapshot.result && snapshot.runId !== savedRun) {
        savedRun = snapshot.runId; records.clear(snapshot.runId, snapshot.result); publishRecords();
      }
      onSnapshot(snapshot);
    };
    const loop = new GameLoop(
      (step) => { if (!menu.current) game.update(step, combineInputs(input.read(), gamepad.read())); },
      (alpha) => {
        renderer.render(game.state, alpha);
        const snapshot = getHudSnapshot(game.state);
        const key = `${snapshot.gameOver}-${snapshot.gameOverReady}-${snapshot.clearCueReady}-${snapshot.clearReady}-${snapshot.stagePhase}-${snapshot.boss?.phase}`;
        if (key !== lastHudKey
          || game.state.elapsed - lastHudTime >= GAME_CONFIG.ui.updateInterval) {
          lastHudTime = game.state.elapsed;
          publish();
        }
      },
      () => {
        const active = !document.hidden && document.hasFocus();
        const inMenu = menu.current || game.state.paused || game.state.gameOver || Boolean(game.state.result);
        const actions = gamepad.poll(active, inMenu);
        if (actions.disconnected && !menu.current) setPaused(true);
        if (active) {
          if (inMenu) {
            const direction = gamepad.readMenuDirection();
            if (direction && direction !== menuDirection.current) moveMenuFocus(direction);
            if (actions.backPressed) backMenu();
            menuDirection.current = direction;
            if (actions.confirmPressed || actions.pausePressed) confirmMenu();
          } else { menuDirection.current = 0; if (actions.pausePressed) controls.pause(); }
        }
        const status = gamepad.status;
        if (status.kind !== lastControllerStatus.kind || status.name !== lastControllerStatus.name || status.needsRelease !== lastControllerStatus.needsRelease) {
          lastControllerStatus = status;
          onControllerChange(status);
        }
      },
    );
    const setPaused = (paused: boolean) => {
      input.clear(); gamepad.clear(); game.setPaused(paused); loop.resetClock(); publish();
    };
    const controls: GameControls = {
      pause: () => setPaused(!game.state.paused),
      resume: () => setPaused(false),
      reset: () => {
        input.clear(); gamepad.clear(); game.reset(); lastHudTime = -1; loop.resetClock(); publish();
        if (recordRuns && game.state.stage) { records.start(game.state.stage.id); publishRecords(); }
      },
      targets: (enabled) => { game.setTargetsEnabled(enabled); publish(); },
      motion: (enabled) => { game.setTargetsMoving(enabled); publish(); },
      mode: (mode) => { input.clear(); gamepad.clear(); game.setMode(mode); lastHudTime = -1; loop.resetClock(); publish(); },
      enemyAttacks: (enabled) => { game.setEnemyAttacksEnabled(enabled); publish(); },
      startStage: (stage) => {
        input.clear(); gamepad.clear(); game.startStage(stage); lastHudTime = -1; loop.resetClock();
        if (recordRuns) { records.start(stage.id); publishRecords(); }
        publish();
      },
    };

    void renderer.init(host.current).then((ready) => {
      if (cancelled || !ready) return;
      detachInput = input.attach(window, document, () => { if (menu.current || game.state.result || game.state.gameOver) backMenu(); else controls.pause(); }, () => { if (!menu.current) setPaused(true); });
      // If initialization finished while the page was inactive, start safely paused.
      if (!menu.current && (document.hidden || !document.hasFocus())) game.setPaused(true);
      onReady(controls); publishRecords(); publish(); loop.start();
    }).catch((cause: unknown) => {
      if (!cancelled) { console.error('PixiJS initialization failed', cause); setError(true); }
    });

    return () => {
      cancelled = true; detachInput?.(); gamepad.clear(); loop.stop(); renderer.destroy(); onReady(null); onControllerChange(INITIAL_GAMEPAD_STATUS);
    };
  }, [onSnapshot, onReady, onControllerChange, onRecordsChange, recordRuns]);

  return <div className="canvas-host" ref={host}>
    {error && <div className="canvas-error" role="alert">
      <strong>海を描画できませんでした</strong>
      <p>ブラウザのハードウェアアクセラレーションを有効にして、再読み込みしてください。</p>
      <button className="primary-button" onClick={() => window.location.reload()}>再読み込み</button>
    </div>}
  </div>;
}
