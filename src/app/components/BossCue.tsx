import type { HudSnapshot } from '../../game/core/GameState';

export function BossCue({ hud }: { hud: HudSnapshot }) {
  if (!hud.boss || hud.gameOver || hud.result) return null;
  if (hud.stagePhase === 'boss-intro') {
    const p = hud.bossIntroProgress;
    const opacity = Math.min(1, p * 6, (1 - p) * 6);
    return <div className="boss-cue arrival-cue" role="status" aria-label="ボス登場演出" style={{ opacity }}>
      <span className="cue-line" style={{ transform: `scaleX(${Math.min(1, p * 3)})` }} />
      <span className="eyebrow">GUARDIAN APPROACHING</span><h2>ラグーンの守り手、接近。</h2>
      <p>{hud.boss.name}</p><span className="cue-line" style={{ transform: `scaleX(${Math.min(1, p * 3)})` }} />
    </div>;
  }
  if (hud.boss.pendingPhase !== null) return <div className="boss-cue phase-cue" role="status" aria-label="フェーズ切替">
    <span className="eyebrow">PHASE {hud.boss.phase} CLEAR</span><h2>海流が、変わる。</h2>
    <p>弾をアイテムに変換・自動回収</p><span className="collection-count">{hud.boss.collected} / {hud.boss.collectionTotal} <i>·</i> BONUS +{hud.boss.collectionValue}</span>
    <span className="next-phase">NEXT · PHASE {hud.boss.pendingPhase}</span>
  </div>;
  if (hud.boss.announcing) return <div className="boss-cue phase-start-cue" role="status" aria-label="フェーズ開始">
    <span className="eyebrow">PHASE {hud.boss.phase}</span><h2>{hud.boss.phaseName}</h2>
  </div>;
  return null;
}
