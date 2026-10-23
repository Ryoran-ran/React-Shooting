import { GAME_CONFIG } from '../../game/config';
import type { HudSnapshot } from '../../game/core/GameState';
import type { GameControls } from './GameCanvas';
import { DolphinIcon, PauseIcon } from './Icons';
import type { GamepadStatus } from '../../game/systems/GamepadSystem';

export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function Switch({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (enabled: boolean) => void }) {
  return <button className="switch-row" role="switch" aria-checked={checked} disabled={disabled}
    onClick={(event) => { onChange(!checked); event.currentTarget.blur(); }}>
    <span>{label}</span><span className={`switch ${checked ? 'on' : ''}`} aria-hidden="true"><span /></span>
  </button>;
}

interface HudProps { hud: HudSnapshot; controls: GameControls | null; controller: GamepadStatus; bestScore?: number }

export function LeftHud({ hud, controls, controller, bestScore }: HudProps) {
  const pad = controller.kind === 'connected';
  return <aside className="info-panel left-panel" aria-label="プレイヤー情報">
    <div className="pilot-heading"><span className="eyebrow">YOUR PILOT</span><span className="tiny-code">D–01</span></div>
    <div className="pilot-identity"><div className="pilot-avatar"><DolphinIcon /></div><div><h2>Lumi<span>ルミ</span></h2><p>小さなひれで、大きな冒険へ。</p></div></div>
    <div className="panel-rule" />
    <div className="score-block"><span className="eyebrow">SCORE</span><div className="score-number">{String(hud.score).padStart(6, '0')}</div><span className="subtle-note">撃破 {hud.defeatedCount}体 · {hud.mode === 'stage' ? 'クリア時に記録' : '練習 · 記録対象外'}</span></div>
    <div className="health-block"><div className="stat-heading"><span className="eyebrow">HP</span><span className="stat-value">{hud.hp} <small>/ {GAME_CONFIG.player.maxHp}</small></span></div>
      <div className="hp-segments" aria-label={`HP ${hud.hp} / ${GAME_CONFIG.player.maxHp}`}>{Array.from({ length: GAME_CONFIG.player.maxHp }, (_, index) => <span className={index < hud.hp ? '' : 'empty'} key={index} />)}</div>
    </div>
    <div className="heal-block"><div className="stat-heading"><span className="eyebrow">HEAL</span><span className="muted-value">{hud.heal} <small>%</small></span></div><div className="heal-track" role="progressbar" aria-label="回復ゲージ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hud.heal}><span style={{ width: `${hud.heal}%` }} /></div><p className="subtle-note">緑のアイテムで +20 · 100でHPを1回復</p></div>
    <div className={`status-box ${hud.hit || hud.gameOver ? 'damaged' : hud.slow ? 'focused' : ''}`}><span className="eyebrow">STATUS</span><span><i />{hud.result ? 'CLEAR' : hud.gameOver ? 'DOWN' : hud.paused ? 'PAUSED' : hud.hit ? 'HIT' : hud.invulnerable ? 'INVINCIBLE' : hud.slow ? 'FOCUS' : 'NORMAL'}</span></div>
    <div className="best-score"><span className="eyebrow">BEST SCORE</span><span>{bestScore ? bestScore.toLocaleString() : '—'}</span></div>
    <div className="controls-guide"><span className="eyebrow">HOW TO SWIM <span className="input-source" title={controller.name}>{pad ? 'PAD' : 'KEYBOARD'}</span></span>
      {pad ? <>
        <div><span><kbd className="wide-key">L</kbd><em>/ 十字キー</em></span><span>移動</span></div>
        <div><span><kbd className="wide-key">A / ×</kbd><em>下ボタン</em></span><span>ショット</span></div>
        <div><span><kbd className="wide-key">L / R</kbd><em>LB・RB / L1・R1</em></span><span>低速・追尾</span></div>
        <div><span><kbd className="wide-key">Start</kbd><em>/ Options</em></span><span>ポーズ</span></div>
      </> : <>
      <div><span><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><em>/ WASD</em></span><span>移動</span></div>
      <div><span><kbd>Z</kbd><em>/</em><kbd className="wide-key">Space</kbd></span><span>ショット</span></div>
      <div><span><kbd className="wide-key">Shift</kbd><em>長押し</em></span><span>低速・追尾</span></div>
      <div><span><kbd className="wide-key">Esc</kbd></span><span>ポーズ</span></div>
      </>}
    </div>
    <button className="pause-button" disabled={!controls || hud.gameOver || Boolean(hud.result)} onClick={(event) => { controls?.pause(); event.currentTarget.blur(); }}><PauseIcon paused={hud.paused} />{hud.paused ? '泳ぎを再開' : 'ひとやすみ'}<kbd>{pad ? 'Start' : 'Esc'}</kbd></button>
  </aside>;
}

export function RightHud({ hud, controls, controller }: HudProps) {
  const pad = controller.kind === 'connected';
  const mode = hud.slow ? 'homing' : 'straight';
  const shot = GAME_CONFIG.shot[mode];
  const stage = hud.mode === 'stage';
  const bossState = hud.boss ? hud.boss.pendingPhase !== null ? `アイテム回収中 → PHASE ${hud.boss.pendingPhase}`
    : `${hud.boss.invulnerable ? '登場準備 · ' : hud.boss.laserActive ? 'レーザー · ' : ''}PHASE ${hud.boss.phase}/${hud.boss.phaseCount} · ${hud.boss.phaseName}`
    : hud.result ? 'ラグーンを突破しました' : 'ラグーンの守り手が待っています';
  return <aside className={`info-panel right-panel ${stage ? 'stage-panel' : ''}`} aria-label="ステージ情報">
    <div className="pilot-heading"><span className="eyebrow">EXPLORE THE BLUE</span><span className="tiny-code">01</span></div>
    <div className="stage-heading"><span className="stage-number">01</span><div><span className="eyebrow">{stage ? 'STAGE' : 'TRAINING AREA'}</span><h2>{hud.stageName}</h2></div></div>
    <div className="free-swim"><span className="live-dot" />{stage ? hud.result ? 'STAGE CLEAR' : hud.boss ? 'BOSS BATTLE' : 'VOYAGE' : hud.mode === 'combat' ? 'COMBAT TRAINING' : 'FREE SWIM'}<span>{stage ? `${Math.floor(hud.progress)}%` : hud.mode === 'combat' ? `WAVE ${String(hud.cycle).padStart(2, '0')}` : '制限時間なし'}</span></div>
    {stage && <div className="stage-progress" role="progressbar" aria-label="ステージ進行率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(hud.progress)}><span style={{ width: `${hud.progress}%` }} /></div>}
    <div className="panel-rule" />
    <div className="time-heading"><span className="eyebrow">TIME</span><span className="time-number">{formatTime(hud.elapsed)}</span></div>
    <div className="gimmick-row"><span className="eyebrow">GIMMICK</span><span>NONE <i>—</i></span></div>
    {stage && <div className="boss-card"><div className="stat-heading"><span className="eyebrow">BOSS HP</span><span>{hud.boss ? `${hud.boss.hp} / ${hud.boss.maxHp}` : '—'}</span></div><div className="boss-health" role="progressbar" aria-label="ボスHP" aria-valuemin={0} aria-valuemax={hud.boss?.maxHp ?? 1} aria-valuenow={hud.boss?.hp ?? 0}><span style={{ width: `${hud.boss ? hud.boss.hp / hud.boss.maxHp * 100 : 0}%` }} /></div><p>{bossState}</p></div>}
    <div className={`shot-card ${hud.slow ? 'homing' : ''}`}>
      <div className="shot-card-label"><span className="eyebrow">SHOT MODE</span><span className="mode-dot" /></div>
      <div className="shot-mode-name"><span className="shot-symbol">{hud.slow ? '⌁' : '↑'}</span><div><h3>{hud.slow ? 'HOMING' : 'STRAIGHT'}</h3><span>{hud.slow ? 'ゆっくり、確実に。' : 'まっすぐ、青の先へ。'}</span></div></div>
      <div className="shot-spec"><span>POWER <strong>{shot.damage}</strong></span><span>INTERVAL <strong>{shot.interval.toFixed(2)}<small>s</small></strong></span></div>
      <p><kbd>{pad ? 'L / R' : 'Shift'}</kbd>{hud.slow ? 'を離すと直進ショット' : 'を押すと低速・追尾ショット'}</p>
    </div>
    {!stage && <><div className="practice-heading"><span className="eyebrow">PRACTICE SETTINGS</span><span>切替時にリセット</span></div>
    <Switch label="敵との戦闘" checked={hud.mode === 'combat'} disabled={!controls} onChange={(enabled) => controls?.mode(enabled ? 'combat' : 'practice')} />
    {hud.mode === 'combat' ? <Switch label="敵の攻撃" checked={hud.enemyAttacksEnabled} disabled={!controls || hud.gameOver} onChange={(enabled) => controls?.enemyAttacks(enabled)} /> : <>
      <Switch label="ターゲットを表示" checked={hud.targetsEnabled} disabled={!controls} onChange={(enabled) => controls?.targets(enabled)} />
      <Switch label="ターゲットを動かす" checked={hud.targetsMoving} disabled={!controls || !hud.targetsEnabled} onChange={(enabled) => controls?.motion(enabled)} />
    </>}</>}
    <div className="event-box"><span className="eyebrow">{hud.mode !== 'practice' ? 'BATTLE LOG' : 'FIELD NOTE'}</span><p>{hud.mode !== 'practice'
      ? hud.gameOver ? 'HPが0になりました。リトライで、もう一度挑戦できます。' : hud.eventMessage || '赤い弾と予兆線に注意。緑の回復アイテムを集めながら、敵を迎え撃とう。'
      : hud.targetsEnabled ? <>クラゲに向かって撃ってみよう。<br />{pad ? 'L / Rで低速・追尾ショット。' : 'Shiftで低速・追尾ショット。'}</> : <>どちらのショットも正面へ。<br />自由に泳いでみよう。</>}</p><span className="subtle-note">{hud.result ? 'リザルトから再挑戦できます' : hud.mode !== 'practice' ? '敵本体にも接触判定があります' : '練習用ターゲット · 当たり判定なし'}</span></div>
    <div className="telemetry"><span>SHOTS FIRED <strong>{String(hud.shotsFired).padStart(4, '0')}</strong></span><span>{hud.mode !== 'practice' ? 'DEFEATED' : 'ON FIELD'} <strong>{String(hud.mode !== 'practice' ? hud.defeatedCount : hud.bulletCount).padStart(2, '0')}</strong></span></div>
    <div className="panel-bottom-note"><span className="live-dot" />{hud.mode !== 'practice' ? `HOSTILE SHOTS ${hud.hostileCount} · ENEMIES ${hud.enemyCount}` : 'ALL SYSTEMS CALM'}</div>
  </aside>;
}
