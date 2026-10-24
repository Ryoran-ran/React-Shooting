import type { Vec2 } from '../game/core/coordinates';
import type { DraftSpawn, FormationGroup, StageDraft } from '../game/stages/stageDraft';
import { snapRoutePoint } from './editorRoute';

const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type FormationPattern = 'row' | 'column' | 'two-columns' | 'v';

export interface FormationLayout {
  origin: Vec2;
  positions: Vec2[];
}

/** Place members in spawn-time order, without changing their timing or behavior. */
export function planFormationLayout(group: FormationGroup, members: DraftSpawn[], pattern: FormationPattern,
  spacing: number, columnWidth: number, gridSize: number): FormationLayout {
  const origin = snapRoutePoint(group.origin, gridSize);
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
    return { x: clamp(round(point.x), -100, 820), y: clamp(round(point.y), -100, 820) };
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
  members.forEach((spawn, index) => { spawn.position = layout.positions[index]; });
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
  const group: FormationGroup = { id, name,
    origin: { x: round(selected.reduce((sum, spawn) => sum + spawn.position.x, 0) / selected.length),
      y: round(selected.reduce((sum, spawn) => sum + spawn.position.y, 0) / selected.length) } };
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
  for (const spawn of members) spawn.time = Math.round((spawn.time + nextStart - start) * 1000) / 1000;
}

export function moveGroup(draft: StageDraft, id: string, requestedOrigin: Vec2): void {
  const group = draft.groups.find((item) => item.id === id);
  if (!group) return;
  const members = groupMembers(draft, id);
  const dx = clamp(round(requestedOrigin.x - group.origin.x),
    Math.max(...members.map((spawn) => -200 - spawn.position.x)),
    Math.min(...members.map((spawn) => 920 - spawn.position.x)));
  const dy = clamp(round(requestedOrigin.y - group.origin.y),
    Math.max(...members.map((spawn) => -200 - spawn.position.y)),
    Math.min(...members.map((spawn) => 920 - spawn.position.y)));
  group.origin.x = round(group.origin.x + dx);
  group.origin.y = round(group.origin.y + dy);
  for (const spawn of members) {
    spawn.position.x = round(spawn.position.x + dx);
    spawn.position.y = round(spawn.position.y + dy);
  }
}

export function moveMember(draft: StageDraft, id: string, enemyId: string, point: Vec2): void {
  const spawn = draft.spawns.find((item) => item.editorId === enemyId && item.groupId === id);
  if (spawn) spawn.position = { x: clamp(Math.round(point.x * 100) / 100, -200, 920),
    y: clamp(Math.round(point.y * 100) / 100, -200, 920) };
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
