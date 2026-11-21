import { useEffect, useRef, useState } from 'react';
import { List, Radio, X } from 'lucide-react';
import { alertLabels, isActive, statusLabel, type Feed, type RegionalAlert } from '../hooks/useCivilAlerts';
import { activeCivilAlerts, changesBetween, type AlertActivity } from '../services/alertActivity';
import { mapAreas } from '../services/locations';

const areaNames = new Map(mapAreas.map(area => [area.id, area.name]));
const formatTime = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export function AlertFeedDrawer({ feed, open, view, setView, onOpenChange, onSelect }: {
  feed: Feed;
  open: boolean;
  view: 'active' | 'changes';
  setView: (value: 'active' | 'changes') => void;
  onOpenChange: (value: boolean) => void;
  onSelect: (regionId: string) => void;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const previous = useRef<Feed | null>(null);
  const [changes, setChanges] = useState<AlertActivity[]>([]);
  const [search, setSearch] = useState('');
  const active = activeCivilAlerts(feed);
  const entries: (RegionalAlert | AlertActivity)[] = view === 'active' ? active : changes;
  const term = search.trim().toLocaleLowerCase('uk');
  const visible = entries.filter(alert =>
    areaNames.get(alert.regionId)?.toLocaleLowerCase('uk').includes(term));

  useEffect(() => {
    const newest = changesBetween(previous.current, feed);
    previous.current = feed;
    if (newest.length) setChanges(history => [...newest, ...history].slice(0, 35));
  }, [feed]);

  useEffect(() => {
    const element = drawer.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return <dialog ref={drawer} className="alert-drawer" aria-labelledby="alert-drawer-title"
    onClose={() => onOpenChange(false)}
    onClick={event => {
      if (event.target === drawer.current) onOpenChange(false);
    }}>
    <div className="drawer-body">
      <header className="drawer-header">
        <div className="section-icon"><List size={21} aria-hidden="true" /></div>
        <div><p className="eyebrow">Цивільні сповіщення</p><h2 id="alert-drawer-title">Стрічка тривог</h2></div>
        <button className="drawer-close" type="button" aria-label="Закрити стрічку" onClick={() => onOpenChange(false)}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="drawer-tabs" role="group" aria-label="Показати у стрічці">
        <button type="button" aria-pressed={view === 'active'} onClick={() => setView('active')}>Зараз <span>{active.length}</span></button>
        <button type="button" aria-pressed={view === 'changes'} onClick={() => setView('changes')}>Оновлення</button>
      </div>
      <label className="location-label" htmlFor="alert-feed-search">Пошук території</label>
      <input id="alert-feed-search" type="search" placeholder="Наприклад, Одеський район"
        value={search} onChange={event => setSearch(event.target.value)} />

      {visible.length > 0 ? <ul className="drawer-list">
        {visible.map(entry => {
          const { regionId, publishedAt, level } = entry;
          const name = areaNames.get(regionId);
          const timestamp = 'detectedAt' in entry ? entry.detectedAt : publishedAt;
          return <li key={`${regionId}-${level}-${timestamp}`}>
            <button type="button" className="drawer-entry" onClick={() => onSelect(regionId)}>
              <Radio size={18} className={isActive(level) ? 'entry-active' : ''} aria-hidden="true" />
              <span><strong>{name}</strong><small>{eventLabel(regionId, level)}</small></span>
              {timestamp && <time dateTime={timestamp}>{formatTime.format(new Date(timestamp))}</time>}
            </button>
          </li>;
        })}
      </ul> : <p className="drawer-empty">{term ? 'За цим запитом нічого не знайдено.' :
        view === 'changes' ? 'Оновлення з’являтимуться тут, поки сторінка відкрита.' :
        feed.status === 'connecting' ? 'Завантажуємо повідомлення…' :
        feed.status === 'ready' || feed.status === 'limited' ? 'У доступному потоці немає активних оголошень.' : 'Дані тимчасово недоступні.'}</p>}
      <footer className="drawer-footer">
        <a href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">Офіційна мапа</a>
      </footer>
    </div>
  </dialog>;
}

function eventLabel(regionId: string, level: RegionalAlert['level']) {
  if (!isActive(level)) return statusLabel(level);
  return level === 'partial' && /^UA\d/.test(regionId) ? 'Тривога в частині району' : alertLabels[level];
}
