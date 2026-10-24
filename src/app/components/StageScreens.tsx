import type { HudSnapshot } from '../../game/core/GameState';
import type { StageDefinition } from '../../game/stages/stages';
import { getPlayableStages } from '../../game/stages/stageDraft';
import type { SaveData } from '../../game/persistence/records';
import { DolphinIcon } from './Icons';
import { formatTime } from './Hud';

interface Props {
  screen: 'title' | 'select' | 'play';
  hud: HudSnapshot;
  records: SaveData;
  storageAvailable: boolean;
  ready: boolean;
  onSelect: () => void;
  onTitle: () => void;
  onStart: (stage: StageDefinition) => void;
  onPractice: (combat: boolean) => void;
  onEditor: () => void;
  onRetry: () => void;
}

export function StageScreens({ screen, hud, records, storageAvailable, ready, onSelect, onTitle, onStart, onPractice, onEditor, onRetry }: Props) {
  if (screen === 'title') return <div className="screen-overlay title-screen" role="dialog" aria-label="タイトル">
    <span className="eyebrow">A SMALL DOLPHIN. AN ENDLESS BLUE.</span>
    <div className="title-emblem"><DolphinIcon /><span /><i /></div>
    <h2>BLUE<br /><em>CURRENT</em></h2><p className="title-tagline">イルカと、青の向こうへ。</p>
    <button data-menu className="primary-button" disabled={!ready} onClick={onSelect}>冒険をはじめる <span>→</span></button>
    <div className="title-practice"><button data-menu disabled={!ready} onClick={() => onPractice(true)}>戦闘練習<span aria-hidden="true">→</span></button><button data-menu disabled={!ready} onClick={() => onPractice(false)}>操作練習<span aria-hidden="true">→</span></button><button data-menu onClick={onEditor}>STAGE EDITOR <span aria-hidden="true">&rarr;</span></button></div>
    <span className="menu-help">↑↓ 選択 · Enter / Z / A・× 決定</span>
  </div>;
  if (screen === 'select') return <div className="screen-overlay select-screen" role="dialog" aria-label="ステージ選択">
    <span className="eyebrow">CHOOSE YOUR CURRENT</span><h2>どこへ泳ごう。</h2><p>好きな海から、冒険をはじめよう。</p>
    <div className="stage-list">{getPlayableStages().map((stage, index) => {
      const record = records.stages[stage.id];
      return <button data-menu className="stage-choice" key={stage.id} onClick={() => onStart(stage)}>
        <span className="stage-choice-top"><span>STAGE {String(index + 1).padStart(2, '0')}</span><span>{record?.cleared ? `${record.bestRank} · CLEAR` : 'NEW VOYAGE'}</span></span>
        <strong>{stage.name}</strong><span className="stage-description">{stage.description}</span>
        <span className="stage-choice-stats"><span>BEST {record?.cleared ? record.bestScore.toLocaleString() : '—'}</span><span>{record?.cleared ? `最速 ${formatTime(record.fastestTime ?? 0)}${record.noMiss ? ' · NO MISS' : ''}` : `道中 最大約${stage.progression.bossAt}秒 + ボス戦`}</span></span>
        <span className="stage-choice-bottom">{record?.plays ?? 0} PLAY / {record?.clears ?? 0} CLEAR <span>出航する →</span></span>
      </button>;
    })}</div>
    <p className="record-note">{storageAvailable ? 'クリア時にスコア・評価・最速タイムを記録します。' : 'このブラウザでは保存できません。今回の記録はページ内で保持します。'}</p>
    <button data-menu data-back className="text-button" onClick={onTitle}>← タイトルへ</button><span className="menu-help">↑↓ 選択 · Enter / A・× 決定 · Esc / B・○ 戻る</span>
  </div>;
  if (!hud.clearReady || !hud.result) return null;
  const result = hud.result;
  return <div className="screen-overlay result-screen" role="dialog" aria-label="リザルト">
    <span className="eyebrow">STAGE {hud.stageId.slice(-2)} · {hud.stageScene?.label}</span><h2>{hud.stageScene?.clear}</h2>
    <div className="result-rank"><span>RANK</span><strong>{result.rank}</strong><span>{result.hitsTaken === 0 ? 'NO MISS CLEAR' : 'STAGE CLEAR'}</span></div>
    <div className="result-score"><span>TOTAL SCORE</span><strong>{result.score.toLocaleString()}</strong></div>
    <dl className="result-breakdown"><div><dt>戦闘・回収スコア</dt><dd>{result.combatScore.toLocaleString()}</dd></div><div><dt>クリアボーナス</dt><dd>+{result.clearBonus.toLocaleString()}</dd></div><div><dt>残HP {result.hp} × 1,000</dt><dd>+{result.hpBonus.toLocaleString()}</dd></div><div><dt>ノーミス</dt><dd>+{result.noMissBonus.toLocaleString()}</dd></div><div><dt>TIME / 撃破数</dt><dd>{formatTime(result.elapsed)} / {result.defeatedCount}体</dd></div></dl>
    <p className="record-note">{storageAvailable ? `記録しました · BEST ${(records.stages[result.stageId]?.bestScore ?? result.score).toLocaleString()}` : '保存できませんでした。今回の記録はページ内で保持します。'}</p>
    <div className="result-actions"><button data-menu data-back className="primary-button" onClick={onSelect}>ステージ選択へ <span>→</span></button><button data-menu className="text-button" onClick={onRetry}>もう一度挑戦</button></div>
  </div>;
}
