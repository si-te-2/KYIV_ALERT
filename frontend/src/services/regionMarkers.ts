import type { Point, Size } from './mapCamera';

const spacing = 44;
const inset = 20;
const offsets: Point[] = [
  { x: 0, y: 0 },
  { x: -spacing, y: 0 }, { x: spacing, y: 0 },
  { x: 0, y: -spacing }, { x: 0, y: spacing },
];

export function separateRegionMarkers<T extends Point>(markers: T[], size: Size): T[] {
  const placed: T[] = [];
  for (const marker of markers) {
    const position = offsets.map(({ x, y }) => ({ x: marker.x + x, y: marker.y + y })).find(candidate =>
      candidate.x >= inset && candidate.y >= inset && candidate.x <= size.width - inset &&
      candidate.y <= size.height - inset && placed.every(other =>
        Math.hypot(other.x - candidate.x, other.y - candidate.y) >= spacing));
    placed.push(position ? { ...marker, ...position } : marker);
  }
  return placed;
}
