import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '../game/core/Game';
import { GAME_CONFIG } from '../game/config';
import { getHudSnapshot } from '../game/core/GameState';
import { GameCanvas, type GameControls } from './components/GameCanvas';
import { LeftHud, RightHud } from './components/Hud';
import { DolphinIcon, ResetIcon } from './components/Icons';
import { INITIAL_GAMEPAD_STATUS } from '../game/systems/GamepadSystem';

export function App() {
  const [hud, setHud] = useState(() => getHudSnapshot(new Game().state));
  const [controls, setControls] = useState<GameControls | null>(null);
  const [controller, setController] = useState(INITIAL_GAMEPAD_STATUS);
  const controllerConnected = controller.kind === 'connected';
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
      <div className="header-right"><span className="prototype-badge"><span />PHASE 02 <i>/</i> 戦闘プロトタイプ</span><button className="reset-button" disabled={!controls} onClick={(event) => { controls?.reset(); event.currentTarget.blur(); }}><ResetIcon />リセット</button></div>
    </header>
    <div className="game-space" ref={availableSpace}>
      <div className="scaled-frame" style={{ width: 1280 * scale, height: 720 * scale }}>
        <div className="game-board" style={{ transform: `scale(${scale})` }}>
          <LeftHud hud={hud} controls={controls} controller={controller} />
          <section className={`play-field ${hud.slow ? 'focus-mode' : ''}`} aria-label="プレイ画面">
            <GameCanvas onSnapshot={setHud} onReady={acceptControls} onControllerChange={setController} />
            <div className="field-top"><span><span className="live-dot" />SUNLIGHT LAGOON</span><span>DEPTH <strong>012</strong> m</span></div>
            <div className="field-corner top-left" /><div className="field-corner top-right" /><div className="field-corner bottom-left" /><div className="field-corner bottom-right" />
            <div className="field-bottom"><span>X {Math.round(hud.position.x).toString().padStart(3, '0')} <i>/</i> Y {Math.round(hud.position.y).toString().padStart(3, '0')}</span><span>{hud.slow ? 'FOCUS · HOMING SHOT' : hud.mode === 'combat' ? 'COMBAT TRAINING' : 'SWIM AT YOUR OWN PACE'}<span className="small-wave">∿</span></span></div>
            {!controls && <div className="loading-note" role="status">海をひらいています<span>…</span></div>}
            {controls && hud.elapsed < 7 && !hud.paused && !hud.gameOver && <div className="swim-hint">{controllerConnected
              ? <><kbd>A / ×</kbd> でショット <span>·</span> <kbd>B / ○</kbd> / <kbd>LT・RT</kbd> で低速・追尾</>
              : <><kbd>Z</kbd> / <kbd>Space</kbd> でショット <span>·</span> <kbd>Shift</kbd> でゆっくり追尾</>}</div>}
            {hud.paused && !hud.gameOver && controls && <div className="pause-overlay"><div className="pause-dialog" role="dialog" aria-label="ポーズ中">
              <DolphinIcon /><span className="eyebrow">TAKE A LITTLE BREATH</span><h2>ひとやすみ。</h2><p>青い海は、待っていてくれる。</p>
              <button className="primary-button" onClick={(event) => { controls.resume(); event.currentTarget.blur(); }}>泳ぎを再開 <span>→</span></button><span className="resume-hint">{controllerConnected ? <><kbd>A / ×</kbd> / <kbd>Start</kbd> でも再開できます</> : <><kbd>Esc</kbd> でも再開できます</>}</span>
            </div></div>}
            {hud.gameOverReady && controls && <div className="pause-overlay"><div className="pause-dialog" role="dialog" aria-label="ゲームオーバー">
              <DolphinIcon /><span className="eyebrow">LET'S SWIM AGAIN</span><h2>もう一度、青の中へ。</h2><p>HPが0になりました。撃破数 {hud.defeatedCount}体</p>
              <button className="primary-button" onClick={(event) => { controls.reset(); event.currentTarget.blur(); }}>リトライ <span>→</span></button><span className="resume-hint">{controllerConnected ? <><kbd>A / ×</kbd> / <kbd>Start</kbd> でもリトライできます</> : 'HP・回復ゲージ・敵の配置を初期化します'}</span>
            </div></div>}
          </section>
          <RightHud hud={hud} controls={controls} controller={controller} />
        </div>
      </div>
    </div>
    <footer className="site-footer"><span><span className="footer-cross">+</span>A SMALL DOLPHIN. AN ENDLESS BLUE.</span><span className="controller-status" title={controller.name}>{controllerHint}<i>·</i> 音声なし <i>·</i> v0.2.0</span></footer>
  </main>;
}
