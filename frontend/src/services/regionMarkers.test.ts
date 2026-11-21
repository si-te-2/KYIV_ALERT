import { describe, expect, it } from 'vitest';
import { separateRegionMarkers } from './regionMarkers';

describe('regional marker layout', () => {
  it('separates nearby markers while retaining both regional identifiers', () => {
    const markers = [{ id: 'UA-30', x: 170, y: 61 }, { id: 'UA-32', x: 174, y: 64 }];
    const result = separateRegionMarkers(markers, { width: 320, height: 245 });

    expect(result.map(marker => marker.id)).toEqual(['UA-30', 'UA-32']);
    expect(result[0]).toEqual(markers[0]);
    expect(Math.hypot(result[0].x - result[1].x, result[0].y - result[1].y)).toBeGreaterThanOrEqual(44);
  });

  it('keeps isolated markers at their administrative anchor', () => {
    const markers = [{ id: 'UA-30', x: 60, y: 80 }, { id: 'UA-32', x: 220, y: 160 }];
    expect(separateRegionMarkers(markers, { width: 320, height: 245 })).toEqual(markers);
  });
});
