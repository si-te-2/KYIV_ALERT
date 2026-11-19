import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Crosshair, Layers, Minus, Plus, PanelRightOpen, Radio, RotateCcw, RotateCw, Scan, Waves } from 'lucide-react';
import { AlertFeedDrawer } from '../components/AlertFeedDrawer';
import { alertLabels, isActive, statusLabel, type AlertLevel, type Feed } from '../hooks/useCivilAlerts';
import { mapAreas, mapDistricts, mapRegions, type Location } from '../services/locations';
import { countryView, getScale, keepPoint, toMap, toScreen, type Point } from '../services/mapCamera';

const mapTime = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short',
});

const mapKeys: Record<string, Point> = {
  ArrowLeft: { x: 48, y: 0 },
  ArrowRight: { x: -48, y: 0 },
  ArrowUp: { x: 0, y: 48 },
  ArrowDown: { x: 0, y: -48 },
};

const colors = {
  neutral: { fill: '#1b2440', border: '#4b5a83' },
  active: { fill: '#843b5d', border: '#f17eaa' },
  warning: { fill: '#66502e', border: '#e8b37f' },
  partial: { fill: '#573959', border: '#c68ce1' },
};
const turn = Math.PI / 12;
const findArea = (id: string) => mapAreas.find(area => area.id === id);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const angleBetween = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);

export function Radar({ feed, location, feedOpen, onFeedOpenChange }: {
  feed: Feed;
  location: Location;
  feedOpen: boolean;
  onFeedOpenChange: (open: boolean) => void;
}) {
  const [selected, selectRegion] = useState(location.regionId);
  const [exercise, setExercise] = useState<'idle' | 'active' | 'ended'>('idle');
  const [camera, setCamera] = useState(countryView);
  const [districts, setDistricts] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const mapPanel = useRef<HTMLElement>(null);
  const mapSurface = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const dragged = useRef(false);
  const lastCamera = useRef(camera);
  const shapes = useMemo(() => new Map(mapAreas.map(area => [area.id, new Path2D(area.path)])), []);
  const inExercise = exercise === 'active';
  const activeArea = findArea(selected);
  const levels = useMemo(() => new Map(feed.alerts.map(alert => [alert.regionId, alert])), [feed.alerts]);

  const selectedAlert = levels.get(selected);
  const selectedLevel = getLevel(selected);
  const eventTime = inExercise ? null : selectedAlert?.publishedAt ?? (selectedAlert ? feed.checkedAt : null);

  function getLevel(id: string): AlertLevel | undefined {
    return inExercise ? (id === location.regionId ? 'active' : undefined) : levels.get(id)?.level;
  }

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const bounds = element!.getBoundingClientRect();
      if (!bounds.width) return;
      const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      setCamera(current => keepPoint(current, bounds, point, point, current.zoom * Math.exp(-event.deltaY * .0015)));
    }
    const surface = mapSurface.current;
    surface?.addEventListener('wheel', wheel, { passive: false });
    return () => surface?.removeEventListener('wheel', wheel);
  }, []);

  useLayoutEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context || !size.width || !size.height) return;
    lastCamera.current = camera;
    const density = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(size.width * density);
    const height = Math.round(size.height * density);
    if (element.width !== width || element.height !== height) {
      element.width = width;
      element.height = height;
    }
    context.resetTransform();
    context.clearRect(0, 0, width, height);
    const scale = getScale(size, camera.zoom);
    context.setTransform(density, 0, 0, density, 0, 0);
    context.translate(size.width / 2, size.height / 2);
    context.rotate(camera.angle);
    context.scale(scale, scale);
    context.translate(-camera.x, -camera.y);

    function paintArea(id: string, level: AlertLevel | undefined, district: boolean) {
      const shape = shapes.get(id);
      if (!shape || !context) return;
      const active = level === 'active' || level === 'warning' || level === 'partial';
      const paint = active ? colors[level] : colors.neutral;
      if (!district || active) {
        context.fillStyle = paint.fill;
        context.fill(shape, 'evenodd');
      }
      context.lineWidth = (district ? .65 : 1.25) / scale;
      context.strokeStyle = district && !active ? '#58698b9c' : paint.border;
      context.stroke(shape);
    }

    for (const region of mapRegions) {
      const level = getLevel(region.id);
      paintArea(region.id, districts && level === 'partial' ? undefined : level, false);
    }
    if (districts) for (const district of mapDistricts) paintArea(district.id, getLevel(district.id), true);
    for (const region of mapRegions) {
      const shape = shapes.get(region.id);
      if (!shape) continue;
      context.lineWidth = 1.2 / scale;
      context.strokeStyle = getLevel(region.id) === 'partial' ? '#bd92d5' : '#8490bb';
      context.stroke(shape);
    }

    const outline = shapes.get(selected);
    if (outline) {
      context.strokeStyle = '#e5d7ff';
      context.lineWidth = 2 / scale;
      context.stroke(outline);
    }

    context.setTransform(density, 0, 0, density, 0, 0);
    context.textAlign = 'center';
    const showDistrictLabels = districts && camera.zoom >= 1.8;
    const labelAreas = showDistrictLabels ? mapDistricts : size.width >= 520 ? mapRegions : mapRegions.filter(area => area.id === selected);
    context.font = `600 ${showDistrictLabels ? 10 : 11}px system-ui`;
    for (const area of labelAreas) {
      const label = toScreen(camera, size, area);
      if (label.x < 15 || label.x > size.width - 15 || label.y < 12 || label.y > size.height - 10) continue;
      context.strokeStyle = '#12172a';
      context.lineWidth = 2.75;
      context.strokeText(area.label, label.x, label.y);
      context.fillStyle = isActive(getLevel(area.id)) ? '#ffe0ee' : '#c9d3f1';
      context.fillText(area.label, label.x, label.y);
    }
  }, [camera, districts, inExercise, levels, location.regionId, selected, shapes, size]);

  function focusArea(id: string) {
    const area = findArea(id);
    if (!area) return;
    selectRegion(id);
    if (!size.width) return;
    const [left, top, right, bottom] = area.bounds;
    const zoom = Math.min(6, Math.min(size.width / (right - left + 24), size.height / (bottom - top + 24)) / getScale(size, 1));
    setCamera({ x: (left + right) / 2, y: (top + bottom) / 2, zoom, angle: 0 });
  }

  function chooseFromFeed(id: string) {
    setExercise('idle');
    setDistricts(true);
    focusArea(id);
    onFeedOpenChange(false);
    requestAnimationFrame(() => mapPanel.current?.focus());
  }

  function panFromKeyboard(event: KeyboardEvent<HTMLCanvasElement>) {
    const delta = mapKeys[event.key];
    if (!delta || !size.width || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const center = { x: size.width / 2, y: size.height / 2 };
    setCamera(current => keepPoint(current, size, center, { x: center.x + delta.x, y: center.y + delta.y }));
  }

  function localPoint(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!pointers.current.size) dragged.current = false;
    pointers.current.set(event.pointerId, localPoint(event));
  }

  function drag(event: PointerEvent<HTMLCanvasElement>) {
    const prior = pointers.current.get(event.pointerId);
    if (!prior || !size.width) return;
    const next = localPoint(event);
    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    if (!dragged.current && !other && distance(prior, next) < 4) return;
    dragged.current = true;
    pointers.current.set(event.pointerId, next);
    setCamera(current => other
      ? keepPoint(current, size, midpoint(prior, other), midpoint(next, other),
        current.zoom * distance(next, other) / Math.max(1, distance(prior, other)),
        current.angle + angleBetween(next, other) - angleBetween(prior, other))
      : keepPoint(current, size, prior, next));
  }

  function finishDrag(event: PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (dragged.current || event.type !== 'pointerup' || !size.width) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = toMap(lastCamera.current, size, localPoint(event));
    context.save();
    context.resetTransform();
    const candidates = districts ? [...mapDistricts, ...mapRegions] : mapRegions;
    const hit = candidates.find(({ id }) => context.isPointInPath(shapes.get(id)!, point.x, point.y, 'evenodd'));
    context.restore();
    if (hit) selectRegion(hit.id);
  }

  const mapMarkers = size.width ? (districts ? [...mapDistricts, ...mapRegions] : mapRegions).flatMap(area => {
    const level = getLevel(area.id);
    if (!isActive(level) || levels.get(area.id)?.inherited && !inExercise || (districts && level === 'partial' && mapRegions.some(region => region.id === area.id))) return [];
    const point = toScreen(camera, size, area);
    return point.x > 8 && point.y > 8 && point.x < size.width - 8 && point.y < size.height - 8
      ? [{ id: area.id, name: area.name, level, left: point.x, top: point.y }] : [];
  }) : [];

  return <div className="radar-layout">
    <AlertFeedDrawer feed={feed} open={feedOpen} onOpenChange={onFeedOpenChange} onSelect={chooseFromFeed} />
    <section ref={mapPanel} tabIndex={-1} className="panel map-panel" aria-label="Карта України">
      <div className="map-heading">
        <div><p className="eyebrow"><Waves size={16} aria-hidden="true" /> Огляд</p><h2>Карта України</h2></div>
        <div className="map-controls">
          <button aria-label="Зменшити" title="Зменшити" disabled={camera.zoom <= 1} onClick={() => setCamera(current => ({ ...current, zoom: Math.max(1, current.zoom / 1.25) }))}><Minus size={17} /></button>
          <button aria-label="Збільшити" title="Збільшити" disabled={camera.zoom >= 6} onClick={() => setCamera(current => ({ ...current, zoom: Math.min(6, current.zoom * 1.25) }))}><Plus size={17} /></button>
          <button aria-label="Повернути ліворуч" title="Повернути ліворуч" onClick={() => setCamera(current => ({ ...current, angle: current.angle - turn }))}><RotateCcw size={17} /></button>
          <button aria-label="Повернути праворуч" title="Повернути праворуч" onClick={() => setCamera(current => ({ ...current, angle: current.angle + turn }))}><RotateCw size={17} /></button>
          <button aria-label="Мій регіон" title="Мій регіон" onClick={() => focusArea(location.regionId)}><Crosshair size={17} /></button>
          <button aria-label="Скинути вигляд" title="Скинути вигляд" onClick={() => setCamera(countryView)}><Scan size={17} /></button>
        </div>
      </div>
      <div className="map-shortcuts">
        <button type="button" className="map-toggle" aria-pressed={districts} onClick={() => setDistricts(value => !value)}><Layers size={16} /> Райони</button>
        <button type="button" onClick={() => focusArea('UA-51')}>Одещина</button>
        <button type="button" onClick={() => focusArea('UA-65')}>Херсонщина</button>
        <button type="button" className="map-feed-button" onClick={() => onFeedOpenChange(true)} aria-haspopup="dialog">
          <PanelRightOpen size={16} aria-hidden="true" /> Стрічка тривог
        </button>
      </div>
      <div className="map-surface" ref={mapSurface}>
        <canvas ref={canvas} onPointerDown={startDrag} onPointerMove={drag}
          onPointerCancel={finishDrag} onPointerUp={finishDrag} onLostPointerCapture={finishDrag} onKeyDown={panFromKeyboard}
          tabIndex={0} aria-label="Інтерактивна карта" aria-describedby="map-navigation-hint" />
        {mapMarkers.map(marker => <button key={marker.id} type="button" className={`map-pulse ${marker.level}`}
          style={{ left: marker.left, top: marker.top }} aria-label={`Оголошення: ${marker.name}`}
          aria-pressed={selected === marker.id} onClick={() => selectRegion(marker.id)} />)}
        {inExercise && <span className="map-demo">НАВЧАЛЬНИЙ РЕЖИМ</span>}
      </div>
      <div className="map-selection" aria-live="polite">
        <div className="map-selection-icon"><Radio size={19} aria-hidden="true" /></div>
        <div>
          <h3>{activeArea?.name}</h3>
          <p>{inExercise ? (selectedLevel ? 'Тестова тривога' : 'Без тестової події') : statusLabel(selectedLevel)}
            {!inExercise && selectedLevel && isActive(selectedLevel) && selectedLevel !== 'active'
              ? ` · ${selectedLevel === 'partial' && /^UA\d/.test(selected) ? 'Часткова тривога в районі' : alertLabels[selectedLevel]}`
              : ''}</p>
        </div>
        {eventTime && <time dateTime={eventTime}>
          {selectedAlert?.publishedAt ? 'Оголошено' : 'Оновлено'} {mapTime.format(new Date(eventTime))}
        </time>}
      </div>
      <p className="map-navigation-hint" id="map-navigation-hint">Перетягуйте карту або використовуйте стрілки. Масштаб · Ctrl + колесо або жест двома пальцями.</p>
      <div className="map-footer">
        <span><i className="legend-swatch" /> {inExercise ? 'Тестова тривога' : 'Тривога'}</span>
        {!inExercise && <><span><i className="legend-swatch warning" /> Жовтий рівень</span>
          <span><i className="legend-swatch partial" /> Часткова тривога</span></>}
        <span className="map-attribution"><a href="https://data.humdata.org/dataset/cod-ab-ukr" target="_blank" rel="noreferrer">Межі © OCHA / HDX</a></span>
      </div>
    </section>
    <section className="panel region-panel">
      <h2>Вибір території</h2>
      <label htmlFor="radar-region">Область, місто або район</label>
      <select id="radar-region" value={selected} onChange={event => focusArea(event.target.value)}>
        <optgroup label="Області та міста">{mapRegions.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</optgroup>
        {mapRegions.map(region => {
          const areas = mapDistricts.filter(area => area.parentId === region.id);
          return areas.length > 0 && <optgroup key={region.id} label={region.name}>
            {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
          </optgroup>;
        })}
      </select>
      <div className="exercise-panel">
        <h3>Навчальна тривога</h3>
        <p role="status">{exercise === 'ended' ? 'Тестову тривогу завершено.' :
          inExercise ? 'Тестове підсвічування для вашого регіону.' : 'Перевірте, як виглядає сповіщення.'}</p>
        <button type="button" className="secondary-button" onClick={() => {
          if (!inExercise) selectRegion(location.regionId);
          setExercise(inExercise ? 'ended' : 'active');
        }}>{inExercise ? 'Завершити тест' : 'Запустити тест'}</button>
      </div>
    </section>
  </div>;
}
