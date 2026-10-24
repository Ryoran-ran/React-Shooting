import { expect, it } from 'vitest';
import { arrangeGroup, createGroup, groupMembers, groupNearby, groupStart, moveGroup, moveMember,
  planFormationLayout, shiftGroupTime, ungroup } from '../app/editorGroups';
import { compileStageDraft, createStageDraft, parseStageDraft } from '../game/stages/stageDraft';
import { stageTwo } from '../game/stages/stages';

it('groups enemies, moves the formation while preserving offsets, and shifts their timing together', () => {
  const draft = createStageDraft(stageTwo);
  const ids = draft.spawns.slice(0, 2).map((spawn) => spawn.editorId);
  const original = draft.spawns.slice(0, 2).map((spawn) => ({ time: spawn.time, position: { ...spawn.position } }));
  const group = createGroup(draft, ids, 'formation-a', '左右の群れ')!;
  expect(groupMembers(draft, group.id)).toHaveLength(2);
  expect(groupStart(draft, group.id)).toBe(original[0].time);
  moveGroup(draft, group.id, { x: group.origin.x + 20, y: group.origin.y + 40 });
  expect(draft.spawns[0].position).toEqual({ x: original[0].position.x + 20, y: original[0].position.y + 40 });
  expect(draft.spawns[1].position).toEqual({ x: original[1].position.x + 20, y: original[1].position.y + 40 });
  moveMember(draft, group.id, ids[1], { x: 700, y: 280 });
  expect(draft.spawns[0].position.x).toBe(original[0].position.x + 20);
  expect(draft.spawns[1].position).toEqual({ x: 700, y: 280 });
  shiftGroupTime(draft, group.id, 10);
  expect(draft.spawns[0].time).toBe(10);
  expect(draft.spawns[1].time - draft.spawns[0].time).toBeCloseTo(original[1].time - original[0].time);
  expect(parseStageDraft(draft).groups).toHaveLength(1);
  const playable = compileStageDraft(draft);
  expect(playable.combat.spawns.find((spawn) => spawn.time === 10)?.position).toEqual(draft.spawns[0].position);
  expect(playable.combat.spawns[0]).not.toHaveProperty('editorId');
  expect(playable.combat.spawns[0]).not.toHaveProperty('groupId');
  ungroup(draft, group.id);
  expect(draft.groups).toEqual([]);
  expect(draft.spawns[0].groupId).toBeUndefined();
});

it('can suggest nearby formations and rejects dangling group references', () => {
  const draft = createStageDraft(stageTwo);
  let id = 0;
  const created = groupNearby(draft, () => `group-${++id}`);
  expect(created.length).toBeGreaterThan(0);
  expect(draft.groups.length).toBe(created.length);
  expect(parseStageDraft(draft).groups).toHaveLength(created.length);
  draft.spawns[0].groupId = 'missing-group';
  expect(() => parseStageDraft(draft)).toThrow('編隊グループ');
});

it('previews and arranges a symmetric formation without changing enemy timing or attacks', () => {
  const draft = createStageDraft(stageTwo);
  const group = createGroup(draft, draft.spawns.slice(0, 6).map((spawn) => spawn.editorId), 'formation-six', '左右２列')!;
  const members = groupMembers(draft, group.id);
  const otherPosition = { ...draft.spawns[6].position };
  const behavior = members.map((spawn) => ({ time: spawn.time, motion: structuredClone(spawn.motion), attacks: structuredClone(spawn.attacks) }));
  const layout = planFormationLayout(group, members, 'two-columns', 40, 800, 40);
  expect(layout.positions).toHaveLength(6);
  expect(layout.positions[0].x + layout.positions[1].x).toBe(layout.origin.x * 2);
  expect(layout.positions[0].y).toBe(layout.positions[1].y);
  expect(layout.positions[2].y - layout.positions[0].y).toBe(40);
  expect(layout.positions.every((point) => point.x % 40 === 0 && point.y % 40 === 0)).toBe(true);
  arrangeGroup(draft, group.id, 'two-columns', 40, 800, 40);
  expect(group.origin).toEqual(layout.origin);
  expect(groupMembers(draft, group.id).map((spawn) => spawn.position)).toEqual(layout.positions);
  expect(groupMembers(draft, group.id).map((spawn) => ({ time: spawn.time, motion: spawn.motion, attacks: spawn.attacks }))).toEqual(behavior);
  expect(draft.spawns[6].position).toEqual(otherPosition);
  const row = planFormationLayout(group, members, 'row', 80, 800, 40);
  expect(new Set(row.positions.map((point) => point.y)).size).toBe(1);
  expect(row.positions[1].x - row.positions[0].x).toBe(80);
  const column = planFormationLayout(group, members, 'column', 40, 800, 40);
  expect(new Set(column.positions.map((point) => point.x)).size).toBe(1);
  const v = planFormationLayout(group, members, 'v', 40, 800, 40);
  expect(v.positions[0].x).toBeLessThan(v.positions[1].x);
  expect(v.positions[2].y).toBeGreaterThan(v.positions[0].y);
});
