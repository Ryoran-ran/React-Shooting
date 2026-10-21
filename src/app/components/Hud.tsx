import { GAME_CONFIG } from '../../game/config';
import type { HudSnapshot } from '../../game/core/GameState';
import { trainingGround } from '../../game/stages/trainingGround';
import type { GameControls } from './GameCanvas';
import { DolphinIcon, PauseIcon } from './Icons';

export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function Switch({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (enabled: boolean) => void }) {
  return <button className="switch-row" role="switch" aria-checked={checked} disabled={disabled}
    onClick={(event) => { onChange(!checked); event.currentTarget.blur(); }}>
    <span>{label}</span><span className={`switch ${checked ? 'on' : ''}`} aria-hidden="true"><span /></span>
  </button>;
}

export function LeftHud({ hud, controls }: { hud: HudSnapshot; controls: GameControls | null }) {
  return <aside className="info-panel left-panel" aria-label="プレイヤー情報">
    <div className="pilot-heading"><span className="eyebrow">YOUR PILOT</span><span className="tiny-code">D–01</span></div>
    <div className="pilot-identity"><div className="pilot-avatar"><DolphinIcon /></div><div><h2>Lumi<span>ルミ</span></h2><p>小さなひれで、大きな冒険へ。</p></div></div>
    <div className="panel-rule" />
    <div className="score-block"><span className="eyebrow">SCORE</span><div className="score-number">000<span>000</span></div><span className="subtle-note">操作テスト中 · スコア記録なし</span></div>
    <div className="health-block"><div className="stat-heading"><span className="eyebrow">HP</span><span className="stat-value">10 <small>/ 10</small></span></div>
      <div className="hp-segments" aria-label="HP 10 / 10">{Array.from({ length: 10 }, (_, index) => <span key={index} />)}</div>
    </div>
    <div className="heal-block"><div className="stat-heading"><span className="eyebrow">HEAL</span><span className="muted-value">0 <small>%</small></span></div><div className="heal-track" /><p className="subtle-note">回復システムは次の開発フェーズへ</p></div>
    <div className={`status-box ${hud.slow ? 'focused' : ''}`}><span className="eyebrow">STATUS</span><span><i />{hud.paused ? 'PAUSED' : hud.slow ? 'FOCUS' : 'NORMAL'}</span></div>
    <div className="best-score"><span className="eyebrow">BEST SCORE</span><span>—</span></div>
    <div className="controls-guide"><span className="eyebrow">HOW TO SWIM</span>
      <div><span><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><em>/ WASD</em></span><span>移動</span></div>
      <div><span><kbd>Z</kbd><em>/</em><kbd className="wide-key">Space</kbd></span><span>ショット</span></div>
      <div><span><kbd className="wide-key">Shift</kbd><em>長押し</em></span><span>低速・追尾</span></div>
      <div><span><kbd className="wide-key">Esc</kbd></span><span>ポーズ</span></div>
    </div>
    <button className="pause-button" disabled={!controls} onClick={(event) => { controls?.pause(); event.currentTarget.blur(); }}><PauseIcon paused={hud.paused} />{hud.paused ? '泳ぎを再開' : 'ひとやすみ'}<kbd>Esc</kbd></button>
  </aside>;
}

export function RightHud({ hud, controls }: { hud: HudSnapshot; controls: GameControls | null }) {
  const mode = hud.slow ? 'homing' : 'straight';
  const shot = GAME_CONFIG.shot[mode];
  return <aside className="info-panel right-panel" aria-label="トレーニング情報">
    <div className="pilot-heading"><span className="eyebrow">EXPLORE THE BLUE</span><span className="tiny-code">01</span></div>
    <div className="stage-heading"><span className="stage-number">01</span><div><span className="eyebrow">TRAINING AREA</span><h2>{trainingGround.name}</h2></div></div>
    <div className="free-swim"><span className="live-dot" />FREE SWIM<span>制限時間なし</span></div>
    <div className="panel-rule" />
    <div className="time-heading"><span className="eyebrow">TIME</span><span className="time-number">{formatTime(hud.elapsed)}</span></div>
    <div className="gimmick-row"><span className="eyebrow">GIMMICK</span><span>NONE <i>—</i></span></div>
    <div className={`shot-card ${hud.slow ? 'homing' : ''}`}>
      <div className="shot-card-label"><span className="eyebrow">SHOT MODE</span><span className="mode-dot" /></div>
      <div className="shot-mode-name"><span className="shot-symbol">{hud.slow ? '⌁' : '↑'}</span><div><h3>{hud.slow ? 'HOMING' : 'STRAIGHT'}</h3><span>{hud.slow ? 'ゆっくり、確実に。' : 'まっすぐ、青の先へ。'}</span></div></div>
      <div className="shot-spec"><span>POWER <strong>{shot.damage}</strong></span><span>INTERVAL <strong>{shot.interval.toFixed(2)}<small>s</small></strong></span></div>
      <p><kbd>Shift</kbd>{hud.slow ? 'を離すと直進ショット' : 'を押すと低速・追尾ショット'}</p>
    </div>
    <div className="practice-heading"><span className="eyebrow">PRACTICE SETTINGS</span><span>練習設定</span></div>
    <Switch label="ターゲットを表示" checked={hud.targetsEnabled} disabled={!controls} onChange={(enabled) => controls?.targets(enabled)} />
    <Switch label="ターゲットを動かす" checked={hud.targetsMoving} disabled={!controls || !hud.targetsEnabled} onChange={(enabled) => controls?.motion(enabled)} />
    <div className="event-box"><span className="eyebrow">FIELD NOTE</span><p>{hud.targetsEnabled ? <>クラゲに向かって撃ってみよう。<br />低速ショットは、進路を曲げて<br />ターゲットを追いかけます。</> : <>ターゲットのいない海では、<br />どちらのショットも正面へ。<br />自由に泳いでみよう。</>}</p><span className="subtle-note">練習用ターゲット · 当たり判定なし</span></div>
    <div className="telemetry"><span>SHOTS FIRED <strong>{String(hud.shotsFired).padStart(4, '0')}</strong></span><span>ON FIELD <strong>{String(hud.bulletCount).padStart(2, '0')}</strong></span></div>
    <div className="panel-bottom-note"><span className="live-dot" />ALL SYSTEMS CALM</div>
  </aside>;
}
