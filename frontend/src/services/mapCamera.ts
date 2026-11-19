export interface Camera {
  x: number;
  y: number;
  zoom: number;
  angle: number;
}

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

export const countryView: Camera = { x: 420, y: 280, zoom: 1, angle: 0 };

export function getScale(size: Size, zoom: number) {
  return Math.min(size.width / 840, size.height / 560) * zoom;
}

export function toScreen(camera: Camera, size: Size, point: Point): Point {
  const scale = getScale(size, camera.zoom);
  const cosine = Math.cos(camera.angle);
  const sine = Math.sin(camera.angle);
  const x = point.x - camera.x;
  const y = point.y - camera.y;
  return {
    x: size.width / 2 + scale * (cosine * x - sine * y),
    y: size.height / 2 + scale * (sine * x + cosine * y),
  };
}

export function toMap(camera: Camera, size: Size, point: Point): Point {
  const scale = getScale(size, camera.zoom);
  const cosine = Math.cos(camera.angle);
  const sine = Math.sin(camera.angle);
  const x = (point.x - size.width / 2) / scale;
  const y = (point.y - size.height / 2) / scale;
  return { x: camera.x + cosine * x + sine * y, y: camera.y - sine * x + cosine * y };
}

export function keepPoint(
  camera: Camera, size: Size, from: Point, to: Point, zoom = camera.zoom, angle = camera.angle,
): Camera {
  const next = { ...camera, zoom: Math.max(1, Math.min(6, zoom)), angle };
  const fixed = toMap(camera, size, from);
  const shifted = toMap(next, size, to);
  return {
    ...next,
    x: Math.max(-40, Math.min(880, next.x + fixed.x - shifted.x)),
    y: Math.max(-40, Math.min(600, next.y + fixed.y - shifted.y)),
  };
}
