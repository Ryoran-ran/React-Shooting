import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Vec2 } from '../../game/core/coordinates';
import type { DraftSpawn, FormationGroup } from '../../game/stages/stageDraft';
import { ROUTE_PREVIEW_SECONDS, ROUTE_VIEW_MAX, ROUTE_VIEW_MIN, routePoints, snapRoutePoint } from '../editorRoute';
import { formationGoal } from '../editorGroups';

const colors: Record<string, string> = {
  small: '#d9a9c7', medium: '#e1bf83', turret: '#dba7b7', rusher: '#b8aee9', large: '#a9c6ed',
};

interface FormationPreviewProps {
  group: FormationGroup;
  startCenter: Vec2;
  members: DraftSpawn[];
  gridSize: number;
  onMove: (handle: string, point: Vec2) => void;
  selectedEnemyId?: string;
  onSelectEnemy?: (id: string) => void;
  previewPositions?: Vec2[];
  showPreview: boolean;
  onShowPreviewChange: (show: boolean) => void;
}

export function FormationPreview({ group, startCenter, members, gridSize, onMove, selectedEnemyId, onSelectEnemy,
  previewPositions, showPreview, onShowPreviewChange }: FormationPreviewProps) {
  const drag = useRef<{ pointerId: number; handle: string; grab: { pointer: Vec2; point: Vec2 } } | null>(null);
  const pointerPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.max(ROUTE_VIEW_MIN, Math.min(ROUTE_VIEW_MAX, point.x)),
      y: Math.max(ROUTE_VIEW_MIN, Math.min(ROUTE_VIEW_MAX, point.y)) };
  };
  const startDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const target = (event.target as Element).closest('[data-formation-handle]');
    const handle = target?.getAttribute('data-formation-handle');
    const point = pointerPoint(event);
    if (!handle || !point) return;
    const [kind, id] = handle.split(':');
    const spawn = id ? members.find((item) => item.editorId === id) : null;
    const handlePoint = handle === 'group-goal' ? group.origin : handle === 'group-start' ? startCenter
      : kind === 'goal' && spawn ? formationGoal(spawn) : spawn?.position;
    if (!handlePoint) return;
    if (handle.includes(':')) onSelectEnemy?.(handle.slice(handle.indexOf(':') + 1));
    drag.current = { pointerId: event.pointerId, handle,
      grab: { pointer: point, point: { ...handlePoint } } };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const point = pointerPoint(event);
    if (point) {
      const { grab } = drag.current;
      onMove(drag.current.handle, snapRoutePoint(
        { x: grab.point.x + point.x - grab.pointer.x, y: grab.point.y + point.y - grab.pointer.y }, gridSize));
    }
  };
  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const startMarkers = members.map((spawn, index) => <g key={spawn.editorId}
    className={`editor-formation-start ${spawn.editorId === selectedEnemyId ? 'selected' : ''}`}>
    <circle cx={spawn.position.x} cy={spawn.position.y} r="27" style={{ stroke: colors[spawn.kind] }} />
    <text x={spawn.position.x} y={spawn.position.y + 7} textAnchor="middle">S{index + 1}</text>
    <circle cx={spawn.position.x} cy={spawn.position.y} r="34" className="editor-route-hit"
      data-formation-handle={`start:${spawn.editorId}`}>
      <title>敵 {index + 1} の出現位置を移動</title></circle>
  </g>);
  const goalMarkers = members.map((spawn, index) => {
    const goal = formationGoal(spawn);
    if (!goal) return null;
    const selected = spawn.editorId === selectedEnemyId;
    return <g key={spawn.editorId} className={`editor-formation-goal ${selected ? 'selected' : ''}`}>
      <circle cx={goal.x} cy={goal.y} r="20" fill={colors[spawn.kind]} />
      <text x={goal.x} y={goal.y + 8} textAnchor="middle">{index + 1}</text>
      <circle cx={goal.x} cy={goal.y} r="25" className="editor-route-hit"
        data-formation-handle={`goal:${spawn.editorId}`}>
        <title>敵 {index + 1} の画面内ゴールを移動</title></circle>
    </g>;
  });
  return <div className="editor-formation-preview">
    <div className="editor-route-caption"><strong>スタートとゴールを配置</strong>
      <span>720 × 720 · {gridSize ? `${gridSize}px マス` : '自由配置'}</span></div>
    <div className="editor-formation-legend"><span><i className="goal" />画面内のゴール</span>
      <span><i className="start" />出現位置（S）</span>
      {showPreview && <span><i className="planned" />整列後のゴール</span>}
      <label className="editor-formation-preview-toggle"><input type="checkbox" checked={showPreview}
        onChange={(event) => onShowPreviewChange(event.target.checked)} />整列後の位置を表示</label></div>
    <svg viewBox="-100 -100 920 920" role="img" aria-label={`${group.name}の経路。スタート、ゴール、選択中の経路をドラッグできます`}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onLostPointerCapture={() => { drag.current = null; }}>
      <defs>{gridSize > 0 && <pattern id="formation-grid-pattern" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
        <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} className="editor-grid-line" /></pattern>}
        <marker id="formation-route-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10Z" fill="#f6e7b7" /></marker></defs>
      <rect x="0" y="0" width="720" height="720" rx="12" className="editor-route-field" />
      {gridSize > 0 && <rect x="-100" y="-100" width="920" height="920" fill="url(#formation-grid-pattern)" pointerEvents="none" />}
      <path d="M360 0v720M0 360h720" className="editor-route-grid" />
      {members.map((spawn) => {
        const points = routePoints(spawn, ROUTE_PREVIEW_SECONDS);
        if (points.length < 2) return null;
        const coordinates = points.map((point) => `${point.x},${point.y}`).join(' ');
        return <g key={spawn.editorId}>
          <polyline points={coordinates}
            className={`editor-formation-route ${spawn.editorId === selectedEnemyId ? 'selected' : ''}`}
            markerEnd={spawn.editorId === selectedEnemyId ? 'url(#formation-route-arrow)' : undefined} />
          {spawn.editorId === selectedEnemyId && <polyline points={coordinates} className="editor-formation-route-hit"
            data-formation-handle={`route:${spawn.editorId}`}><title>経路全体を平行移動</title></polyline>}
        </g>;
      })}
      {previewPositions?.map((point, index) => {
        const spawn = members[index];
        const goal = spawn && formationGoal(spawn);
        if (!goal || (goal.x === point.x && goal.y === point.y)) return null;
        return <g key={spawn.editorId} className="editor-formation-planned" pointerEvents="none">
          <line x1={goal.x} y1={goal.y} x2={point.x} y2={point.y} />
          <circle cx={point.x} cy={point.y} r="26" /><text x={point.x} y={point.y + 8} textAnchor="middle">{index + 1}</text>
        </g>;
      })}
      <rect x={startCenter.x - 20} y={startCenter.y - 20} width="40" height="40" rx="4"
        className="editor-formation-start-center" pointerEvents="none" />
      <circle cx={startCenter.x} cy={startCenter.y} r="34" className="editor-route-hit"
        data-formation-handle="group-start"><title>編隊の出現位置をまとめて移動</title></circle>
      <path d={`M${group.origin.x} ${group.origin.y - 20}l20 20 -20 20 -20 -20Z`} className="editor-formation-origin" />
      <circle cx={group.origin.x} cy={group.origin.y} r="24" className="editor-route-hit" data-formation-handle="group-goal">
        <title>編隊のゴールをまとめて移動</title></circle>
      {startMarkers}
      {goalMarkers}
    </svg>
    <p>番号をドラッグするとゴール、Sをドラッグすると出現位置だけを動かせます。選択中の明るい経路をドラッグすると両方を平行移動します。菱形は編隊のゴール、四角は編隊の出現位置をまとめて動かします。</p>
  </div>;
}
