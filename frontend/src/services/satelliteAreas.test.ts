import { expect, it } from 'vitest';
import type { GeometryCollection, Topology } from 'topojson-specification';
import source from '../assets/ukraine-alert-areas.topojson?raw';
import { mapDistricts, mapRegions } from './locations';

it('keeps satellite boundaries and marker positions for every alert territory', () => {
  const { objects } = JSON.parse(source) as Topology<Record<'regions' | 'districts', GeometryCollection<google.maps.LatLngLiteral>>>;
  for (const [layer, alertAreas] of [[objects.regions, mapRegions], [objects.districts, mapDistricts]] as const) {
    expect(layer.geometries.map(area => area.id).sort()).toEqual(alertAreas.map(area => area.id).sort());
    for (const area of layer.geometries) {
      if (area.type !== 'Polygon' && area.type !== 'MultiPolygon') throw new Error(`Missing polygon for ${area.id}`);
      expect(area.properties?.lat).toBeGreaterThan(44);
      expect(area.properties?.lat).toBeLessThan(53);
      expect(area.properties?.lng).toBeGreaterThan(22);
      expect(area.properties?.lng).toBeLessThan(41);
    }
  }
});
