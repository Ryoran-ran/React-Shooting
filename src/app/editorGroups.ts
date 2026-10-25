import type { Vec2 } from '../game/core/coordinates';
import type { DraftSpawn, FormationGroup, StageDraft } from '../game/stages/stageDraft';
import { getRouteGoal, ROUTE_PREVIEW_SECONDS, routeTiming, setRouteGoal, setRouteOrigin,
  shiftRouteTime, snapRoutePoint, translateRoute, routePoints } from './editorRoute';

const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const snapWithin = (point: Vec2, gridSize: number, min: number, max: number): Vec2 => {
  if (gridSize <= 0) return point;
  const lower = Math.ceil(min / gridSize) * gridSize;
  const upper = Math.floor(max / gridSize) * gridSize;
  return { x: clamp(Math.round(point.x / gridSize) * gridSize, lower, upper),
    y: clamp(Math.round(point.y / gridSize) * gridSize, lower, upper) };
};

export type FormationPattern = 'row' | 'column' | 'two-columns' | 'v';

export interface FormationLayout {
  origin: Vec2;
  positions: Vec2[];
}

export function formationGoal(spawn: DraftSpawn): Vec2 | null {
  const goal = getRouteGoal(spawn, ROUTE_PREVIEW_SECONDS);
  if (goal) return goal.position;
  if (spawn.motion.kind === 'fixed') return spawn.motion.destination;
  if (spawn.motion.kind === 'path') return spawn.motion.points.at(-1) ?? null;
  return null;
}

/** Earlier drafts stored the center of spawn points; align it with screen goals once. */
export function upgradeFormationOrigins(draft: StageDraft): StageDraft {
  for (const group of draft.groups) {
    if (group.originMode === 'goal') continue;
    const goals = groupMembers(draft, group.id).map(formationGoal).filter((point): point is Vec2 => point !== null);
    if (goals.length) group.origin = {
      x: clamp(round(goals.reduce((sum, point) => sum + point.x, 0) / goals.length), 0, 720),
      y: clamp(round(goals.reduce((sum, point) => sum + point.y, 0) / goals.length), 0, 720),
    };
    group.originMode = 'goal';
  }
  return draft;
}

function placeFormationGoal(spawn: DraftSpawn, requested: Vec2): void {
  const point = { x: clamp(round(requested.x), 0, 720), y: clamp(round(requested.y), 0, 720) };
  const goal = getRouteGoal(spawn, ROUTE_PREVIEW_SECONDS);
  if (goal) { setRouteGoal(spawn, point, goal.at); return; }
  const duration = routeTiming(spawn, ROUTE_PREVIEW_SECONDS).duration;
  if (spawn.motion.kind === 'fixed') spawn.motion.destination = point;
  else if (spawn.motion.kind === 'path' && spawn.motion.points.length) spawn.motion.points[spawn.motion.points.length - 1] = point;
  else return;
  if (duration !== null && duration > 0 && 'speed' in spawn.motion) {
    const distance = routeTiming(spawn, ROUTE_PREVIEW_SECONDS).distance ?? 0;
    spawn.motion.speed = clamp(Math.round(distance / duration * 1000) / 1000, 1, 1000);
  }
}

function placeFormationStart(spawn: DraftSpawn, requested: Vec2): void {
  const point = { x: clamp(round(requested.x), -200, 920), y: clamp(round(requested.y), -200, 920) };
  const duration = routeTiming(spawn, ROUTE_PREVIEW_SECONDS).duration;
  setRouteOrigin(spawn, point, ROUTE_PREVIEW_SECONDS);
  if (duration !== null && duration > 0 && 'speed' in spawn.motion) {
    const distance = routeTiming(spawn, ROUTE_PREVIEW_SECONDS).distance ?? 0;
    spawn.motion.speed = clamp(Math.round(distance / duration * 1000) / 1000, 1, 1000);
  }
}

export function formationStartCenter(members: DraftSpawn[]): Vec2 {
  if (!members.length) return { x: 360, y: 360 };
  return { x: round(members.reduce((sum, spawn) => sum + spawn.position.x, 0) / members.length),
    y: round(members.reduce((sum, spawn) => sum + spawn.position.y, 0) / members.length) };
}

/** Arrange screen goals in spawn-time order; starts and arrival timing stay in place. */
export function planFormationLayout(group: FormationGroup, members: DraftSpawn[], pattern: FormationPattern,
  spacing: number, columnWidth: number, gridSize: number): FormationLayout {
  const snapped = snapRoutePoint(group.origin, gridSize);
  const origin = { x: clamp(snapped.x, 0, 720), y: clamp(snapped.y, 0, 720) };
  const gap = Math.max(gridSize || 1, spacing);
  const width = Math.max(gridSize || 1, columnWidth);
  const positions = members.map((_, index) => {
    let x = origin.x;
    let y = origin.y;
    if (pattern === 'row') x += (index - (members.length - 1) / 2) * gap;
    if (pattern === 'column') y += (index - (members.length - 1) / 2) * gap;
    if (pattern === 'two-columns' && members.length > 1) {
      const left = index % 2 === 0;
      const row = Math.floor(index / 2);
      const count = left ? Math.ceil(members.length / 2) : Math.floor(members.length / 2);
      x += (left ? -1 : 1) * width / 2;
      y += (row - (count - 1) / 2) * gap;
    }
    if (pattern === 'v') {
      const row = Math.floor(index / 2);
      x += (index % 2 === 0 ? -1 : 1) * (row + .5) * gap;
      y += row * gap;
    }
    const point = snapRoutePoint({ x, y }, gridSize);
    return { x: clamp(round(point.x), 0, 720), y: clamp(round(point.y), 0, 720) };
  });
  return { origin, positions };
}

export function arrangeGroup(draft: StageDraft, id: string, pattern: FormationPattern,
  spacing: number, columnWidth: number, gridSize: number): void {
  const group = draft.groups.find((item) => item.id === id);
  if (!group) return;
  const members = groupMembers(draft, id);
  const layout = planFormationLayout(group, members, pattern, spacing, columnWidth, gridSize);
  group.origin = layout.origin;
  members.forEach((spawn, index) => { if (formationGoal(spawn)) placeFormationGoal(spawn, layout.positions[index]); });
}

export function groupMembers(draft: StageDraft, id: string): DraftSpawn[] {
  return draft.spawns.filter((spawn) => spawn.groupId === id).sort((a, b) => a.time - b.time);
}

export function groupStart(draft: StageDraft, id: string): number {
  return Math.min(...groupMembers(draft, id).map((spawn) => spawn.time));
}

export function groupEnd(draft: StageDraft, id: string): number {
  return Math.max(...groupMembers(draft, id).map((spawn) => spawn.time));
}

export function removeEmptyGroups(draft: StageDraft): void {
  draft.groups = draft.groups.filter((group) => draft.spawns.some((spawn) => spawn.groupId === group.id));
}

export function createGroup(draft: StageDraft, enemyIds: string[], id: string, name: string): FormationGroup | null {
  const selected = draft.spawns.filter((spawn) => enemyIds.includes(spawn.editorId));
  if (!selected.length) return null;
  const goals = selected.map(formationGoal).filter((point): point is Vec2 => point !== null);
  const anchors = goals.length ? goals : selected.map((spawn) => spawn.position);
  const group: FormationGroup = { id, name, originMode: 'goal',
    origin: { x: clamp(round(anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length), 0, 720),
      y: clamp(round(anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length), 0, 720) } };
  for (const spawn of selected) spawn.groupId = id;
  draft.groups.push(group);
  removeEmptyGroups(draft);
  return group;
}

export function shiftGroupTime(draft: StageDraft, id: string, requestedStart: number): void {
  const members = groupMembers(draft, id);
  if (!members.length) return;
  const start = members[0].time;
  const lastOffset = members[members.length - 1].time - start;
  const nextStart = clamp(requestedStart, 0, draft.bossAt - lastOffset);
  for (const spawn of members) shiftRouteTime(spawn, nextStart - start);
}

export function moveGroup(draft: StageDraft, id: string, requestedOrigin: Vec2, gridSize = 0): void {
  const group = draft.groups.find((item) => item.id === id);
  if (!group) return;
  const members = groupMembers(draft, id);
  const goals = members.map(formationGoal).filter((point): point is Vec2 => point !== null);
  const dx = clamp(round(requestedOrigin.x - group.origin.x),
    goals.length ? Math.max(...goals.map((point) => -point.x)) : -group.origin.x,
    goals.length ? Math.min(...goals.map((point) => 720 - point.x)) : 720 - group.origin.x);
  const dy = clamp(round(requestedOrigin.y - group.origin.y),
    goals.length ? Math.max(...goals.map((point) => -point.y)) : -group.origin.y,
    goals.length ? Math.min(...goals.map((point) => 720 - point.y)) : 720 - group.origin.y);
  group.origin.x = round(group.origin.x + dx);
  group.origin.y = round(group.origin.y + dy);
  for (const spawn of members) {
    const goal = formationGoal(spawn);
    if (goal) placeFormationGoal(spawn, snapWithin({ x: goal.x + dx, y: goal.y + dy }, gridSize, 0, 720));
  }
}

export function moveMember(draft: StageDraft, id: string, enemyId: string, point: Vec2): void {
  const spawn = draft.spawns.find((item) => item.editorId === enemyId && item.groupId === id);
  if (spawn) placeFormationGoal(spawn, point);
}

export function moveMemberStart(draft: StageDraft, id: string, enemyId: string, point: Vec2): void {
  const spawn = draft.spawns.find((item) => item.editorId === enemyId && item.groupId === id);
  if (spawn) placeFormationStart(spawn, point);
}

/** Move one enemy's start, goal and intermediate route points by the same offset. */
export function moveMemberRoute(draft: StageDraft, id: string, enemyId: string, requestedStart: Vec2): void {
  const spawn = draft.spawns.find((item) => item.editorId === enemyId && item.groupId === id);
  if (!spawn) return;
  const points = routePoints(spawn, ROUTE_PREVIEW_SECONDS);
  const limits = points.map((point, index) => {
    const onScreenGoal = index === points.length - 1 && points.length > 1
      && point.x >= 0 && point.x <= 720 && point.y >= 0 && point.y <= 720;
    return { point, min: onScreenGoal ? 0 : -200, max: onScreenGoal ? 720 : 920 };
  });
  const offset = { x: clamp(round(requestedStart.x - spawn.position.x),
    Math.max(...limits.map(({ point, min }) => min - point.x)),
    Math.min(...limits.map(({ point, max }) => max - point.x))),
  y: clamp(round(requestedStart.y - spawn.position.y),
    Math.max(...limits.map(({ point, min }) => min - point.y)),
    Math.min(...limits.map(({ point, max }) => max - point.y))) };
  translateRoute(spawn, offset, ROUTE_PREVIEW_SECONDS);
}

export function moveGroupStarts(draft: StageDraft, id: string, requestedCenter: Vec2, gridSize = 0): void {
  const members = groupMembers(draft, id);
  if (!members.length) return;
  const center = formationStartCenter(members);
  const dx = clamp(round(requestedCenter.x - center.x),
    Math.max(...members.map((spawn) => -200 - spawn.position.x)),
    Math.min(...members.map((spawn) => 920 - spawn.position.x)));
  const dy = clamp(round(requestedCenter.y - center.y),
    Math.max(...members.map((spawn) => -200 - spawn.position.y)),
    Math.min(...members.map((spawn) => 920 - spawn.position.y)));
  for (const spawn of members) placeFormationStart(spawn,
    snapWithin({ x: spawn.position.x + dx, y: spawn.position.y + dy }, gridSize, -200, 920));
}

export function ungroup(draft: StageDraft, id: string): void {
  for (const spawn of draft.spawns) if (spawn.groupId === id) delete spawn.groupId;
  draft.groups = draft.groups.filter((group) => group.id !== id);
}

/** Optional starting point for reviewing nearby enemies as formations. */
export function groupNearby(draft: StageDraft, nextId: () => string): string[] {
  const available = draft.spawns.filter((spawn) => !spawn.groupId).sort((a, b) => a.time - b.time);
  const clusters: DraftSpawn[][] = [];
  for (const spawn of available) {
    const current = clusters[clusters.length - 1];
    if (current && spawn.time - current[current.length - 1].time <= 1.6 && spawn.time - current[0].time <= 4)
      current.push(spawn);
    else clusters.push([spawn]);
  }
  const created: string[] = [];
  for (const cluster of clusters.filter((items) => items.length >= 2)) {
    const id = nextId();
    createGroup(draft, cluster.map((spawn) => spawn.editorId), id, `編隊 ${draft.groups.length + 1}`);
    created.push(id);
  }
  return created;
}
