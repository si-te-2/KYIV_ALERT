import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Point } from '../services/mapCamera';
import type { SatelliteController } from '../services/satelliteMap';

export const satelliteMinZoom = 4;
export const satelliteMaxZoom = 22;

export const regionalMarkerZoomLimit = 12;
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
const unavailableView = { active: false, canRotate: false, zoom: satelliteMinZoom, points: new Map<string, Point>() };

export function useSatelliteMap(
  container: RefObject<HTMLDivElement | null>,
  style: google.maps.Data.StylingFunction,
  onSelect: (id: string) => void,
) {
  const [view, setView] = useState(unavailableView);
  const [failed, setFailed] = useState(false);
  const controller = useRef<SatelliteController>(null);
  const focusId = useRef<string>(undefined);

  useEffect(() => {
    const element = container.current;
    if (!element || !apiKey) return;

    const abort = new AbortController();
    function fail() {
      if (abort.signal.aborted) return;
      abort.abort();
      window.clearTimeout(timeout);
      controller.current?.destroy();
      controller.current = null;
      setView(unavailableView);
      setFailed(true);
    }

    const timeout = window.setTimeout(fail, 15000);
    const browser = window as Window & { gm_authFailure?: () => void };
    browser.gm_authFailure = fail;

    void import('../services/satelliteMap').then(async ({ createSatelliteMap }) => {
      const satellite = await createSatelliteMap(element, apiKey, abort.signal,
        { minZoom: satelliteMinZoom, maxZoom: satelliteMaxZoom }, onSelect, (map, projection) => {
          if (abort.signal.aborted || !controller.current) return;
          const zoom = map.getZoom() ?? satelliteMinZoom;
          const points = new Map<string, Point>();
          if (projection) {
            for (const [id, center] of controller.current.centers) {
              const point = projection.fromLatLngToContainerPixel(center);
              if (point) points.set(id, { x: point.x, y: point.y });
            }
          }
          setView({ active: true, canRotate: map.getRenderingType() === 'VECTOR', zoom, points });
          window.clearTimeout(timeout);
        });
      if (abort.signal.aborted || !satellite) {
        satellite?.destroy();
        return;
      }
      controller.current = satellite;
      satellite.focus(focusId.current);
    }).catch(fail);

    return () => {
      abort.abort();
      window.clearTimeout(timeout);
      if (browser.gm_authFailure === fail) delete browser.gm_authFailure;
      controller.current?.destroy();
      controller.current = null;
    };
  }, [container, onSelect]);

  useEffect(() => {
    if (view.active) controller.current?.map.data.setStyle(style);
  }, [style, view.active]);

  function focus(id?: string) {
    focusId.current = id;
    controller.current?.focus(id);
  }

  function zoomBy(delta: number) {
    const map = controller.current?.map;
    if (map) map.setZoom(Math.min(satelliteMaxZoom, Math.max(satelliteMinZoom, (map.getZoom() ?? view.zoom) + delta)));
  }

  function rotateBy(degrees: number) {
    const map = controller.current?.map;
    if (map && view.canRotate) map.setHeading(((map.getHeading() ?? 0) + degrees + 360) % 360);
  }

  return { ...view, failed, focus, zoomBy, rotateBy };
}
