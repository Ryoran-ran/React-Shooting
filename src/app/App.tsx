import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Game } from '../game/core/Game';
import { GAME_CONFIG } from '../game/config';
import { getHudSnapshot } from '../game/core/GameState';
import { GameCanvas, type GameControls } from './components/GameCanvas';
import { LeftHud, RightHud } from './components/Hud';
import { DolphinIcon, ResetIcon } from './components/Icons';
import { INITIAL_GAMEPAD_STATUS } from '../game/systems/GamepadSystem';
import { browserStorage, readRecords, type SaveData } from '../game/persistence/records';
import { StageScreens } from './components/StageScreens';
import type { StageDefinition } from '../game/stages/stages';
import { backMenu, confirmMenu, menuButtons, moveMenuFocus } from './menuInput';
import { BossCue } from './components/BossCue';

export function App() {
  const [hud, setHud] = useState(() => getHudSnapshot(new Game().state));
  const [controls, setControls] = useState<GameControls | null>(null);
  const [controller, setController] = useState(INITIAL_GAMEPAD_STATUS);
  const [screen, setScreen] = useState<'title' | 'select' | 'play'>('title');
  const [records, setRecords] = useState(() => readRecords(browserStorage()));
  const [storageAvailable, setStorageAvailable] = useState(true);
  const acceptRecords = useCallback((data: SaveData, available: boolean) => { setRecords(data); setStorageAvailable(available); }, []);
  const overlayKey = screen !== 'play' ? screen : hud.paused ? 'pause' : hud.gameOverReady ? 'over' : hud.clearReady ? 'result' : hud.result ? 'clear' : hud.gameOver ? 'fall' : 'playing';
  const showInfo = screen === 'play' && !hud.clearReady;
  useEffect(() => { menuButtons()[0]?.focus(); }, [overlayKey, controls]);
  const blur = () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
  const selectStage = () => { setScreen('select'); blur(); };
  const startStage = (stage: StageDefinition) => { controls?.startStage(stage); setScreen('play'); blur(); };
  const practice = (combat: boolean) => { controls?.mode(combat ? 'combat' : 'practice'); setScreen('play'); blur(); };
  const menuKeyboard = (event: KeyboardEvent) => {
    if (!menuButtons().length || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) moveMenuFocus(['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'].includes(event.code) ? 1 : -1);
    } else if (['Enter', 'Space', 'KeyZ'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation(); if (!event.repeat) confirmMenu();
    } else if (event.code === 'Escape' && (screen !== 'play' || hud.gameOver || hud.result)) {
      event.preventDefault(); event.stopPropagation(); if (!event.repeat) backMenu();
    }
  };
  const controllerConnected = controller.kind === 'connected';
  const stageNumber = hud.stageId ? hud.stageId.slice(-2) : '01';
  const controllerHint = controllerConnected
    ? controller.needsRelease ? 'スティックとボタンを一度離してください' : 'コントローラー接続済み'
    : controller.kind === 'unsupported' ? 'このパッドの配置は未対応 · キーボードで操作できます'
    : controller.kind === 'unavailable' ? 'キーボードで操作'
    : 'パッドは接続後にボタンを押すと認識します';
  const [scale, setScale] = useState(1);
  const availableSpace = useRef<HTMLDivElement>(null);
  const acceptControls = useCallback((value: GameControls | null) => setControls(value), []);

  useEffect(() => {
    const host = availableSpace.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(entry.contentRect.width / GAME_CONFIG.layout.width, entry.contentRect.height / GAME_CONFIG.layout.height));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return <main className="app-shell">
    <header className="site-header"><div className="brand"><div className="brand-icon"><DolphinIcon /></div><div><h1>BLUE CURRENT<span>イルカと、青の向こうへ。</span></h1></div></div>
      <div className="header-right"><span className="prototype-badge"><span />2 STAGES <i>/</i> 画面縮小ギミック</span><button className="reset-button" disabled={!controls} onClick={(event) => { if (screen === 'play') controls?.reset(); else setScreen('title'); event.currentTarget.blur(); }}><ResetIcon />リセット</button></div>
    </header>
    <div className="game-space" ref={availableSpace}>
      <div className="scaled-frame" style={{ width: 1280 * scale, height: 720 * scale }}>
        <div className={`game-board ${showInfo ? '' : 'menu-board'}`} style={{ transform: `scale(${scale})` }} onKeyDownCapture={menuKeyboard}>
          {showInfo && <LeftHud hud={hud} controls={controls} controller={controller} bestScore={records.stages[hud.stageId || 'stage-01']?.bestScore} />}
          <section className={`play-field ${hud.slow ? 'focus-mode' : ''} ${hud.hit && screen === 'play' ? 'hit-state' : ''}`} aria-label="プレイ画面">
            <GameCanvas onSnapshot={setHud} onReady={acceptControls} onControllerChange={setController} onRecordsChange={acceptRecords} menuOpen={screen !== 'play'} menuKey={overlayKey} />
            <div className="field-top"><span><span className="live-dot" />{hud.boss && hud.stageScene?.boss === 'beach' ? hud.stageScene.bossLabel : hud.stageScene?.label ?? 'SUNLIGHT LAGOON'}</span><span>DEPTH <strong>{hud.boss && hud.stageScene?.boss === 'beach' ? '000' : hud.stageScene?.depth ?? '012'}</strong> m</span></div>
            <div className="field-corner top-left" /><div className="field-corner top-right" /><div className="field-corner bottom-left" /><div className="field-corner bottom-right" />
            <div className="field-bottom"><span>X {Math.round(hud.position.x).toString().padStart(3, '0')} <i>/</i> Y {Math.round(hud.position.y).toString().padStart(3, '0')}</span><span>{hud.slow ? 'FOCUS · HOMING SHOT' : hud.mode === 'stage' ? hud.boss ? hud.stageScene?.bossLabel : `STAGE ${stageNumber}` : hud.mode === 'combat' ? 'COMBAT TRAINING' : 'SWIM AT YOUR OWN PACE'}<span className="small-wave">∿</span></span></div>
            {!controls && <div className="loading-note" role="status">海をひらいています<span>…</span></div>}
            {screen === 'play' && controls && hud.elapsed < 7 && !hud.paused && !hud.gameOver && <div className="swim-hint">{controllerConnected
              ? <><kbd>A / ×</kbd> でショット <span>·</span> <kbd>L / R</kbd> で低速・追尾</>
              : <><kbd>Z</kbd> / <kbd>Space</kbd> でショット <span>·</span> <kbd>Shift</kbd> でゆっくり追尾</>}</div>}
            {screen === 'play' && hud.paused && !hud.gameOver && controls && <div className="pause-overlay"><div className="pause-dialog" role="dialog" aria-label="ポーズ中">
              <DolphinIcon /><span className="eyebrow">TAKE A LITTLE BREATH</span><h2>ひとやすみ。</h2><p>青い海は、待っていてくれる。</p>
              <button data-menu className="primary-button" onClick={(event) => { controls.resume(); event.currentTarget.blur(); }}>泳ぎを再開 <span>→</span></button><span className="resume-hint">{controllerConnected ? <><kbd>A / ×</kbd> / <kbd>Start</kbd> でも再開できます</> : <><kbd>Esc</kbd> でも再開できます</>}</span><button data-menu data-back className="text-button" onClick={selectStage}>ステージ選択へ戻る</button>
            </div></div>}
            {screen === 'play' && hud.gameOverReady && controls && <div className="pause-overlay"><div className="pause-dialog" role="dialog" aria-label="ゲームオーバー">
              <DolphinIcon /><span className="eyebrow">LET'S SWIM AGAIN</span><h2>もう一度、青の中へ。</h2><p>HPが0になりました。撃破数 {hud.defeatedCount}体</p>
              <p className="failure-score">SCORE {hud.score.toLocaleString()} · 記録対象外</p><button data-menu className="primary-button" onClick={(event) => { controls.reset(); event.currentTarget.blur(); }}>リトライ <span>→</span></button><span className="resume-hint">{controllerConnected ? <><kbd>A / ×</kbd> / <kbd>Start</kbd> でもリトライできます</> : 'HP・回復ゲージ・敵の配置を初期化します'}</span><button data-menu data-back className="text-button" onClick={selectStage}>ステージ選択へ戻る</button>
            </div></div>}
            {screen === 'play' && hud.clearCueReady && !hud.clearReady && <div className="clear-banner" role="status" aria-label="ステージクリア演出"><small>GUARDIAN DEFEATED · {hud.stageName}</small><span>STAGE CLEAR</span><strong>{hud.stageScene?.clear}</strong></div>}
            {screen === 'play' && <BossCue hud={hud} />}
            <StageScreens screen={screen} hud={hud} records={records} storageAvailable={storageAvailable} ready={Boolean(controls)} onSelect={selectStage} onTitle={() => setScreen('title')} onStart={startStage} onPractice={practice} onRetry={() => { controls?.reset(); blur(); }} />
          </section>
          {showInfo && <RightHud hud={hud} controls={controls} controller={controller} />}
        </div>
      </div>
    </div>
    <footer className="site-footer"><span><span className="footer-cross">+</span>A SMALL DOLPHIN. AN ENDLESS BLUE.</span><span className="controller-status" title={controller.name}>{controllerHint}<i>·</i> 音声なし <i>·</i> v0.6.0</span></footer>
  </main>;
}
