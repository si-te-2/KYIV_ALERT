import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, ChevronDown, MapPin, Radar as RadarIcon, Waves } from 'lucide-react';
import { CivilAlertsPanel } from '../components/CivilAlertsPanel';
import { alertLabels, isActive, useCivilAlerts, type AlertLevel } from '../hooks/useCivilAlerts';
import { cityOptions, findLocation, oblastOptions, type Location } from '../services/locations';
import { Radar } from './Radar';

const locationKey = 'kyiv-alert-location';

function readLocation() {
  try {
    return findLocation(localStorage.getItem(locationKey)) ?? null;
  } catch {
    return null;
  }
}

function notificationPermission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

function useRegionalNotifications(regionId: string | undefined, name: string | undefined, level: AlertLevel | undefined) {
  const [permission, setPermission] = useState(notificationPermission);
  const previous = useRef<{ regionId: string; level: AlertLevel } | null>(null);

  useEffect(() => {
    if (!regionId || !level) return;
    const last = previous.current;
    previous.current = { regionId, level };
    if (last?.regionId !== regionId || last.level === level || !isActive(level) || permission !== 'granted') return;

    try {
      new Notification(alertLabels[level], { body: name, tag: `kyiv-alert-${regionId}` });
    } catch {
      setPermission('unsupported');
    }
  }, [level, name, permission, regionId]);

  async function enable() {
    if (typeof Notification === 'undefined') return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission('unsupported');
    }
  }

  return { permission, enable };
}

function RegionForm({ location, onSave, onCancel }: {
  location: Location | null;
  onSave: (location: Location) => void;
  onCancel?: () => void;
}) {
  const initialKind = cityOptions.some(item => item.id === location?.id) ? 'city' : 'oblast';
  const [kind, setKind] = useState<'city' | 'oblast'>(initialKind);
  const [selected, setSelected] = useState(location?.id ?? '');
  const options = kind === 'oblast' ? oblastOptions : cityOptions;
  const picked = options.find(item => item.id === selected);
  const mappedOblast = picked && picked.id !== picked.regionId
    ? oblastOptions.find(item => item.id === picked.regionId)
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
    </div>
    <label className="location-label" htmlFor="location-select">{kind === 'oblast' ? 'Область' : 'Місто'}</label>
    <select id="location-select" value={selected} onChange={event => setSelected(event.target.value)} required>
      <option value="" disabled>{kind === 'oblast' ? 'Виберіть область' : 'Виберіть місто'}</option>
      {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {mappedOblast && <p className="location-note">Сповіщення для міста надходитимуть за областю · {mappedOblast.name}.</p>}
    <button className="primary-button" type="submit" disabled={!picked}>
      {location ? 'Зберегти регіон' : 'Відкрити радар'} <ArrowRight size={19} aria-hidden="true" />
    </button>
    {onCancel && <button className="text-button" type="button" onClick={onCancel}>Скасувати</button>}
  </form>;
}

export function Dashboard() {
  const [location, setLocation] = useState(readLocation);
  const [editing, setEditing] = useState(false);
  const radar = useRef<HTMLElement>(null);
  const locationPicker = useRef<HTMLDivElement>(null);
  const feed = useCivilAlerts();
  const region = feed.alerts.find(item => item.regionId === location?.regionId);
  const notifications = useRegionalNotifications(location?.regionId, location?.name, region?.level);
  const choosing = !location || editing;

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
          <span>KYIV <strong>ALERT</strong></span>
        </a>
        <div className="header-actions">
          <a className="national-link" href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">
            Офіційна мапа <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          {location && <button type="button" className="location-chip" onClick={changeLocation} aria-expanded={editing}>
            <MapPin size={16} aria-hidden="true" /> <span>{location.name}</span> <ChevronDown size={15} aria-hidden="true" />
          </button>}
        </div>
      </div>
    </header>
    <main className="site-main" id="main">
      <section className={'hero' + (choosing ? ' hero-onboarding' : '')}>
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
        <CivilAlertsPanel feed={feed} location={location} notifications={notifications.permission} enableNotifications={notifications.enable} />
        <Radar feed={feed} location={location} />
      </section>}
    </main>
    <footer className="site-footer"><span>KYIV ALERT</span><span><BellRing size={15} aria-hidden="true" /> Повітряні тривоги України</span></footer>
  </>;
}
