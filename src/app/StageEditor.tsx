import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Game } from '../game/core/Game';
import { getHudSnapshot } from '../game/core/GameState';
import { ENEMY_DEFINITIONS } from '../data/enemies';
import type { EnemyAttack, EnemyMotion, EnemySpawn } from '../game/entities/Enemy';
import { STAGES, type StageDefinition } from '../game/stages/stages';
import { gimmickDuration, type GimmickEvent } from '../game/stages/gimmicks';
import { compileStageDraft, createStageDraft, loadStageDraft, parseStageDraft, saveStageDraft, type DraftSpawn, type StageDraft } from '../game/stages/stageDraft';
import { GameCanvas, type GameControls } from './components/GameCanvas';
import { EnemyPortrait } from './components/EnemyPortrait';
import { FormationPreview } from './components/FormationPreview';
import { getRouteGoal, moveRouteHandle, routePoints, routeTiming, setRouteGoal, setRouteOrigin, setRouteSpawnTime, shiftRouteTime,
  snapRoutePoint, ROUTE_PREVIEW_SECONDS, ROUTE_VIEW_MAX, ROUTE_VIEW_MIN, type RouteHandle } from './editorRoute';
import { arrangeGroup, createGroup, formationGoal, formationStartCenter, groupEnd, groupMembers, groupNearby, groupStart,
  moveGroup, moveGroupStarts, moveMember, moveMemberStart, moveMemberRoute, planFormationLayout, removeEmptyGroups, shiftGroupTime, ungroup, upgradeFormationOrigins,
  type FormationPattern } from './editorGroups';
import './editor.css';

const NO_RECORD_CHANGE = () => {};
const NO_CONTROLLER_CHANGE = () => {};
const kinds = ['small', 'medium', 'turret', 'rusher', 'large'] as const;
const motionKinds = ['linear', 'wave', 'zigzag', 'chase', 'fixed', 'path'] as const;
const beatLetters = ['起', '承', '転', '結'];
const motionNames: Record<EnemyMotion['kind'], string> = {
  linear: '直進', wave: '波形', zigzag: 'ジグザグ', chase: '追尾', fixed: '定位置へ', path: '経路',
};

function entryLabel(spawn: EnemySpawn): string {
  const { x, y } = spawn.position;
  if (x < 0) return `左から · Y ${Math.round(y)}`;
  if (x > 720) return `右から · Y ${Math.round(y)}`;
  if (y < 0) return `上から · X ${Math.round(x)}`;
  if (y > 720) return `下から · X ${Math.round(x)}`;
  return `画面内 · X ${Math.round(x)} / Y ${Math.round(y)}`;
}

function attackLabel(spawn: EnemySpawn): string {
  const definition = ENEMY_DEFINITIONS[spawn.kind];
  if (definition.explodeOnContact) return '接触で爆発';
  const attacks = spawn.attacks ?? definition.attacks;
  if (!attacks.length) return '攻撃なし';
  if (attacks.some((attack) => attack.kind === 'laser')) return 'レーザー';
  if (attacks.some((attack) => attack.kind === 'aimed')) return '自機狙い';
  return '固定弾';
}

interface EnemyRoutePreviewProps {
  spawn: DraftSpawn;
  companions: EnemySpawn[];
  seconds: number;
  gridSize: number;
  maxArrivalAt: number;
  onArrivalAtChange: (at: number) => void;
  onMove: (handle: RouteHandle, point: { x: number; y: number }) => void;
}

function EnemyRoutePreview({ spawn, companions, seconds, gridSize, maxArrivalAt, onArrivalAtChange, onMove }: EnemyRoutePreviewProps) {
  const drag = useRef<{ pointerId: number; handle: RouteHandle } | null>(null);
  const [placeMode, setPlaceMode] = useState<'goal' | 'origin'>('goal');
  const goal = getRouteGoal(spawn, seconds);
  const points = routePoints(spawn, seconds);
  const pointerPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(Math.max(ROUTE_VIEW_MIN, Math.min(ROUTE_VIEW_MAX, point.x))),
      y: Math.round(Math.max(ROUTE_VIEW_MIN, Math.min(ROUTE_VIEW_MAX, point.y))) };
  };
  const startDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const attribute = (event.target as Element).getAttribute('data-route-handle');
    const handle: RouteHandle = attribute
      ? attribute === 'origin' ? 'origin' : Number(attribute)
      : goal && placeMode === 'goal' ? 1 : 'origin';
    const point = pointerPoint(event);
    if (!point) return;
    drag.current = { pointerId: event.pointerId, handle };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (attribute === null) onMove(handle, snapRoutePoint(point, gridSize));
    event.preventDefault();
  };
  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const point = pointerPoint(event);
    if (point) onMove(drag.current.handle, snapRoutePoint(point, gridSize));
  };
  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="editor-route-preview">
    <div className="editor-route-caption"><strong>{goal ? 'ゴールから出現位置を決める' : '出現位置と移動'}</strong><span>{gridSize ? `${gridSize}px マス` : '自由配置'}</span></div>
    {goal && <div className="editor-route-placement" role="group" aria-label="図をクリックしたときに置く点">
      <button type="button" aria-pressed={placeMode === 'goal'} onClick={() => setPlaceMode('goal')}>① 画面内のゴール</button>
      <button type="button" aria-pressed={placeMode === 'origin'} onClick={() => setPlaceMode('origin')}>② 出現位置</button></div>}
    <svg viewBox="-100 -100 920 920" role="img" aria-label={`${ENEMY_DEFINITIONS[spawn.kind].name}の出現位置と移動経路。ゴールと出現位置をドラッグして編集できます`}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; }}>
      <defs><marker id="editor-route-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0 0 10 5 0 10Z" fill="#f6e7b7" /></marker>
        {gridSize > 0 && <pattern id="enemy-route-grid-pattern" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} className="editor-grid-line" /></pattern>}</defs>
      <rect x="0" y="0" width="720" height="720" rx="12" className="editor-route-field" />
      {gridSize > 0 && <rect x="-100" y="-100" width="920" height="920" fill="url(#enemy-route-grid-pattern)" pointerEvents="none" />}
      <path d="M360 0v720M0 360h720" className="editor-route-grid" />
      {companions.map((other, index) => <circle key={index} cx={other.position.x} cy={other.position.y} r="15" className="editor-route-companion">
        <title>{ENEMY_DEFINITIONS[other.kind].name} · {other.time.toFixed(1)}秒</title></circle>)}
      {points.length > 1 && <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} className="editor-route-line" markerEnd="url(#editor-route-arrow)" />}
      {points.slice(1).map((point, index) => <g key={index}>
        <circle cx={point.x} cy={point.y} r="24" className="editor-route-destination" />
        {goal && index === 0 && <text x={point.x} y={point.y - 37} textAnchor="middle" className="editor-route-point-label">GOAL</text>}
        <circle cx={point.x} cy={point.y} r="45" className="editor-route-hit" data-route-handle={index + 1}>
          <title>{spawn.motion.kind === 'path' ? `経路 ${index + 1}` : '到達地点'}をドラッグ</title></circle>
      </g>)}
      <circle cx={spawn.position.x} cy={spawn.position.y} r="23" className="editor-route-start" />
      <circle cx={spawn.position.x} cy={spawn.position.y} r="9" fill="#fff4d3" />
      {goal && <text x={spawn.position.x} y={spawn.position.y - 37} textAnchor="middle" className="editor-route-point-label">START</text>}
      <circle cx={spawn.position.x} cy={spawn.position.y} r="45" className="editor-route-hit" data-route-handle="origin"><title>出現位置をドラッグ</title></circle>
    </svg>
    {goal && <label className="editor-route-seconds">ゴール到達 / ステージ <input type="number" min={spawn.time + .1} max={maxArrivalAt} step="0.1" value={goal.at}
      onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) onArrivalAtChange(event.target.valueAsNumber); }} />秒</label>}
    <p>{goal ? '① ゴールを置く → ② 出現位置を置く。到達時刻から移動速度を計算します。' :
      spawn.motion.kind === 'chase' ? '出現位置をドラッグ。追尾方向はプレイヤーの位置で決まります。' :
      '出現位置と経路点をドラッグできます。空白をクリックすると出現位置を置きます。'}</p>
  </div>;
}

function gimmickLanes(events: GimmickEvent[]): GimmickEvent[][] {
  const lanes: GimmickEvent[][] = [];
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    let lane = lanes.find((row) => row[row.length - 1].at + gimmickDuration(row[row.length - 1]) <= event.at);
    if (!lane) { lane = []; lanes.push(lane); }
    lane.push(event);
  }
  return lanes;
}

function newMotion(kind: EnemyMotion['kind']): EnemyMotion {
  switch (kind) {
    case 'linear': return { kind, vx: 0, vy: 100 };
    case 'wave': return { kind, vx: 0, vy: 100, amplitude: 55, frequency: 2 };
    case 'zigzag': return { kind, vx: 0, vy: 100, amplitude: 55, period: 2 };
    case 'chase': return { kind, speed: 120 };
    case 'fixed': return { kind, destination: { x: 360, y: 180 }, speed: 120 };
    case 'path': return { kind, points: [{ x: 360, y: 200 }, { x: 360, y: 650 }], speed: 120, exitAtEnd: true };
  }
}

function newAttack(kind: EnemyAttack['kind']): EnemyAttack {
  return { kind, firstShot: 2, interval: 4, speed: kind === 'laser' ? 0 : 140,
    count: 1, spread: 0, ...(kind === 'laser' ? { laser: { warning: 1.4, duration: .6, width: 12, length: 1000 } } : {}) };
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function NumberField({ label, value, onChange, min, max, step = .1 }: NumberFieldProps) {
  return <label className="editor-number"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step}
    onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber); }} /></label>;
}

function TimeMark({ time }: { time: number }) { return <time>{time.toFixed(1)}s</time>; }

interface FormationSettings {
  pattern: FormationPattern;
  spacing: number;
  columnWidth: number;
  showPreview: boolean;
}

export function StageEditor() {
  const [draft, setDraft] = useState<StageDraft>(() => upgradeFormationOrigins(loadStageDraft(STAGES[1].id) ?? createStageDraft(STAGES[1])));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('敵・演出を調整して保存すると、ステージ選択にも反映されます。');
  const [tab, setTab] = useState<'story' | 'groups' | 'enemies' | 'gimmick'>('story');
  const [selectedSpawn, setSelectedSpawn] = useState<number | null>(null);
  const [selectedEnemyIds, setSelectedEnemyIds] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [formationSettings, setFormationSettings] = useState<Record<string, FormationSettings>>({});
  const [gridSize, setGridSize] = useState(40);
  const routeSeconds = ROUTE_PREVIEW_SECONDS;
  const [selectedGimmick, setSelectedGimmick] = useState<string | null>(null);
  const [previewStage, setPreviewStage] = useState<StageDefinition | null>(null);
  const [controls, setControls] = useState<GameControls | null>(null);
  const [hud, setHud] = useState(() => getHudSnapshot(new Game().state));
  const [previewScale, setPreviewScale] = useState(1);
  const previewHost = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const base = STAGES.find((stage) => stage.id === draft.baseStageId)!;

  const change = (mutate: (next: StageDraft) => void) => {
    setDraft((previous) => { const next = structuredClone(previous); mutate(next); return next; });
    setDirty(true); setMessage('未保存の変更があります。');
  };
  const updateSpawn = (index: number, mutate: (spawn: DraftSpawn) => void) =>
    change((next) => mutate(next.spawns[index]));
  const updateAttack = (spawnIndex: number, attackIndex: number, mutate: (attack: EnemyAttack) => void) =>
    updateSpawn(spawnIndex, (spawn) => mutate(spawn.attacks![attackIndex]));
  const updateGimmickEvent = (id: string, mutate: (event: GimmickEvent) => void) =>
    change((next) => { const event = next.gimmicks.find((item) => item.id === id); if (event) mutate(event); });
  const makeGroup = () => {
    if (!selectedEnemyIds.length) return;
    const id = crypto.randomUUID();
    change((next) => { createGroup(next, selectedEnemyIds, id, `編隊 ${next.groups.length + 1}`); });
    setSelectedGroup(id); setSelectedEnemyIds([]); setTab('groups');
  };
  const autoGroup = () => {
    const next = structuredClone(draft);
    const created = groupNearby(next, () => crypto.randomUUID());
    if (!created.length) { setMessage('まとめられる近い敵がありません。'); return; }
    setDraft(next); setDirty(true); setMessage(`${created.length}組の編隊を作りました。`);
    setSelectedGroup(null); setTab('groups');
  };

  const chooseStage = (id: string) => {
    if (dirty && !window.confirm('未保存の変更を破棄してステージを切り替えますか？')) return;
    const stage = STAGES.find((item) => item.id === id)!;
    setDraft(upgradeFormationOrigins(loadStageDraft(id) ?? createStageDraft(stage)));
    setSelectedSpawn(null); setSelectedEnemyIds([]); setSelectedGroup(null); setFormationSettings({}); setSelectedGimmick(null); setDirty(false);
    setMessage('編集するステージを切り替えました。');
  };
  const save = () => {
    try { saveStageDraft(draft); setDirty(false); setMessage('保存しました。ステージ選択にも反映されています。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存できませんでした。'); }
  };
  const exportFile = () => {
    try {
      const valid = parseStageDraft(draft);
      const url = URL.createObjectURL(new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${valid.baseStageId}-draft.json`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('ステージファイルを書き出しました。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '書き出せませんでした。'); }
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const imported = parseStageDraft(JSON.parse(await file.text()) as unknown);
      if (dirty && !window.confirm('未保存の変更を破棄して読み込みますか？')) return;
      setDraft(upgradeFormationOrigins(imported)); setSelectedSpawn(null); setSelectedEnemyIds([]); setSelectedGroup(null); setFormationSettings({}); setSelectedGimmick(null); setDirty(true);
      setMessage('読み込みました。内容を確認して保存してください。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '読み込めませんでした。'); }
  };
  const startPreview = () => {
    try { setPreviewStage(compileStageDraft(parseStageDraft(draft))); setMessage('試遊中の記録は保存されません。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '試遊を開始できませんでした。'); }
  };
  const acceptControls = useCallback((value: GameControls | null) => setControls(value), []);
  useEffect(() => { if (previewStage && controls) controls.startStage(previewStage); }, [previewStage, controls]);
  useEffect(() => {
    const host = previewHost.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setPreviewScale(entry.contentRect.width / 720));
    observer.observe(host); return () => observer.disconnect();
  }, [previewStage]);
  useEffect(() => {
    if (tab === 'enemies' && selectedSpawn !== null)
      document.querySelector(`[data-spawn-index="${selectedSpawn}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [tab, selectedSpawn]);

  const orderedSpawns = draft.spawns.map((spawn, index) => ({ spawn, index })).sort((a, b) => a.spawn.time - b.spawn.time);
  const orderedGroups = [...draft.groups].sort((a, b) => groupStart(draft, a.id) - groupStart(draft, b.id));
  const currentGroup = draft.groups.find((group) => group.id === selectedGroup);
  const members = currentGroup ? groupMembers(draft, currentGroup.id) : [];
  const startCenter = formationStartCenter(members);
  const goalXs = members.flatMap((spawn) => { const goal = formationGoal(spawn); return goal ? [goal.x] : []; });
  const defaultColumnWidth = goalXs.length > 1
    ? Math.max(gridSize || 40, Math.round((Math.max(...goalXs)
      - Math.min(...goalXs)) / (gridSize || 1)) * (gridSize || 1))
    : gridSize || 40;
  const layoutSettings = currentGroup ? formationSettings[currentGroup.id] ?? {
    pattern: 'two-columns' as const, spacing: gridSize || 40, columnWidth: defaultColumnWidth, showPreview: true,
  } : null;
  const plannedLayout = currentGroup && layoutSettings
    ? planFormationLayout(currentGroup, members, layoutSettings.pattern, layoutSettings.spacing, layoutSettings.columnWidth, gridSize)
    : null;
  const updateLayoutSettings = (patch: Partial<FormationSettings>) => {
    if (!currentGroup || !layoutSettings) return;
    setFormationSettings((previous) => ({ ...previous, [currentGroup.id]: { ...layoutSettings, ...patch } }));
  };
  useEffect(() => {
    if (tab !== 'groups') return;
    document.querySelector(currentGroup ? '.editor-group-detail' : '.editor-group-picker')?.scrollIntoView({ block: 'start' });
  }, [tab, selectedGroup, currentGroup?.id]);
  const lanes = gimmickLanes(draft.gimmicks);
  const selectedGimmickId = selectedGimmick ?? draft.gimmicks[0]?.id ?? null;
  const currentGimmick = draft.gimmicks.find((event) => event.id === selectedGimmickId);
  const groupSpawnIndex = currentGroup && members.length
    ? selectedSpawn !== null && draft.spawns[selectedSpawn]?.groupId === currentGroup.id
      ? selectedSpawn : draft.spawns.findIndex((spawn) => spawn.editorId === members[0].editorId)
    : null;
  const inspectorSpawnIndex = tab === 'groups' ? groupSpawnIndex : selectedSpawn;
  const selected = inspectorSpawnIndex === null ? null : draft.spawns[inspectorSpawnIndex];
  const timing = selected ? routeTiming(selected, routeSeconds) : null;
  const beatAt = (time: number) => draft.beats.reduce((active, beat, index) => time >= beat.start ? index : active, 0);
  const eventPercent = (time: number) => `${Math.min(100, time / Math.max(1, draft.bossAt) * 100)}%`;

  const enemyInspector = <section id={tab === 'groups' ? 'editor-formation-enemy-settings' : undefined}
    className="editor-panel editor-inspector">{selected && inspectorSpawnIndex !== null ? <>
        {tab === 'groups' && <p className="editor-formation-detail-note">選択中の敵 · 数値と攻撃を細かく調整</p>}
        <div className="editor-panel-heading editor-inspector-heading"><div className={`editor-enemy-title editor-kind-${selected.kind}`}>
        <EnemyPortrait kind={selected.kind} /><div><span className="editor-kicker">ENEMY · <TimeMark time={selected.time} /></span>
          <h2>{ENEMY_DEFINITIONS[selected.kind].name}</h2><p>{entryLabel(selected)} · {motionNames[selected.motion.kind]} · {attackLabel(selected)}</p></div></div>
        <div><button onClick={() => { const index = draft.spawns.length; change((next) => { const copy = structuredClone(next.spawns[inspectorSpawnIndex]); copy.editorId = crypto.randomUUID(); shiftRouteTime(copy, Math.min(.5, next.bossAt - copy.time)); next.spawns.push(copy); }); setSelectedSpawn(index); }}>複製</button>
          <button className="editor-danger" onClick={() => { const id = selected.editorId; change((next) => { next.spawns.splice(inspectorSpawnIndex, 1); removeEmptyGroups(next); }); setSelectedSpawn(null); setSelectedEnemyIds((ids) => ids.filter((item) => item !== id)); }}>削除</button></div></div>
        <div className={`editor-enemy-summary ${tab === 'groups' ? 'compact' : ''}`}>{tab !== 'groups' && <EnemyRoutePreview key={selected.editorId} spawn={selected} companions={draft.spawns.filter((spawn, index) => index !== inspectorSpawnIndex && Math.abs(spawn.time - selected.time) <= 1)}
          seconds={routeSeconds} gridSize={gridSize} maxArrivalAt={draft.bossAt + 60}
          onArrivalAtChange={(at) => updateSpawn(inspectorSpawnIndex, (spawn) => {
            const goal = getRouteGoal(spawn, routeSeconds);
            if (goal) setRouteGoal(spawn, goal.position, Math.min(at, draft.bossAt + 60));
          })}
          onMove={(handle, point) => updateSpawn(inspectorSpawnIndex, (spawn) => moveRouteHandle(spawn, handle, point, routeSeconds))} />}
          <div className="editor-summary-text"><span className="editor-kicker">AT A GLANCE</span><p><strong>種類</strong>{ENEMY_DEFINITIONS[selected.kind].name}</p>
            <p><strong>出現</strong><TimeMark time={selected.time} /> · {entryLabel(selected)}</p>
            <p><strong>移動</strong>{motionNames[selected.motion.kind]}</p><p><strong>攻撃</strong>{attackLabel(selected)}</p>
            {timing && <><p><strong>速度</strong>{timing.speed.toFixed(1)} px/秒</p>
              {timing.distance !== null && <p><strong>距離</strong>{timing.distance.toFixed(0)} px</p>}
              {timing.duration !== null && timing.arrivalAt !== null && <p><strong>{timing.approximate ? '基準位置' : '到達'}</strong>出現から {timing.duration.toFixed(1)} 秒 · ステージ {timing.arrivalAt.toFixed(1)} 秒</p>}
              {timing.fieldEntryAt !== null && <p><strong>画面進入</strong>ステージ {timing.fieldEntryAt.toFixed(1)} 秒{timing.approximate ? '（目安）' : ''}</p>}
              {timing.fieldExitAt !== null && <p><strong>画面通過</strong>ステージ {timing.fieldExitAt.toFixed(1)} 秒{timing.approximate ? '（目安）' : ''}</p>}
              {selected.retireAfter !== undefined && <p><strong>退場開始</strong>ステージ {(selected.time + selected.retireAfter).toFixed(1)} 秒</p>}</>}
            <small>{selected.motion.kind === 'chase' ? '追尾の到達時間はプレイヤーの位置で変わります。' :
              timing?.approximate ? '波形・ジグザグは揺れを除いた基準移動の値です。' :
              '数値欄を変えると図と計算結果にも反映されます。'}
              {timing?.duration !== null && timing?.duration !== undefined && selected.retireAfter !== undefined && timing.duration > selected.retireAfter
                ? ' 到達前に退場動作が始まります。' : ''}</small></div></div>
        <div className="editor-fields"><NumberField label="出現 / 秒" value={selected.time} min={0} max={draft.bossAt} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => setRouteSpawnTime(spawn, value, routeSeconds))} />
          <label>編隊<select value={selected.groupId ?? ''} onChange={(event) => change((next) => {
            const spawn = next.spawns[inspectorSpawnIndex]; spawn.groupId = event.target.value || undefined; removeEmptyGroups(next);
          })}><option value="">単独</option>{draft.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <label>種類<select value={selected.kind} onChange={(event) => updateSpawn(inspectorSpawnIndex, (spawn) => { spawn.kind = event.target.value as EnemySpawn['kind']; })}>
            {kinds.map((kind) => <option value={kind} key={kind}>{ENEMY_DEFINITIONS[kind].name}</option>)}</select></label>
          <NumberField label="出現 X" value={selected.position.x} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => setRouteOrigin(spawn, { x: value, y: spawn.position.y }, routeSeconds))} />
          <NumberField label="出現 Y" value={selected.position.y} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => setRouteOrigin(spawn, { x: spawn.position.x, y: value }, routeSeconds))} />
          {getRouteGoal(selected, routeSeconds) && <>
            <NumberField label="画面内ゴール X" value={getRouteGoal(selected, routeSeconds)!.position.x} min={0} max={720}
              onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => setRouteGoal(spawn,
                { x: value, y: getRouteGoal(spawn, routeSeconds)!.position.y }, getRouteGoal(spawn, routeSeconds)!.at))} />
            <NumberField label="画面内ゴール Y" value={getRouteGoal(selected, routeSeconds)!.position.y} min={0} max={720}
              onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => setRouteGoal(spawn,
                { x: getRouteGoal(spawn, routeSeconds)!.position.x, y: value }, getRouteGoal(spawn, routeSeconds)!.at))} />
          </>}
          <NumberField label="退場まで / 秒（0は自動）" value={selected.retireAfter ?? 0} min={0} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { spawn.retireAfter = value || undefined; })} /></div>
        <h3>移動</h3><div className="editor-fields"><label>動き<select value={selected.motion.kind} onChange={(event) => updateSpawn(inspectorSpawnIndex, (spawn) => {
          const goal = getRouteGoal(spawn, routeSeconds);
          spawn.motion = newMotion(event.target.value as EnemyMotion['kind']);
          if ('vx' in spawn.motion && goal) setRouteGoal(spawn, goal.position, goal.at);
          else delete spawn.routeGoal;
        })}>
          {motionKinds.map((kind) => <option value={kind} key={kind}>{motionNames[kind]}</option>)}</select></label>
          {('vx' in selected.motion) && <div className="editor-velocity-result"><span>逆算した速度</span>
            <output>X {selected.motion.vx.toFixed(1)} / Y {selected.motion.vy.toFixed(1)} px/秒</output></div>}
          {('amplitude' in selected.motion) && <NumberField label="振幅" value={selected.motion.amplitude} min={0} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if ('amplitude' in spawn.motion) spawn.motion.amplitude = value; })} />}
          {selected.motion.kind === 'wave' && <NumberField label="周波数" value={selected.motion.frequency} min={0} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'wave') spawn.motion.frequency = value; })} />}
          {selected.motion.kind === 'zigzag' && <NumberField label="周期" value={selected.motion.period} min={.1} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'zigzag') spawn.motion.period = value; })} />}
          {('speed' in selected.motion) && <NumberField label="速度" value={selected.motion.speed} min={1} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if ('speed' in spawn.motion) spawn.motion.speed = value; })} />}
          {selected.motion.kind === 'fixed' && <><NumberField label="目的地 X" value={selected.motion.destination.x} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'fixed') spawn.motion.destination.x = value; })} />
            <NumberField label="目的地 Y" value={selected.motion.destination.y} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'fixed') spawn.motion.destination.y = value; })} /></>}
          {selected.motion.kind === 'path' && <label className="editor-check"><input type="checkbox" checked={selected.motion.exitAtEnd} onChange={(event) => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'path') spawn.motion.exitAtEnd = event.target.checked; })} />経路の終点で退場</label>}</div>
        {selected.motion.kind === 'path' && <div className="editor-path"><div className="editor-panel-heading"><h3>経路</h3><button onClick={() => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'path') spawn.motion.points.push({ x: 360, y: 360 }); })}>＋ 地点</button></div>
          {selected.motion.points.map((point, pointIndex) => <div key={pointIndex} className="editor-path-row"><span>{pointIndex + 1}</span>
            <NumberField label="X" value={point.x} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'path') spawn.motion.points[pointIndex].x = value; })} />
            <NumberField label="Y" value={point.y} onChange={(value) => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'path') spawn.motion.points[pointIndex].y = value; })} />
            <button disabled={selected.motion.kind !== 'path' || selected.motion.points.length <= 1} onClick={() => updateSpawn(inspectorSpawnIndex, (spawn) => { if (spawn.motion.kind === 'path') spawn.motion.points.splice(pointIndex, 1); })}>削除</button></div>)}</div>}
        <div className="editor-panel-heading"><h3>攻撃</h3><div><button onClick={() => updateSpawn(inspectorSpawnIndex, (spawn) => { spawn.attacks = undefined; })}>標準に戻す</button>
          <button onClick={() => updateSpawn(inspectorSpawnIndex, (spawn) => { (spawn.attacks ??= []).push(newAttack('aimed')); })}>＋ 攻撃</button></div></div>
        {(selected.attacks ?? []).map((attack, attackIndex) => <div className="editor-attack" key={attackIndex}><div className="editor-panel-heading"><strong>攻撃 {attackIndex + 1}</strong>
          <button onClick={() => updateSpawn(inspectorSpawnIndex, (spawn) => { spawn.attacks!.splice(attackIndex, 1); })}>削除</button></div>
          <div className="editor-fields"><label>種類<select value={attack.kind} onChange={(event) => updateSpawn(inspectorSpawnIndex, (spawn) => { spawn.attacks![attackIndex] = newAttack(event.target.value as EnemyAttack['kind']); })}>
            <option value="aimed">自機狙い</option><option value="straight">固定方向</option><option value="laser">レーザー</option></select></label>
            {([['初弾 / 秒', 'firstShot'], ['間隔 / 秒', 'interval'], ['弾速', 'speed'], ['弾数', 'count'], ['広がり', 'spread']] as const).map(([label, key]) =>
              <NumberField key={key} label={label} value={attack[key]} min={0} onChange={(value) => updateAttack(inspectorSpawnIndex, attackIndex, (item) => { item[key] = value; })} />)}
            {attack.kind === 'laser' && attack.laser && <>
              {([['予告 / 秒', 'warning'], ['照射 / 秒', 'duration'], ['幅', 'width'], ['長さ', 'length']] as const).map(([label, key]) =>
                <NumberField key={key} label={label} value={attack.laser![key]} min={0} onChange={(value) => updateAttack(inspectorSpawnIndex, attackIndex, (item) => { item.laser![key] = value; })} />)}</>}</div></div>)}
        <p className="editor-help">{selected.attacks === undefined ? '敵の種類ごとの標準攻撃を使用中です。' : selected.attacks.length === 0 ? 'この敵は攻撃しません。' : 'この敵専用の攻撃を使用中です。'}</p></> : <p className="editor-empty">左の敵、または時間軸の印を選ぶと詳細を編集できます。</p>}</section>;

  if (previewStage) return <main className="editor-preview">
    <header className="editor-preview-header"><div><span className="editor-kicker">PLAYTEST · 記録対象外</span><h1>{draft.name}</h1></div>
      <div className="editor-actions"><button data-menu onClick={() => setPreviewStage(null)}>編集に戻る</button>
        <button data-menu onClick={() => controls?.reset()} disabled={!controls}>最初から</button>
        <button data-menu onClick={() => controls?.pause()} disabled={!controls || hud.gameOver || Boolean(hud.result)}>{hud.paused ? '再開' : '一時停止'}</button></div>
    </header>
    <div className="editor-preview-layout"><div className="editor-preview-frame" ref={previewHost}>
      <section className="play-field" style={{ transform: `scale(${previewScale})` }} aria-label="ステージ試遊">
        <GameCanvas onSnapshot={setHud} onReady={acceptControls} onControllerChange={NO_CONTROLLER_CHANGE}
          onRecordsChange={NO_RECORD_CHANGE} menuOpen={false} menuKey={hud.paused ? 'pause' : 'preview'} recordRuns={false} />
        <div className="field-top"><span>{previewStage.scene.label}</span><span><TimeMark time={hud.elapsed} /></span></div>
        {hud.paused && <div className="editor-preview-overlay">一時停止中</div>}
        {hud.gameOverReady && <div className="editor-preview-overlay">GAME OVER</div>}
        {hud.clearReady && <div className="editor-preview-overlay">STAGE CLEAR</div>}
      </section>
    </div><aside className="editor-preview-info"><span className="editor-kicker">LIVE CHECK</span>
      <p>経過 <strong><TimeMark time={hud.elapsed} /></strong></p><p>HP <strong>{hud.hp}</strong></p>
      <p>撃破 <strong>{hud.defeatedCount}</strong></p><p>区間 <strong>{beatLetters[beatAt(hud.elapsed)]} · {draft.beats[beatAt(hud.elapsed)].title}</strong></p>
      <div className="editor-preview-intent">{draft.beats[beatAt(hud.elapsed)].intent || 'この区間の狙いをエディタで記入できます。'}</div>
      <small>移動：矢印 / WASD　射撃：Z / Space　低速：Shift　停止：Esc<br />コントローラーでも試遊できます。</small>
    </aside></div>
  </main>;

  return <main className="stage-editor">
    <header className="editor-header"><div><span className="editor-kicker">BLUE CURRENT · STAGE EDITOR</span><h1>流れをつくる</h1><p>起承転結を見ながら、敵と演出の時間を整える。</p></div>
      <div className="editor-actions"><a href="/">ゲームへ戻る</a><button onClick={() => fileInput.current?.click()}>読み込み</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
        <button onClick={exportFile}>書き出し</button><button onClick={save}>保存</button>
        <button className="editor-primary" onClick={startPreview}>▶ 試遊する</button></div>
    </header>
    <div className="editor-toolbar"><label>編集ステージ <select value={draft.baseStageId} onChange={(event) => chooseStage(event.target.value)}>
      {STAGES.map((stage) => <option value={stage.id} key={stage.id}>{stage.id} · {stage.name}</option>)}</select></label>
      <label>配置マス <select className="editor-grid-select" value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))}>
        <option value={40}>40 px</option><option value={20}>20 px</option><option value={60}>60 px</option><option value={80}>80 px</option><option value={0}>自由配置</option>
      </select></label>
      <span className={dirty ? 'editor-dirty' : ''} role="status">{message}</span></div>
    <section className="editor-timeline" aria-label="ステージ時間軸"><div className="editor-timeline-head"><strong>TIMELINE</strong><span>0s — ボス登場 {draft.bossAt}s</span></div>
      <div className="editor-beat-track">{draft.beats.map((beat, index) => <div key={beat.key} style={{ width: `${((draft.beats[index + 1]?.start ?? draft.bossAt) - beat.start) / draft.bossAt * 100}%` }}>
        <b>{beatLetters[index]}</b><span>{beat.title}</span><small>{beat.start.toFixed(1)}s</small></div>)}</div>
      <div className="editor-event-track"><span>敵</span><div>{orderedSpawns.map(({ spawn, index }) => <button
        key={spawn.editorId} className={`editor-kind-${spawn.kind} ${spawn.groupId ? 'grouped' : ''} ${selectedSpawn === index && tab === 'enemies' ? 'active' : ''}`}
        title={`${spawn.time.toFixed(1)}s · ${ENEMY_DEFINITIONS[spawn.kind].name} · ${entryLabel(spawn)}`} style={{ left: eventPercent(spawn.time) }}
        onClick={() => { setSelectedSpawn(index); setTab('enemies'); }} aria-label={`${spawn.time.toFixed(1)}秒 ${ENEMY_DEFINITIONS[spawn.kind].name}を編集`} />)}</div></div>
      <div className="editor-gimmick-tracks"><span>ギミック</span><div className="editor-gimmick-lanes">
        {(lanes.length ? lanes : [[]]).map((lane, laneIndex) =>
          <div className="editor-gimmick-lane" key={laneIndex}>{lane.map((event) => <button key={event.id}
            className={`editor-gimmick-bar ${selectedGimmickId === event.id && tab === 'gimmick' ? 'active' : ''}`}
            title={`画面縮小 · ${event.at.toFixed(1)}–${(event.at + gimmickDuration(event)).toFixed(1)}秒`}
            style={{ left: eventPercent(event.at), width: `${Math.max(0, Math.min(gimmickDuration(event), draft.bossAt - event.at) / draft.bossAt * 100)}%` }}
            onClick={() => { setSelectedGimmick(event.id); setTab('gimmick'); }}
            aria-label={`${event.at.toFixed(1)}秒から画面縮小を編集`}>縮小</button>)}</div>)}</div></div>
      <div className="editor-enemy-legend">{kinds.map((kind) => <span className={`editor-kind-${kind}`} key={kind}>
        <i />{ENEMY_DEFINITIONS[kind].name}</span>)}</div>
    </section>
    <nav className="editor-tabs" aria-label="編集項目"><button className={tab === 'story' ? 'active' : ''} onClick={() => setTab('story')}>構成 · 起承転結</button>
      <button className={tab === 'groups' ? 'active' : ''} onClick={() => { setSelectedGroup(null); setTab('groups'); }}>編隊 · {draft.groups.length}組</button>
      <button className={tab === 'enemies' ? 'active' : ''} onClick={() => setTab('enemies')}>敵 · {draft.spawns.length}体</button>
      <button className={tab === 'gimmick' ? 'active' : ''} onClick={() => setTab('gimmick')}>ギミック · {draft.gimmicks.length}件</button></nav>
    {tab === 'story' && <div className="editor-content"><section className="editor-panel"><h2>ステージの骨格</h2>
      <div className="editor-fields"><label>ステージ名<input value={draft.name} onChange={(event) => change((next) => { next.name = event.target.value; })} /></label>
        <label>説明<input value={draft.description} onChange={(event) => change((next) => { next.description = event.target.value; })} /></label>
        <NumberField label="ボス登場時刻 / 秒" value={draft.bossAt} min={5} max={600} onChange={(value) => change((next) => { next.bossAt = value; })} /></div>
      <p className="editor-help">敵の出現とギミックはボス登場前に配置してください。試遊は先頭から始まります。</p></section>
      <section className="editor-panel"><h2>起承転結</h2><div className="editor-beat-list">{draft.beats.map((beat, index) => <div className="editor-beat-card" key={beat.key}>
        <div className="editor-beat-heading"><span>{beatLetters[index]}</span><strong>{['導入', '展開', '変化', '決戦へ'][index]}</strong>
          <NumberField label="開始 / 秒" value={beat.start} min={0} max={draft.bossAt} onChange={(value) => change((next) => { next.beats[index].start = value; })} /></div>
        <label>区間名<input value={beat.title} onChange={(event) => change((next) => { next.beats[index].title = event.target.value; })} /></label>
        <label>プレイヤーに感じてほしいこと<textarea rows={2} value={beat.intent} onChange={(event) => change((next) => { next.beats[index].intent = event.target.value; })} /></label>
        <small>敵 {draft.spawns.filter((spawn) => beatAt(spawn.time) === index).length}体</small></div>)}</div></section></div>}
    {tab === 'groups' && !currentGroup && <section className="editor-panel editor-group-picker">
      <div className="editor-panel-heading"><div className="editor-group-title"><span className="editor-kicker">FORMATIONS</span><h2>編隊を選択</h2></div>
        <div><button onClick={autoGroup}>近い敵をまとめる</button><button onClick={() => setTab('enemies')}>敵を選んで編隊化</button></div></div>
      <p className="editor-help">編集する編隊を選んでください。編隊全体の配置と、編隊内の敵を設定できます。</p>
      <div className="editor-group-list">{orderedGroups.map((group) => <button key={group.id}
        className="editor-group-item" onClick={() => setSelectedGroup(group.id)}>
        <strong>{group.name}</strong><span>{groupMembers(draft, group.id).length}体 · {groupStart(draft, group.id).toFixed(1)}–{groupEnd(draft, group.id).toFixed(1)}秒</span>
        <small>編隊の中身を見る →</small>
      </button>)}</div>{!draft.groups.length && <p className="editor-empty">敵を複数選んで編隊にまとめるか、「近い敵をまとめる」から始められます。</p>}
    </section>}
    {tab === 'groups' && currentGroup && <div className="editor-group-detail">
      <div className="editor-group-navigation"><button onClick={() => setSelectedGroup(null)}>← 編隊一覧</button>
        <span>編隊の中身</span><strong>{currentGroup.name} · {members.length}体</strong></div>
      <div className="editor-formation-workspace"><section className="editor-panel editor-formation-board">
        <div className="editor-panel-heading"><div className="editor-group-title"><span className="editor-kicker">FORMATION · {members.length} ENEMIES</span><h2>{currentGroup.name}</h2></div>
          <button className="editor-danger" onClick={() => { change((next) => ungroup(next, currentGroup.id)); setSelectedGroup(null); }}>編隊を解除</button></div>
        <p className="editor-formation-intro">図上の番号がゴール、Sがスタートです。それぞれ直接ドラッグできます。</p>
        <div className="editor-formation-workbench">
          <FormationPreview group={currentGroup} startCenter={startCenter}
            members={members} gridSize={gridSize} selectedEnemyId={selected?.editorId}
            previewPositions={layoutSettings?.showPreview ? plannedLayout?.positions : undefined}
            showPreview={layoutSettings?.showPreview ?? true}
            onShowPreviewChange={(showPreview) => updateLayoutSettings({ showPreview })}
            onSelectEnemy={(id) => setSelectedSpawn(draft.spawns.findIndex((spawn) => spawn.editorId === id))}
            onMove={(handle, point) => change((next) => { if (handle === 'group-goal') moveGroup(next, currentGroup.id, point, gridSize);
              else if (handle === 'group-start') moveGroupStarts(next, currentGroup.id, point, gridSize);
              else if (handle.startsWith('start:')) moveMemberStart(next, currentGroup.id, handle.slice(6), point);
              else if (handle.startsWith('goal:')) moveMember(next, currentGroup.id, handle.slice(5), point);
              else if (handle.startsWith('route:')) moveMemberRoute(next, currentGroup.id, handle.slice(6), point); })} />
          <div className="editor-formation-sidebar">
            <div className="editor-fields"><label>編隊名<input value={currentGroup.name} onChange={(event) => change((next) => { next.groups.find((group) => group.id === currentGroup.id)!.name = event.target.value; })} /></label>
              <NumberField label="最初の出現 / 秒" value={groupStart(draft, currentGroup.id)} min={0} max={draft.bossAt - (groupEnd(draft, currentGroup.id) - groupStart(draft, currentGroup.id))}
                onChange={(value) => change((next) => shiftGroupTime(next, currentGroup.id, value))} />
              <NumberField label="ゴールの中心 X" value={currentGroup.origin.x} min={0} max={720} onChange={(value) => change((next) => moveGroup(next, currentGroup.id, { x: value, y: currentGroup.origin.y }))} />
              <NumberField label="ゴールの中心 Y" value={currentGroup.origin.y} min={0} max={720} onChange={(value) => change((next) => moveGroup(next, currentGroup.id, { x: currentGroup.origin.x, y: value }))} />
              <NumberField label="スタートの中心 X" value={startCenter.x} min={-200} max={920} onChange={(value) => change((next) => moveGroupStarts(next, currentGroup.id, { x: value, y: startCenter.y }))} />
              <NumberField label="スタートの中心 Y" value={startCenter.y} min={-200} max={920} onChange={(value) => change((next) => moveGroupStarts(next, currentGroup.id, { x: startCenter.x, y: value }))} /></div>
            {layoutSettings && <div className="editor-formation-layout"><div className="editor-panel-heading"><h3>ゴールをまとめて整列</h3>
              <button className="editor-apply" onClick={() => change((next) => arrangeGroup(next, currentGroup.id,
                layoutSettings.pattern, layoutSettings.spacing, layoutSettings.columnWidth, gridSize))}>この配置を適用</button></div>
              <div className="editor-fields"><label className="editor-formation-pattern">並べ方<select value={layoutSettings.pattern}
                onChange={(event) => updateLayoutSettings({ pattern: event.target.value as FormationPattern })}>
                <option value="two-columns">左右２列</option><option value="row">横一列</option>
                <option value="column">縦一列</option><option value="v">V字</option></select></label>
                <NumberField label="ゴールの間隔 / px" value={layoutSettings.spacing} min={gridSize || 1} max={400} step={gridSize || 1}
                  onChange={(value) => updateLayoutSettings({ spacing: value })} />
                {layoutSettings.pattern === 'two-columns' && <NumberField label="左右の幅 / px" value={layoutSettings.columnWidth}
                  min={gridSize || 1} max={720} step={gridSize || 1} onChange={(value) => updateLayoutSettings({ columnWidth: value })} />}
              </div><p>{layoutSettings.showPreview ? '点線の番号が適用後のゴールです。' : '整列後の位置を非表示にしています。'}出現位置・出現時刻・攻撃を保ちます。</p>
              {members.some((spawn) => !formationGoal(spawn)) && <p>追尾する敵はゴールを固定できないため、整列の対象外です。</p>}</div>}
            {selected && <div className="editor-formation-focus"><h3>選択中の敵 · {ENEMY_DEFINITIONS[selected.kind].name}</h3>
              <div className="editor-formation-point-fields"><h4>スタート（S）</h4><div className="editor-fields">
                <NumberField label="スタート X" value={selected.position.x} min={-200} max={920}
                  onChange={(value) => change((next) => moveMemberStart(next, currentGroup.id, selected.editorId,
                    { x: value, y: next.spawns[inspectorSpawnIndex!].position.y }))} />
                <NumberField label="スタート Y" value={selected.position.y} min={-200} max={920}
                  onChange={(value) => change((next) => moveMemberStart(next, currentGroup.id, selected.editorId,
                    { x: next.spawns[inspectorSpawnIndex!].position.x, y: value }))} /></div></div>
              {formationGoal(selected) ? <div className="editor-formation-point-fields"><h4>ゴール（番号）</h4><div className="editor-fields">
                <NumberField label="ゴール X" value={formationGoal(selected)!.x} min={0} max={720}
                  onChange={(value) => change((next) => moveMember(next, currentGroup.id, selected.editorId,
                    { x: value, y: formationGoal(next.spawns[inspectorSpawnIndex!])!.y }))} />
                <NumberField label="ゴール Y" value={formationGoal(selected)!.y} min={0} max={720}
                  onChange={(value) => change((next) => moveMember(next, currentGroup.id, selected.editorId,
                    { x: formationGoal(next.spawns[inspectorSpawnIndex!])!.x, y: value }))} /></div></div>
                : <p>追尾する敵には固定ゴールがありません。</p>}
              {formationGoal(selected) && <div className="editor-formation-route-translate">
                <h4>経路ごと移動</h4><p>スタートとゴールの距離・向き・到達時刻を保って動かします。</p>
                <div className="editor-fields"><NumberField label="経路のスタート X" value={selected.position.x} min={-200} max={920}
                  onChange={(value) => change((next) => moveMemberRoute(next, currentGroup.id, selected.editorId,
                    { x: value, y: next.spawns[inspectorSpawnIndex!].position.y }))} />
                  <NumberField label="経路のスタート Y" value={selected.position.y} min={-200} max={920}
                    onChange={(value) => change((next) => moveMemberRoute(next, currentGroup.id, selected.editorId,
                      { x: next.spawns[inspectorSpawnIndex!].position.x, y: value }))} /></div></div>}
              <p>正確な位置は数値で調整できます。移動経路は図に反映されます。</p></div>}
            <div className="editor-formation-roster"><h3>編隊の敵</h3><div className="editor-formation-members">{members.map((spawn, index) => {
              const goal = formationGoal(spawn);
              return <button type="button" className={`editor-formation-member ${selected?.editorId === spawn.editorId ? 'active' : ''}`}
                key={spawn.editorId} aria-pressed={selected?.editorId === spawn.editorId}
                onClick={() => setSelectedSpawn(draft.spawns.findIndex((item) => item.editorId === spawn.editorId))}>
                <span className={`editor-formation-index editor-kind-${spawn.kind}`}>{index + 1}</span>
                <span><strong>{ENEMY_DEFINITIONS[spawn.kind].name}</strong><small>{entryLabel(spawn)} → {goal ? `X ${Math.round(goal.x)} / Y ${Math.round(goal.y)}` : '追尾'}</small></span>
                <time>{spawn.time.toFixed(1)}s</time></button>;
            })}</div></div>
          </div>
        </div>
      </section>{enemyInspector}</div></div>}
    {tab === 'enemies' && <div className="editor-content editor-enemy-layout"><section className="editor-panel"><div className="editor-panel-heading"><h2>敵の出現</h2><div>
      <button disabled={selectedEnemyIds.length < 2} onClick={makeGroup}>選択を編隊化 {selectedEnemyIds.length > 0 ? `(${selectedEnemyIds.length})` : ''}</button>
      <button onClick={() => {
        const index = draft.spawns.length;
        change((next) => next.spawns.push({ editorId: crypto.randomUUID(), time: Math.max(0, next.bossAt - 5), kind: 'small', position: { x: 360, y: -35 }, motion: newMotion('linear') }));
        setSelectedSpawn(index);
      }}>＋ 敵を追加</button></div></div><p className="editor-help">複数の敵にチェックを付けると編隊にまとめられます。</p><div className="editor-spawn-list">{draft.beats.map((beat, beatIndex) => {
        const entries = orderedSpawns.filter(({ spawn }) => beatAt(spawn.time) === beatIndex);
        if (!entries.length) return null;
        return <div className="editor-spawn-group" key={beat.key}><div className="editor-spawn-group-title"><strong>{beatLetters[beatIndex]} · {beat.title}</strong><span>{entries.length}体</span></div>
          {entries.map(({ spawn, index }) => <div className="editor-spawn-row" key={spawn.editorId}>
            <input type="checkbox" checked={selectedEnemyIds.includes(spawn.editorId)} aria-label={`${ENEMY_DEFINITIONS[spawn.kind].name} ${spawn.time.toFixed(1)}秒を編隊に選択`}
              onChange={(event) => setSelectedEnemyIds((previous) => event.target.checked ? [...previous, spawn.editorId] : previous.filter((id) => id !== spawn.editorId))} />
            <button data-spawn-index={index} className={`editor-spawn-item editor-kind-${spawn.kind} ${selectedSpawn === index ? 'active' : ''}`}
            onClick={() => setSelectedSpawn(index)} aria-label={`${spawn.time.toFixed(1)}秒 ${ENEMY_DEFINITIONS[spawn.kind].name} ${entryLabel(spawn)}`}>
            <EnemyPortrait kind={spawn.kind} /><span className="editor-spawn-description"><strong>{ENEMY_DEFINITIONS[spawn.kind].name}</strong>
              <small>{entryLabel(spawn)} · {motionNames[spawn.motion.kind]}</small></span>
            <span className="editor-spawn-meta"><TimeMark time={spawn.time} /><small>{spawn.groupId ? draft.groups.find((group) => group.id === spawn.groupId)?.name : attackLabel(spawn)}</small></span></button></div>)}</div>;
      })}</div></section>
      {enemyInspector}</div>}
    {tab === 'gimmick' && <div className="editor-content editor-gimmick-layout"><section className="editor-panel">
      <div className="editor-panel-heading"><h2>ギミックの配置</h2><button onClick={() => {
        const id = crypto.randomUUID();
        change((next) => next.gimmicks.push({ id, kind: 'screen-shrink', at: Math.max(0, next.bossAt - 15),
          warning: 1.8, contract: 2, hold: 6, recover: 2, inset: 45, scale: .82 }));
        setSelectedGimmick(id);
      }}>＋ 画面縮小</button></div>
      <p className="editor-help">同じ時間に複数配置できます。時間軸では重ならない段に分けて表示します。</p>
      <div className="editor-gimmick-list">{[...draft.gimmicks].sort((a, b) => a.at - b.at).map((event, index) => <button
        key={event.id} className={`editor-gimmick-item ${selectedGimmickId === event.id ? 'active' : ''}`}
        onClick={() => setSelectedGimmick(event.id)} aria-label={`${event.at.toFixed(1)}秒の画面縮小を編集`}>
        <span className="editor-gimmick-icon" aria-hidden="true">▣</span><span><strong>画面縮小 {index + 1}</strong>
          <small>{event.at.toFixed(1)}–{(event.at + gimmickDuration(event)).toFixed(1)}秒</small></span>
        <span className="editor-gimmick-count">{draft.gimmicks.filter((other) => other.id !== event.id &&
          other.at < event.at + gimmickDuration(event) && event.at < other.at + gimmickDuration(other)).length ? '重なりあり' : ''}</span>
      </button>)}</div></section>
      <section className="editor-panel editor-inspector">{currentGimmick ? <>
        <div className="editor-panel-heading"><div className="editor-gimmick-title"><span className="editor-kicker">GIMMICK · <TimeMark time={currentGimmick.at} /></span><h2>画面縮小</h2></div>
          <div><button onClick={() => {
            const id = crypto.randomUUID();
            change((next) => { const copy = structuredClone(next.gimmicks.find((event) => event.id === currentGimmick.id)!);
              copy.id = id; copy.at = Math.min(next.bossAt, copy.at + .5); next.gimmicks.push(copy); });
            setSelectedGimmick(id);
          }}>複製</button><button className="editor-danger" onClick={() => {
            change((next) => { next.gimmicks = next.gimmicks.filter((event) => event.id !== currentGimmick.id); });
            setSelectedGimmick(null);
          }}>削除</button></div></div>
        <p className="editor-help">縮小幅は足し合わせ、画面の表示倍率は掛け合わせます。遊べる範囲の下限は維持されます。</p>
        <div className="editor-fields">{([['開始 / 秒', 'at'], ['予告 / 秒', 'warning'], ['縮小 / 秒', 'contract'], ['維持 / 秒', 'hold'], ['回復 / 秒', 'recover']] as const).map(([label, key]) =>
          <NumberField key={key} label={label} value={currentGimmick[key]} min={0} max={key === 'at' ? draft.bossAt : undefined}
            onChange={(value) => updateGimmickEvent(currentGimmick.id, (event) => { event[key] = value; })} />)}
          <NumberField label="内側への幅" value={currentGimmick.inset} min={0} max={250}
            onChange={(value) => updateGimmickEvent(currentGimmick.id, (event) => { event.inset = value; })} />
          <NumberField label="縮小率" value={currentGimmick.scale} min={.3} max={1} step={.01}
            onChange={(value) => updateGimmickEvent(currentGimmick.id, (event) => { event.scale = value; })} /></div>
      </> : <p className="editor-empty">画面縮小を追加すると、発生時刻と強さを編集できます。</p>}</section></div>}
    <footer className="editor-footer"><span>下書きはこのブラウザに保存されます。共有・バックアップには「書き出し」を使ってください。</span>
      <button onClick={() => {
        if (dirty && !window.confirm('未保存の変更を破棄して元のステージを読み込みますか？')) return;
        setDraft(createStageDraft(base)); setSelectedSpawn(null); setSelectedEnemyIds([]); setSelectedGroup(null); setFormationSettings({}); setSelectedGimmick(null); setDirty(true); setMessage('元の内容を読み込みました。保存すると反映されます。');
      }}>元のステージを読み込む</button></footer>
  </main>;
}
