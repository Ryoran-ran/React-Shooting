import { expect, it } from 'vitest';
import { arrangeGroup, createGroup, formationGoal, formationStartCenter, groupMembers, groupNearby, groupStart, moveGroup,
  moveGroupStarts, moveMember, moveMemberStart, moveMemberRoute,
  planFormationLayout, shiftGroupTime, ungroup, upgradeFormationOrigins } from '../app/editorGroups';
import { compileStageDraft, createStageDraft, parseStageDraft } from '../game/stages/stageDraft';
import { stageTwo } from '../game/stages/stages';
import { getRouteGoal, routeTiming } from '../app/editorRoute';

it('moves formation goals without moving starts, and shifts their timing together', () => {
  const draft = createStageDraft(stageTwo);
  const ids = draft.spawns.slice(0, 2).map((spawn) => spawn.editorId);
  const original = draft.spawns.slice(0, 2).map((spawn) => ({ time: spawn.time, position: { ...spawn.position } }));
  const group = createGroup(draft, ids, 'formation-a', '左右の群れ')!;
  const goals = groupMembers(draft, group.id).map((spawn) => formationGoal(spawn)!);
  expect(groupMembers(draft, group.id)).toHaveLength(2);
  expect(groupStart(draft, group.id)).toBe(original[0].time);
  moveGroup(draft, group.id, { x: group.origin.x + 20, y: group.origin.y + 40 });
  expect(draft.spawns[0].position).toEqual(original[0].position);
  expect(draft.spawns[1].position).toEqual(original[1].position);
  expect(groupMembers(draft, group.id).map((spawn) => formationGoal(spawn))).toEqual(
    goals.map((point) => ({ x: point.x + 20, y: point.y + 40 })));
  moveMember(draft, group.id, ids[1], { x: 700, y: 280 });
  expect(draft.spawns[1].position).toEqual(original[1].position);
  expect(formationGoal(draft.spawns[1])).toEqual({ x: 700, y: 280 });
  moveMemberStart(draft, group.id, ids[1], { x: 760, y: 280 });
  expect(draft.spawns[1].position).toEqual({ x: 760, y: 280 });
  expect(formationGoal(draft.spawns[1])).toEqual({ x: 700, y: 280 });
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

it('re-centers groups saved before goals became the formation anchor', () => {
  const draft = createStageDraft(stageTwo);
  const group = createGroup(draft, draft.spawns.slice(0, 2).map((spawn) => spawn.editorId), 'legacy', '旧編隊')!;
  group.origin = { x: 360, y: 120 };
  delete group.originMode;
  const upgraded = upgradeFormationOrigins(parseStageDraft(draft));
  expect(upgraded.groups[0].origin).toEqual({ x: 360, y: 184 });
  expect(upgraded.groups[0].originMode).toBe('goal');
  expect(upgradeFormationOrigins(upgraded).groups[0].origin).toEqual({ x: 360, y: 184 });
});

it('moves only formation starts when editing the start center', () => {
  const draft = createStageDraft(stageTwo);
  const group = createGroup(draft, draft.spawns.slice(0, 6).map((spawn) => spawn.editorId), 'starts', '出現位置')!;
  const members = groupMembers(draft, group.id);
  const center = formationStartCenter(members);
  const starts = members.map((spawn) => ({ ...spawn.position }));
  const goals = members.map((spawn) => formationGoal(spawn));
  const arrivals = members.map((spawn) => getRouteGoal(spawn, 3)?.at);
  moveGroupStarts(draft, group.id, { x: center.x + 20, y: center.y + 40 });
  expect(formationStartCenter(members)).toEqual({ x: center.x + 20, y: center.y + 40 });
  expect(members.map((spawn) => spawn.position)).toEqual(starts.map((point) => ({ x: point.x + 20, y: point.y + 40 })));
  expect(members.map(formationGoal)).toEqual(goals);
  expect(members.map((spawn) => getRouteGoal(spawn, 3)?.at)).toEqual(arrivals);
});

it('places every member on grid intersections when dragging formation centers', () => {
  const draft = createStageDraft(stageTwo);
  const group = createGroup(draft, draft.spawns.slice(0, 6).map((spawn) => spawn.editorId), 'grid', 'マス目')!;
  moveGroup(draft, group.id, { x: group.origin.x + 40, y: group.origin.y + 40 }, 40);
  expect(groupMembers(draft, group.id).map(formationGoal).every((point) =>
    point !== null && point.x % 40 === 0 && point.y % 40 === 0)).toBe(true);
  const center = formationStartCenter(groupMembers(draft, group.id));
  moveGroupStarts(draft, group.id, { x: center.x + 40, y: center.y + 40 }, 40);
  expect(groupMembers(draft, group.id).every((spawn) =>
    spawn.position.x % 40 === 0 && spawn.position.y % 40 === 0)).toBe(true);
  expect(parseStageDraft(draft)).toBeDefined();
});

it('translates one enemy route while preserving its start-to-goal vector and timing', () => {
  const draft = createStageDraft(stageTwo);
  const group = createGroup(draft, draft.spawns.slice(0, 2).map((spawn) => spawn.editorId), 'route', '経路')!;
  const spawn = draft.spawns[0];
  const other = structuredClone(draft.spawns[1]);
  const start = { ...spawn.position };
  const goal = { ...formationGoal(spawn)! };
  const motion = structuredClone(spawn.motion);
  const arrival = getRouteGoal(spawn, 3)!.at;
  moveMemberRoute(draft, group.id, spawn.editorId, { x: start.x + 40, y: start.y + 40 });
  expect(spawn.position).toEqual({ x: start.x + 40, y: start.y + 40 });
  expect(formationGoal(spawn)).toEqual({ x: goal.x + 40, y: goal.y + 40 });
  expect(spawn.motion).toEqual(motion);
  expect(getRouteGoal(spawn, 3)!.at).toBe(arrival);
  expect(draft.spawns[1]).toEqual(other);
  expect(parseStageDraft(draft)).toBeDefined();

  moveMemberRoute(draft, group.id, spawn.editorId, { x: 900, y: spawn.position.y });
  expect(formationGoal(spawn)!.x).toBe(720);
  expect(formationGoal(spawn)!.x - spawn.position.x).toBe(goal.x - start.x);
});

it('translates every waypoint of a path without changing its speed', () => {
  const draft = createStageDraft(stageTwo);
  const spawn = draft.spawns[0];
  spawn.motion = { kind: 'path', points: [{ x: 180, y: 160 }, { x: 300, y: 280 }], speed: 110, exitAtEnd: true };
  const group = createGroup(draft, [spawn.editorId], 'path', '経路')!;
  const start = { ...spawn.position };
  const duration = routeTiming(spawn, 3).duration;
  moveMemberRoute(draft, group.id, spawn.editorId, { x: start.x + 40, y: start.y + 80 });
  expect(spawn.position).toEqual({ x: start.x + 40, y: start.y + 80 });
  expect(spawn.motion).toEqual({ kind: 'path', points: [{ x: 220, y: 240 }, { x: 340, y: 360 }], speed: 110, exitAtEnd: true });
  expect(routeTiming(spawn, 3).duration).toBe(duration);
});

it('arranges screen goals while preserving starts, timing and attacks', () => {
  const draft = createStageDraft(stageTwo);
  const group = createGroup(draft, draft.spawns.slice(0, 6).map((spawn) => spawn.editorId), 'formation-six', '左右２列')!;
  const members = groupMembers(draft, group.id);
  const otherPosition = { ...draft.spawns[6].position };
  const behavior = members.map((spawn) => ({ time: spawn.time,
    attacks: structuredClone(spawn.attacks), position: { ...spawn.position }, arrivalAt: getRouteGoal(spawn, 3)?.at }));
  const layout = planFormationLayout(group, members, 'two-columns', 40, 800, 40);
  expect(layout.positions).toHaveLength(6);
  expect(layout.positions[0].x + layout.positions[1].x).toBe(layout.origin.x * 2);
  expect(layout.positions[0].y).toBe(layout.positions[1].y);
  expect(layout.positions[2].y - layout.positions[0].y).toBe(40);
  expect(layout.positions.every((point) => point.x % 40 === 0 && point.y % 40 === 0)).toBe(true);
  arrangeGroup(draft, group.id, 'two-columns', 40, 800, 40);
  expect(group.origin).toEqual(layout.origin);
  expect(groupMembers(draft, group.id).map((spawn) => formationGoal(spawn))).toEqual(layout.positions);
  expect(groupMembers(draft, group.id).map((spawn) => ({ time: spawn.time,
    attacks: spawn.attacks, position: spawn.position, arrivalAt: spawn.routeGoal?.at }))).toEqual(behavior);
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

it('moves fixed and path endpoints while leaving a chase enemy out of goal arrangements', () => {
  const draft = createStageDraft(stageTwo);
  draft.spawns[0].motion = { kind: 'fixed', destination: { x: 260, y: 240 }, speed: 100 };
  draft.spawns[1].motion = { kind: 'chase', speed: 120 };
  draft.spawns[2].motion = { kind: 'path', points: [{ x: 200, y: 100 }, { x: 300, y: 280 }], speed: 110, exitAtEnd: true };
  const group = createGroup(draft, draft.spawns.slice(0, 3).map((spawn) => spawn.editorId), 'mixed', '混成')!;
  const starts = draft.spawns.slice(0, 3).map((spawn) => ({ ...spawn.position }));
  const durations = [0, 2].map((index) => routeTiming(draft.spawns[index], 3).duration!);
  const layout = planFormationLayout(group, groupMembers(draft, group.id), 'row', 80, 80, 40);
  arrangeGroup(draft, group.id, 'row', 80, 80, 40);
  expect(formationGoal(draft.spawns[0])).toEqual(layout.positions[0]);
  expect(formationGoal(draft.spawns[1])).toBeNull();
  expect(formationGoal(draft.spawns[2])).toEqual(layout.positions[2]);
  expect(draft.spawns.slice(0, 3).map((spawn) => spawn.position)).toEqual(starts);
  expect(routeTiming(draft.spawns[0], 3).duration).toBeCloseTo(durations[0], 2);
  expect(routeTiming(draft.spawns[2], 3).duration).toBeCloseTo(durations[1], 2);
});
