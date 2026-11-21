import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, ChevronDown, Info, MapPin, MessageSquareText, Moon, Sun, X, Radar as RadarIcon, Waves } from 'lucide-react';
import { CivilAlertsPanel } from '../components/CivilAlertsPanel';
import { MonitoringSettings } from '../components/MonitoringSettings';
import { isActive, statusLabel, useCivilAlerts } from '../hooks/useCivilAlerts';
import { useDroneThreats } from '../hooks/useDroneThreats';
import { useMonitoringNotifications } from '../hooks/useMonitoringNotifications';
import { cityOptions, districtOptions, findLocation, mapAreas, mapDistricts, oblastOptions, type Location } from '../services/locations';
import { kyivTime, officialMap } from '../services/monitoring';
import { locationKey, readMonitoringPreferences, saveMonitoringPreferences, type MonitoringPreferences } from '../services/monitoringPreferences';
import { Legal } from './Legal';
import { Radar } from './Radar';

function readLocation() {
  try {
    return findLocation(localStorage.getItem(locationKey)) ?? null;
  } catch {
    return null;
  }
}

function RegionForm({ location, onSave, onCancel }: {
  location: Location | null;
  onSave: (location: Location) => void;
  onCancel?: () => void;
}) {
  const initialKind = cityOptions.some(item => item.id === location?.id) ? 'city' : districtOptions.some(item => item.id === location?.id) ? 'district' : 'oblast';
  const [kind, setKind] = useState<'city' | 'oblast' | 'district'>(initialKind);
  const [selected, setSelected] = useState(location?.id ?? '');
  const options = kind === 'oblast' ? oblastOptions : kind === 'district' ? districtOptions : cityOptions;
  const kindLabel = { oblast: 'Область', city: 'Місто', district: 'Район' }[kind];
  const emptyLabel = { oblast: 'Виберіть область', city: 'Виберіть місто', district: 'Виберіть район' }[kind];
  const picked = options.find(item => item.id === selected);
  const mappedOblast = picked && picked.id !== picked.regionId
    ? mapAreas.find(item => item.id === picked.regionId)
    : undefined;

  return <form className="location-form panel" onSubmit={event => {
    event.preventDefault();
    if (picked) onSave(picked);
  }}>
    <div className="location-form-heading">
      <span className="section-icon"><MapPin size={21} aria-hidden="true" /></span>
      <div><h2>Ваш регіон</h2><p>Оберіть, для якого місця показувати сповіщення.</p></div>
    </div>
    <div className="segmented" role="group" aria-label="Тип регіону">
      <button type="button" aria-pressed={kind === 'oblast'} onClick={() => { setKind('oblast'); setSelected(''); }}>Область</button>
      <button type="button" aria-pressed={kind === 'city'} onClick={() => { setKind('city'); setSelected(''); }}>Місто</button>
      <button type="button" aria-pressed={kind === 'district'} onClick={() => { setKind('district'); setSelected(''); }}>Район</button>
    </div>
    <label className="location-label" htmlFor="location-select">{kindLabel}</label>
    <select id="location-select" value={selected} onChange={event => setSelected(event.target.value)} required>
      <option value="" disabled>{emptyLabel}</option>
      {kind !== 'district'
        ? options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)
        : oblastOptions.map(oblast => {
          const children = mapDistricts.filter(area => area.parentId === oblast.id);
          return children.length > 0 && <optgroup key={oblast.id} label={oblast.name}>
            {children.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
          </optgroup>;
        })}
    </select>
    {mappedOblast && <p className="location-note">Територія для сповіщень · {mappedOblast.name}.</p>}
    <button className="primary-button" type="submit" disabled={!picked}>
      {location ? 'Зберегти регіон' : 'Відкрити радар'} <ArrowRight size={19} aria-hidden="true" />
    </button>
    {onCancel && <button className="text-button" type="button" onClick={onCancel}>Скасувати</button>}
  </form>;
}

export function Dashboard() {
  const [location, setLocation] = useState(readLocation);
  const [editing, setEditing] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedView, setFeedView] = useState<'active' | 'changes'>('active');
  const [preferences, setPreferences] = useState(readMonitoringPreferences);
  const [hash, setHash] = useState(() => window.location.hash);
  const radar = useRef<HTMLElement>(null);
  const locationPicker = useRef<HTMLDivElement>(null);
  const messages = useRef<HTMLDialogElement>(null);
  const sources = useRef<HTMLDialogElement>(null);
  const settings = useRef<HTMLDialogElement>(null);
  const feed = useCivilAlerts();
  const droneFeed = useDroneThreats();
  const region = feed.alerts.find(item => item.regionId === location?.regionId);
  const notifications = useMonitoringNotifications(feed, droneFeed, location, preferences);
  const choosing = !location || editing;
  const legalPage = hash === '#privacy' ? 'privacy' : hash === '#disclaimer' ? 'disclaimer' : null;
  const checkedAt = [feed.checkedAt, droneFeed.checkedAt].filter((value): value is string => !!value)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const connected = feed.status === 'ready' || feed.status === 'limited' || droneFeed.status === 'ready';

  useEffect(() => {
    const listener = () => setHash(window.location.hash);
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  useEffect(() => {
    if (legalPage) window.scrollTo({ top: 0, behavior: 'instant' });
    else if (hash === '#radar' || hash === '#threats' || hash === '#onboarding') {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [hash, legalPage]);

  function updatePreferences(next: MonitoringPreferences) {
    setPreferences(next);
    saveMonitoringPreferences(next);
  }

  function openFeed(view: 'active' | 'changes') {
    if (choosing || legalPage) {
      if (choosing) window.location.hash = '#onboarding';
      else window.location.hash = '#radar';
    }
    setFeedView(view);
    setFeedOpen(true);
  }

  function saveLocation(next: Location) {
    setLocation(next);
    setEditing(false);
    try {
      localStorage.setItem(locationKey, next.id);
    } catch {
      // The selection is still usable for the current browser tab.
    }
    requestAnimationFrame(() => radar.current?.focus());
  }

  function changeLocation() {
    setEditing(true);
    requestAnimationFrame(() => locationPicker.current?.querySelector('select')?.focus());
  }

  return <>
    <a className="skip-link" href="#main">До вмісту</a>
    <header className="site-header">
      <div className="site-header-inner">
        <a href="#main" className="brand" aria-label="KYIV ALERT · На початок">
          <span className="brand-mark"><RadarIcon size={23} aria-hidden="true" /></span>
          <span>KYIV <strong>ALERT</strong><small>LIVE THREAT MONITORING</small></span>
        </a>
        <div className="header-actions">
          <a className="national-link" href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">
            Офіційна мапа <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <button type="button" className="inbox-button" onClick={() => messages.current?.showModal()}>
            <MessageSquareText size={17} aria-hidden="true" /> <span>Повідомлення</span>
          </button>
          <button type="button" className="theme-toggle" aria-label={preferences.theme === 'dark' ? 'Світла тема' : 'Темна тема'}
            onClick={() => updatePreferences({ ...preferences, theme: preferences.theme === 'dark' ? 'light' : 'dark' })}>
            {preferences.theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          {location && !legalPage && <button type="button" className="location-chip" onClick={changeLocation} aria-expanded={editing}>
            <MapPin size={16} aria-hidden="true" /> <span>{location.name}</span> <ChevronDown size={15} aria-hidden="true" />
          </button>}
        </div>
      </div>
      <div className="monitoring-header-row">
        <nav aria-label="Навігація радара">
          <a href={choosing ? '#onboarding' : '#radar'}>Карта</a>
          <a href={choosing ? '#onboarding' : '#threats'}>Загрози</a>
          <button type="button" onClick={() => openFeed('active')}>Повітряні тривоги</button>
          <button type="button" aria-haspopup="dialog" onClick={() => sources.current?.showModal()}>Джерела</button>
          <button type="button" onClick={() => openFeed('changes')}>Історія</button>
          <button type="button" aria-haspopup="dialog" onClick={() => settings.current?.showModal()}>Налаштування</button>
        </nav>
        <span className="sync-indicator" data-connected={connected}>
          <span aria-hidden="true" />
          {!connected && checkedAt && 'Зв’язок недоступний · '}
          {checkedAt ? <>Остання синхронізація · <time dateTime={checkedAt}>{kyivTime.format(new Date(checkedAt))}</time></> : 'Синхронізацію ще не виконано'}
        </span>
      </div>
    </header>
    <MonitoringSettings dialog={settings} preferences={preferences} update={updatePreferences}
      permission={notifications.permission} enable={notifications.enable} />
    <dialog ref={sources} className="panel message-dialog monitor-dialog" aria-labelledby="sources-title">
      <div className="dialog-title"><h2 id="sources-title">Джерела</h2>
        <form method="dialog"><button type="submit" aria-label="Закрити джерела"><X size={21} aria-hidden="true" /></button></form>
      </div>
      <ul className="source-list">
        <li><strong>Офіційні оголошення Києва й області</strong><p>Telegram · регіональні попередження про загрозу БпЛА.</p></li>
        <li><strong>Загальноукраїнський потік</strong><p>Поточні цивільні тривоги по областях і районах, де доступні дані.</p></li>
      </ul>
      <a className="dialog-link" href={officialMap} target="_blank" rel="noreferrer">Офіційна мапа повітряних тривог</a>
    </dialog>
    <dialog ref={messages} className="panel message-dialog" aria-labelledby="messages-title">
      <div className="dialog-title">
        <h2 id="messages-title"><MessageSquareText size={21} aria-hidden="true" /> Повідомлення</h2>
        <form method="dialog"><button type="submit" aria-label="Закрити повідомлення"><X size={21} aria-hidden="true" /></button></form>
      </div>
      {location ? <article className={'inbox-entry' + (isActive(region?.level) ? ' inbox-active' : '')}>
        <p>{location.name}</p>
        <strong>{statusLabel(region?.level)}</strong>
        {region?.publishedAt && <time dateTime={region.publishedAt}>
          {new Intl.DateTimeFormat('uk-UA', {
            timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short',
          }).format(new Date(region.publishedAt))}
        </time>}
      </article> : <p className="dialog-note">Виберіть територію, щоб тут з’явилися її сповіщення.</p>}
      <a className="national-link dialog-link" href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">
        Офіційна мапа повітряних тривог <ArrowUpRight size={15} aria-hidden="true" />
      </a>
    </dialog>
    {legalPage ? <Legal page={legalPage} /> : <main className="site-main" id="main">
      <section id="onboarding" className={'hero' + (choosing ? ' hero-onboarding' : '')}>
        <div className="hero-photo" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span className="hero-pip" /> Україна · Цивільні сповіщення</p>
          <h1>Радар<br />тривог<span>.</span></h1>
          <p className="hero-description">Стежте за повітряними тривогами в Україні та отримуйте сповіщення для свого регіону.</p>
          {location && !editing && <a href="#radar" className="secondary-button"><ArrowDownRight size={18} aria-hidden="true" /> До карти</a>}
        </div>
        {choosing && <div className="location-picker" ref={locationPicker}>
          <RegionForm location={location} onSave={saveLocation} onCancel={location ? () => setEditing(false) : undefined} />
        </div>}
        {!choosing && <div className="hero-caption"><Waves size={17} aria-hidden="true" /> Київ · Дніпро</div>}
      </section>

      {location && !editing && <section id="radar" ref={radar} tabIndex={-1} className="radar-section">
        <aside className="radar-notice" aria-labelledby="radar-notice-title">
          <span className="radar-notice-icon"><Info size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="radar-notice-title">Інформаційний радар тривог</h2>
            <p>Дані можуть надходити із затримкою або містити помилки. Звіряйте статус з офіційними сповіщеннями.
              Під час тривоги залишайтеся в укритті до офіційного відбою.</p>
          </div>
          <a href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">Офіційна мапа тривог</a>
        </aside>
        <CivilAlertsPanel feed={feed} location={location} notifications={preferences.notifications ? notifications.permission : 'off'} enableNotifications={notifications.enable} />
        <Radar feed={feed} droneFeed={droneFeed} location={location} feedOpen={feedOpen} feedView={feedView}
          setFeedView={setFeedView} onFeedOpenChange={setFeedOpen} />
      </section>}
    </main>}
    <footer className="site-footer">
      <span>KYIV ALERT</span>
      <a href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">Офіційна мапа <ArrowUpRight size={14} aria-hidden="true" /></a>
      <a href="#privacy">Політика конфіденційності</a>
      <a href="#disclaimer">Відмова від відповідальності</a>
      <span><BellRing size={15} aria-hidden="true" /> Інформаційні дані · <a href="https://tryvoha.online/api" target="_blank" rel="noreferrer">Tryvoha.online</a></span>
    </footer>
  </>;
}
