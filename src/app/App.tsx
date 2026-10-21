import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '../game/core/Game';
import { GAME_CONFIG } from '../game/config';
import { getHudSnapshot } from '../game/core/GameState';
import { GameCanvas, type GameControls } from './components/GameCanvas';
import { LeftHud, RightHud } from './components/Hud';
import { DolphinIcon, ResetIcon } from './components/Icons';

export function App() {
  const [hud, setHud] = useState(() => getHudSnapshot(new Game().state));
  const [controls, setControls] = useState<GameControls | null>(null);
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
      <div className="header-right"><span className="prototype-badge"><span />PHASE 01 <i>/</i> 操作プロトタイプ</span><button className="reset-button" disabled={!controls} onClick={(event) => { controls?.reset(); event.currentTarget.blur(); }}><ResetIcon />リセット</button></div>
    </header>
    <div className="game-space" ref={availableSpace}>
      <div className="scaled-frame" style={{ width: 1280 * scale, height: 720 * scale }}>
        <div className="game-board" style={{ transform: `scale(${scale})` }}>
          <LeftHud hud={hud} controls={controls} />
          <section className={`play-field ${hud.slow ? 'focus-mode' : ''}`} aria-label="プレイ画面">
            <GameCanvas onSnapshot={setHud} onReady={acceptControls} />
            <div className="field-top"><span><span className="live-dot" />SUNLIGHT LAGOON</span><span>DEPTH <strong>012</strong> m</span></div>
            <div className="field-corner top-left" /><div className="field-corner top-right" /><div className="field-corner bottom-left" /><div className="field-corner bottom-right" />
            <div className="field-bottom"><span>X {Math.round(hud.position.x).toString().padStart(3, '0')} <i>/</i> Y {Math.round(hud.position.y).toString().padStart(3, '0')}</span><span>{hud.slow ? 'FOCUS · HOMING SHOT' : 'SWIM AT YOUR OWN PACE'}<span className="small-wave">∿</span></span></div>
            {!controls && <div className="loading-note" role="status">海をひらいています<span>…</span></div>}
            {controls && hud.elapsed < 7 && !hud.paused && <div className="swim-hint"><kbd>Z</kbd> / <kbd>Space</kbd> でショット <span>·</span> <kbd>Shift</kbd> でゆっくり追尾</div>}
            {hud.paused && controls && <div className="pause-overlay"><div className="pause-dialog" role="dialog" aria-label="ポーズ中">
              <DolphinIcon /><span className="eyebrow">TAKE A LITTLE BREATH</span><h2>ひとやすみ。</h2><p>青い海は、待っていてくれる。</p>
              <button className="primary-button" onClick={(event) => { controls.resume(); event.currentTarget.blur(); }}>泳ぎを再開 <span>→</span></button><span className="resume-hint"><kbd>Esc</kbd> でも再開できます</span>
            </div></div>}
          </section>
          <RightHud hud={hud} controls={controls} />
        </div>
      </div>
    </div>
    <footer className="site-footer"><span><span className="footer-cross">+</span>A SMALL DOLPHIN. AN ENDLESS BLUE.</span><span>キーボードで操作 <i>·</i> 音声なし <i>·</i> v0.1.0</span></footer>
  </main>;
}
