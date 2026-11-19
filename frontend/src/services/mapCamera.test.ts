import { describe, expect, it } from 'vitest';
import { countryView, keepPoint, toMap, toScreen } from './mapCamera';

const size = { width: 950, height: 520 };

describe('map navigation', () => {
  it('converts pointer positions back to map coordinates after moving and rotating', () => {
    const camera = { x: 350, y: 470, angle: Math.PI / 3, zoom: 2.2 };
    const point = { x: 405, y: 422 };
    const roundtrip = toMap(camera, size, toScreen(camera, size, point));
    expect(roundtrip.x).toBeCloseTo(point.x);
    expect(roundtrip.y).toBeCloseTo(point.y);
  });

  it('keeps the same map point under the mouse or pinch midpoint', () => {
    const from = { x: 490, y: 270 };
    const to = { x: 515, y: 300 };
    const point = toMap(countryView, size, from);
    const next = keepPoint(countryView, size, from, to, 2.8, Math.PI / 5);
    const screen = toScreen(next, size, point);
    expect(screen.x).toBeCloseTo(to.x);
    expect(screen.y).toBeCloseTo(to.y);
  });
});
