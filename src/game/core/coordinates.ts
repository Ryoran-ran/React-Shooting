export interface Vec2 { x: number; y: number }
export interface FieldBounds { x: number; y: number; width: number; height: number }
export interface ViewTransform { offset: Vec2; scale: Vec2; rotation: number }

export const createDefaultView = (): ViewTransform => ({
  offset: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0,
});

// View transforms never mutate world positions or field bounds.
export function worldToScreen(point: Vec2, view: ViewTransform): Vec2 {
  const x = point.x * view.scale.x;
  const y = point.y * view.scale.y;
  const c = Math.cos(view.rotation);
  const s = Math.sin(view.rotation);
  return { x: x * c - y * s + view.offset.x, y: x * s + y * c + view.offset.y };
}

export function screenToWorld(point: Vec2, view: ViewTransform): Vec2 {
  const x = point.x - view.offset.x;
  const y = point.y - view.offset.y;
  const c = Math.cos(view.rotation);
  const s = Math.sin(view.rotation);
  return { x: (x * c + y * s) / view.scale.x, y: (-x * s + y * c) / view.scale.y };
}

export function interpolate(previous: Vec2, current: Vec2, alpha: number): Vec2 {
  return { x: previous.x + (current.x - previous.x) * alpha, y: previous.y + (current.y - previous.y) * alpha };
}
