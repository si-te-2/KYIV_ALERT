import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

type AreaProperties = google.maps.LatLngLiteral;
type AreaTopology = Topology<Record<'regions' | 'districts', GeometryCollection<AreaProperties>>>;

const areasUrl = new URL('../assets/ukraine-alert-areas.topojson', import.meta.url);
let libraries: Promise<[google.maps.MapsLibrary, google.maps.CoreLibrary]> | undefined;

function loadMaps(key: string) {
  if (!libraries) {
    setOptions({ key, v: 'quarterly', language: 'uk', region: 'UA', authReferrerPolicy: 'origin' });
    libraries = Promise.all([importLibrary('maps'), importLibrary('core')]);
  }
  return libraries;
}

async function loadAreas(signal: AbortSignal) {
  const response = await fetch(areasUrl, { signal });
  if (!response.ok) throw new Error('Could not load the alert boundaries');
  return await response.json() as AreaTopology;
}

export async function createSatelliteMap(
  element: HTMLDivElement,
  key: string,
  signal: AbortSignal,
  options: { minZoom: number; maxZoom: number },
  onSelect: (id: string) => void,
  onDraw: (map: google.maps.Map, projection?: google.maps.MapCanvasProjection) => void,
) {
  if (signal.aborted) return;
  const [[{ Map, OverlayView }, { LatLngBounds }], areas] = await Promise.all([loadMaps(key), loadAreas(signal)]);
  if (signal.aborted) return;
  if (areas.bbox?.length !== 4) throw new Error('Missing bounds for the satellite view');
  const [west, south, east, north] = areas.bbox;
  const countryBounds = { west, south, east, north };

  const map = new Map(element, {
    center: { lat: 48.5, lng: 31.25 },
    zoom: 5,
    ...options,
    mapTypeId: 'hybrid',
    renderingType: 'VECTOR',
    headingInteractionEnabled: true,
    tiltInteractionEnabled: false,
    tilt: 0,
    gestureHandling: 'greedy',
    disableDefaultUI: true,
    scaleControl: true,
    clickableIcons: false,
  });
  const centers = new globalThis.Map<string, google.maps.LatLngLiteral>();
  const areaBounds = new globalThis.Map<string, google.maps.LatLngBounds>();
  for (const layer of [areas.objects.regions, areas.objects.districts]) {
    for (const area of map.data.addGeoJson(feature(areas, layer))) {
      const id = String(area.getId());
      centers.set(id, { lat: Number(area.getProperty('lat')), lng: Number(area.getProperty('lng')) });
      const bounds = new LatLngBounds();
      area.getGeometry()?.forEachLatLng(point => bounds.extend(point));
      areaBounds.set(id, bounds);
    }
  }
  map.data.setStyle({ visible: false });
  let tilesLoaded = false;
  let frame = 0;
  const overlay = new OverlayView();
  function scheduleDraw() {
    if (!tilesLoaded || frame || signal.aborted) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onDraw(map, overlay.getProjection());
    });
  }
  overlay.onAdd = () => {};
  overlay.onRemove = () => {};
  overlay.draw = scheduleDraw;
  const listeners = [
    map.data.addListener('click', (event: google.maps.Data.MouseEvent) => onSelect(String(event.feature.getId()))),
    map.addListener('tilesloaded', () => { tilesLoaded = true; scheduleDraw(); }),
    map.addListener('renderingtype_changed', scheduleDraw),
    map.addListener('zoom_changed', scheduleDraw),
  ];
  overlay.setMap(map);

  return {
    map,
    centers,
    focus(id?: string) {
      map.fitBounds((id && areaBounds.get(id)) || countryBounds, 24);
    },
    destroy() {
      cancelAnimationFrame(frame);
      listeners.forEach(listener => listener.remove());
      overlay.setMap(null);
      map.data.setMap(null);
      element.replaceChildren();
    },
  };
}

export type SatelliteController = NonNullable<Awaited<ReturnType<typeof createSatelliteMap>>>;
