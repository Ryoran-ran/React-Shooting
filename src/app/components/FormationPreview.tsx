import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Vec2 } from '../../game/core/coordinates';
import type { DraftSpawn, FormationGroup } from '../../game/stages/stageDraft';
import { ROUTE_VIEW_MAX, ROUTE_VIEW_MIN, snapRoutePoint } from '../editorRoute';

const colors: Record<string, string> = {
  small: '#d9a9c7', medium: '#e1bf83', turret: '#dba7b7', rusher: '#b8aee9', large: '#a9c6ed',
};

interface FormationPreviewProps {
  group: FormationGroup;
  members: DraftSpawn[];
  gridSize: number;
  onMove: (handle: string, point: Vec2) => void;
  selectedEnemyId?: string;
  onSelectEnemy?: (id: string) => void;
  previewPositions?: Vec2[];
}

export function FormationPreview({ group, members, gridSize, onMove, selectedEnemyId, onSelectEnemy,
  previewPositions }: FormationPreviewProps) {
  const drag = useRef<{ pointerId: number; handle: string } | null>(null);
  const pointerPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(Math.max(ROUTE_VIEW_MIN, Math.min(ROUTE_VIEW_MAX, point.x))),
      y: Math.round(Math.max(ROUTE_VIEW_MIN, Math.min(ROUTE_VIEW_MAX, point.y))) };
  };
  const startDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const handle = (event.target as Element).getAttribute('data-formation-handle');
    if (!handle) return;
    if (handle !== 'group') onSelectEnemy?.(handle);
    drag.current = { pointerId: event.pointerId, handle };
    event.currentTarget.setPointerCapture(event.pointerId);
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
  return <div className="editor-formation-preview">
    <div className="editor-route-caption"><strong>フォーメーション</strong><span>720 × 720</span></div>
    <svg viewBox="-100 -100 920 920" role="img" aria-label={`${group.name}の出現位置。番号を選択またはドラッグして各敵を、中央の菱形をドラッグして全体を移動できます`}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onLostPointerCapture={() => { drag.current = null; }}>
      <defs>{gridSize > 0 && <pattern id="formation-grid-pattern" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
        <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} className="editor-grid-line" /></pattern>}</defs>
      <rect x="0" y="0" width="720" height="720" rx="12" className="editor-route-field" />
      {gridSize > 0 && <rect x="-100" y="-100" width="920" height="920" fill="url(#formation-grid-pattern)" pointerEvents="none" />}
      <path d="M360 0v720M0 360h720" className="editor-route-grid" />
      {previewPositions?.map((point, index) => {
        const spawn = members[index];
        if (!spawn || (spawn.position.x === point.x && spawn.position.y === point.y)) return null;
        return <g key={spawn.editorId} pointerEvents="none">
          <line x1={spawn.position.x} y1={spawn.position.y} x2={point.x} y2={point.y} className="editor-formation-preview-line" />
          <circle cx={point.x} cy={point.y} r="25" className="editor-formation-preview-target" />
          <circle cx={point.x} cy={point.y} r="4" fill="#f8e3a9" />
        </g>;
      })}
      {members.map((spawn, index) => <g key={spawn.editorId}>
        <circle cx={spawn.position.x} cy={spawn.position.y} r="23" fill={colors[spawn.kind]}
          stroke={spawn.editorId === selectedEnemyId ? '#fff4d3' : '#7a9b9b'} strokeWidth={spawn.editorId === selectedEnemyId ? 7 : 3} />
        <text x={spawn.position.x} y={spawn.position.y + 8} textAnchor="middle">{index + 1}</text>
        <circle cx={spawn.position.x} cy={spawn.position.y} r="42" className="editor-route-hit" data-formation-handle={spawn.editorId}>
          <title>敵 {index + 1} を選択・ドラッグ</title></circle>
      </g>)}
      <path d={`M${group.origin.x} ${group.origin.y - 22}l22 22 -22 22 -22 -22Z`} className="editor-formation-origin" />
      <circle cx={group.origin.x} cy={group.origin.y} r="36" className="editor-route-hit" data-formation-handle="group">
        <title>編隊全体をドラッグ</title></circle>
    </svg>
    <p>番号：敵を選択・個別に移動　◇：編隊全体を移動。点線の輪は整列後の位置です。</p>
  </div>;
}
