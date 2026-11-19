import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Crosshair, Minus, Plus, RotateCcw, Waves } from 'lucide-react';
import { alertLabels, isActive, type AlertLevel, type Feed } from '../hooks/useCivilAlerts';
import { mapRegions, type Location } from '../services/locations';

const capital = { x: 414, y: 156 };
const mapWidth = 840;
const mapHeight = 560;

const colors = {
  neutral: { fill: '#1b2440', border: '#465477' },
  active: { fill: '#64304d', border: '#f17eaa' },
  warning: { fill: '#53412f', border: '#e8b37f' },
  partial: { fill: '#49354d', border: '#c68ce1' },
};

function position(region: { id: string; x: number; y: number }) {
  return region.id === 'UA-30' ? capital : region;
}

export function Radar({ feed, location }: { feed: Feed; location: Location }) {
  const [selected, selectRegion] = useState(location.regionId);
  const [exercise, setExercise] = useState<'idle' | 'active' | 'ended'>('idle');
  const [zoom, setZoom] = useState(1);
  const [paths] = useState(() => mapRegions.map(region => ({ ...region, shape: new Path2D(region.path) })));
  const [markers, setMarkers] = useState<{ id: string; left: number; top: number; level: string }[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const transform = useRef({ scale: 1, x: 0, y: 0 });
  const activeRegion = mapRegions.find(region => region.id === selected);
  const inExercise = exercise === 'active';
  const selectedAlert = feed.alerts.find(alert => alert.regionId === selected);
  const selectedLevel = inExercise ? (selected === location.regionId ? 'active' : undefined) : selectedAlert?.level;

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;

    const levels = new Map<string, AlertLevel>(
      inExercise
        ? [[location.regionId, 'active']]
        : feed.alerts.map(alert => [alert.regionId, alert.level]),
    );

    function draw() {
      if (!element || !context) return;
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const density = window.devicePixelRatio || 1;
      element.width = Math.round(width * density);
      element.height = Math.round(height * density);
      const scale = Math.min(width / mapWidth, height / mapHeight) * zoom;
      const focus = zoom > 1 && activeRegion ? position(activeRegion) : { x: mapWidth / 2, y: mapHeight / 2 };
      const x = width / 2 - focus.x * scale;
      const y = height / 2 - focus.y * scale;
      transform.current = { scale, x, y };
      context.setTransform(scale * density, 0, 0, scale * density, x * density, y * density);

      for (const region of paths) {
        const level = levels.get(region.id);
        const paint = level === 'active' || level === 'warning' || level === 'partial' ? colors[level] : colors.neutral;
        context.fillStyle = paint.fill;
        context.fill(region.shape, 'evenodd');
        context.lineWidth = 1 / scale;
        context.strokeStyle = paint.border;
        context.stroke(region.shape);
      }

      const outline = paths.find(region => region.id === selected);
      if (outline) {
        context.lineWidth = 2 / scale;
        context.strokeStyle = '#c8bbff';
        context.stroke(outline.shape);
      }

      if (width >= 500 || zoom >= 1.8) {
        context.font = `600 ${11 / scale}px system-ui`;
        context.textAlign = 'center';
        for (const region of paths) {
          if (region.id === 'UA-30' || region.id === 'UA-40') continue;
          context.fillStyle = isActive(levels.get(region.id)) ? '#ffdaeb' : '#bac8ed';
          const labelOffset = region.id === 'UA-32' ? 33 : region.id === 'UA-61' ? 14 : 0;
          context.fillText(region.label, region.x, region.y + labelOffset);
        }
      }

      context.beginPath();
      context.arc(capital.x, capital.y, 5 / scale, 0, 2 * Math.PI);
      context.fillStyle = '#e4dafc';
      context.fill();
      context.font = `700 ${12 / scale}px system-ui`;
      context.textAlign = 'left';
      context.strokeStyle = '#141a32';
      context.lineWidth = 4 / scale;
      context.strokeText('Київ', capital.x + 12 / scale, capital.y + 4 / scale);
      context.fillText('Київ', capital.x + 12 / scale, capital.y + 4 / scale);

      setMarkers(paths.flatMap(region => {
        const level = levels.get(region.id);
        if (!level || !isActive(level)) return [];
        const point = position(region);
        const left = point.x * scale + x;
        const top = point.y * scale + y;
        return left >= 0 && left <= width && top >= 0 && top <= height
          ? [{ id: region.id, left, top, level }] : [];
      }));
    }

    const resize = new ResizeObserver(draw);
    resize.observe(element);
    draw();
    return () => resize.disconnect();
  }, [activeRegion, feed.alerts, inExercise, location.regionId, paths, selected, zoom]);

  function pickRegion(event: MouseEvent<HTMLCanvasElement>) {
    const element = event.currentTarget;
    const context = element.getContext('2d');
    if (!context) return;
    const bounds = element.getBoundingClientRect();
    const { scale, x, y } = transform.current;
    const pointX = (event.clientX - bounds.left - x) / scale;
    const pointY = (event.clientY - bounds.top - y) / scale;

    if (Math.hypot(pointX - capital.x, pointY - capital.y) * scale <= 12) {
      selectRegion('UA-30');
      return;
    }

    context.save();
    context.resetTransform();
    const region = paths.find(candidate => context.isPointInPath(candidate.shape, pointX, pointY, 'evenodd'));
    context.restore();
    if (region) selectRegion(region.id);
  }

  function toggleExercise() {
    if (inExercise) {
      setExercise('ended');
    } else {
      selectRegion(location.regionId);
      setExercise('active');
    }
  }

  return <div className="radar-layout">
    <section className="panel map-panel" aria-label="Карта України">
      <div className="map-heading">
        <div><p className="eyebrow"><Waves size={16} aria-hidden="true" /> Огляд</p><h2>Карта України</h2></div>
        <div className="map-controls">
          <button aria-label="Зменшити" title="Зменшити" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.4))}><Minus size={17} /></button>
          <button aria-label="Збільшити" title="Збільшити" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.4))}><Plus size={17} /></button>
          <button aria-label="Мій регіон" title="Мій регіон" onClick={() => { selectRegion(location.regionId); setZoom(2.4); }}><Crosshair size={17} /></button>
          <button aria-label="Огляд України" title="Огляд України" onClick={() => setZoom(1)}><RotateCcw size={16} /></button>
        </div>
      </div>
      <div className="map-surface">
        <canvas ref={canvas} onClick={pickRegion} aria-hidden="true" />
        {markers.map(marker => <span key={marker.id} className={`map-pulse ${marker.level}`}
          style={{ left: marker.left, top: marker.top }} aria-hidden="true" />)}
        {inExercise && <span className="map-demo">НАВЧАЛЬНИЙ РЕЖИМ</span>}
      </div>
      <div className="map-footer">
        <span><i className="legend-swatch" /> {inExercise ? 'Тестова тривога' : 'Тривога'}</span>
        {!inExercise && <><span><i className="legend-swatch warning" /> Попередження</span>
          <span><i className="legend-swatch partial" /> Часткова тривога</span></>}
        <span className="map-attribution">
          <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        </span>
      </div>
    </section>
    <section className="panel region-panel">
      <h2>Стан регіону</h2>
      <label htmlFor="radar-region">Область або місто</label>
      <select id="radar-region" value={selected} onChange={event => selectRegion(event.target.value)}>
        {mapRegions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
      </select>
      <div className="region-result" aria-live="polite">
        <h3>{activeRegion?.name}</h3>
        <span className={'tag' + (isActive(selectedLevel) ? ' active-alert' : '')}>
          {inExercise ? (selectedLevel ? 'Тестова тривога' : 'Без тестової події') :
            selectedLevel ? alertLabels[selectedLevel] : 'Стан невідомий'}
        </span>
      </div>
      <div className="exercise-panel">
        <h3>Навчальна тривога</h3>
        <p role="status">{exercise === 'ended' ? 'Тестову тривогу завершено.' :
          inExercise ? 'Тестове підсвічування для вашого регіону.' : 'Перевірте, як виглядає сповіщення.'}</p>
        <button type="button" className="secondary-button" onClick={toggleExercise}>
          {inExercise ? 'Завершити тест' : 'Запустити тест'}
        </button>
      </div>
    </section>
  </div>;
}
