import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Crosshair, Minus, Plus, Radar as RadarIcon, RotateCcw } from 'lucide-react';
import regions from '../assets/ukraine-regions.json';
import type { Preferences } from '../services/preferences';

const regionsById = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
const exerciseRegions = new Set(['UA-30', 'UA-32', 'UA-74']);
const capital = { x: 414, y: 156 };
const mapWidth = 840;
const mapHeight = 560;

function buildPaths() {
  return regions.map(region => ({ ...region, shape: new Path2D(region.path) }));
}

export function Radar({ preferences }: { preferences: Preferences }) {
  const [selected, selectRegion] = useState('UA-30');
  const [zoom, setZoom] = useState(preferences.focus === 'kyiv' ? 2.4 : 1);
  const [paths] = useState(buildPaths);
  const canvas = useRef<HTMLCanvasElement>(null);
  const transform = useRef({ scale: 1, x: 0, y: 0 });
  const activeRegion = regions.find(region => region.id === selected);
  const inExercise = exerciseRegions.has(selected);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;

    function draw() {
      if (!element || !context) return;
      const { width, height } = element.getBoundingClientRect();
      const density = window.devicePixelRatio || 1;
      element.width = Math.round(width * density);
      element.height = Math.round(height * density);
      const scale = Math.min(width / mapWidth, height / mapHeight) * zoom;
      const focus = zoom > 1 ? capital : { x: mapWidth / 2, y: mapHeight / 2 };
      const x = width / 2 - focus.x * scale;
      const y = height / 2 - focus.y * scale;
      transform.current = { scale, x, y };
      context.setTransform(scale * density, 0, 0, scale * density, x * density, y * density);

      for (const region of paths) {
        const highlighted = exerciseRegions.has(region.id);
        context.fillStyle = highlighted ? '#532332' : '#192632';
        context.fill(region.shape, 'evenodd');
        context.lineWidth = 0.9 / scale;
        context.strokeStyle = highlighted ? '#b85361' : '#405364';
        context.stroke(region.shape);
      }

      const outline = paths.find(region => region.id === selected);
      if (outline) {
        context.lineWidth = 2 / scale;
        context.strokeStyle = '#ff9b9f';
        context.stroke(outline.shape);
      }

      if (preferences.labels && (width >= 490 || zoom >= 1.8)) {
        context.font = `600 ${10 / scale}px system-ui`;
        context.textAlign = 'center';
        for (const region of paths) {
          if (region.id === 'UA-30' || region.id === 'UA-40') continue;
          context.fillStyle = exerciseRegions.has(region.id) ? '#ffb9bd' : '#aabcca';
          const labelOffset = region.id === 'UA-32' ? 31 : region.id === 'UA-61' ? 14 : 0;
          context.fillText(region.label, region.x, region.y + labelOffset);
        }
      }

      context.beginPath();
      context.arc(capital.x, capital.y, 11 / scale, 0, 2 * Math.PI);
      context.fillStyle = '#ff5d67';
      context.fill();
      context.strokeStyle = '#fff3f3';
      context.lineWidth = 2 / scale;
      context.stroke();
      context.font = `700 ${12 / scale}px system-ui`;
      context.textAlign = 'left';
      context.strokeStyle = '#131921';
      context.lineWidth = 4 / scale;
      context.strokeText('Київ', capital.x + 16 / scale, capital.y + 4 / scale);
      context.fillStyle = '#fff3f3';
      context.fillText('Київ', capital.x + 16 / scale, capital.y + 4 / scale);
    }

    const resize = new ResizeObserver(draw);
    resize.observe(element);
    draw();
    return () => resize.disconnect();
  }, [paths, preferences.labels, selected, zoom]);

  function pickRegion(event: MouseEvent<HTMLCanvasElement>) {
    const element = event.currentTarget;
    const context = element.getContext('2d');
    if (!context) return;
    const bounds = element.getBoundingClientRect();
    const { scale, x, y } = transform.current;
    const pointX = (event.clientX - bounds.left - x) / scale;
    const pointY = (event.clientY - bounds.top - y) / scale;

    if (Math.hypot(pointX - capital.x, pointY - capital.y) * scale <= 14) {
      selectRegion('UA-30');
      return;
    }

    context.save();
    context.resetTransform();
    const region = paths.find(candidate => context.isPointInPath(candidate.shape, pointX, pointY, 'evenodd'));
    context.restore();
    if (region) selectRegion(region.id);
  }

  return <>
    <div className="page-title"><h1>Радар</h1><p>Карта тривог України · навчальний сценарій.</p></div>
    <div className="notice"><RadarIcon size={18} aria-hidden="true" /> <span><strong>DEMO MODE.</strong> Позначення на карті навчальні. Поточний стан тривог невідомий.</span></div>
    <div className="radar-layout">
      <section className="panel map-panel" aria-label="Карта України">
        <div className="map-heading">
          <h2>Карта тривог</h2>
          <div className="map-controls">
            <button aria-label="Зменшити" title="Зменшити" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.4))}><Minus size={17} /></button>
            <button aria-label="Збільшити" title="Збільшити" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.4))}><Plus size={17} /></button>
            <button aria-label="Зосередитися на Києві" title="Зосередитися на Києві" onClick={() => { selectRegion('UA-30'); setZoom(2.4); }}><Crosshair size={17} /></button>
            <button aria-label="Повернути огляд України" title="Повернути огляд України" onClick={() => setZoom(1)}><RotateCcw size={16} /></button>
          </div>
        </div>
        <canvas ref={canvas} onClick={pickRegion} aria-hidden="true" />
        <div className="map-footer">
          <span><i className="legend-swatch" /> Демо-тривога</span>
          <span><i className="legend-swatch neutral" /> Без демо-події</span>
          <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        </div>
      </section>
      <section className="panel region-panel">
        <h2>Стан регіону</h2>
        <label htmlFor="radar-region">Регіон</label>
          <select id="radar-region" value={selected} onChange={event => selectRegion(event.target.value)}>
            {regionsById.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        <div className="region-result" aria-live="polite">
          <h3>{activeRegion?.name}</h3>
          <span className={inExercise ? 'tag active-alert' : 'tag'}>{inExercise ? 'Демо-тривога' : 'Без демо-події'}</span>
        </div>
        <p className="muted">Позначки показують лише стан навчального сценарію.</p>
      </section>
    </div>
  </>;
}
