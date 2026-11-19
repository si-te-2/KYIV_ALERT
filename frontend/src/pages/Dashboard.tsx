import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, ChevronDown, MapPin, MessageSquareText, PanelRightOpen, X, Radar as RadarIcon, Waves } from 'lucide-react';
import { CivilAlertsPanel } from '../components/CivilAlertsPanel';
import { alertLabels, isActive, statusLabel, useCivilAlerts, type AlertLevel } from '../hooks/useCivilAlerts';
import { cityOptions, districtOptions, findLocation, mapAreas, mapDistricts, oblastOptions, type Location } from '../services/locations';
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
      const title = level === 'partial' && /^UA\d/.test(regionId) ? 'Тривога в частині району' : alertLabels[level];
      new Notification(title, { body: name, tag: `kyiv-alert-${regionId}` });
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
  const radar = useRef<HTMLElement>(null);
  const locationPicker = useRef<HTMLDivElement>(null);
  const messages = useRef<HTMLDialogElement>(null);
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
          <button type="button" className="inbox-button" onClick={() => messages.current?.showModal()}>
            <MessageSquareText size={17} aria-hidden="true" /> <span>Повідомлення</span>
          </button>
          {location && !editing && <button type="button" className="inbox-button header-feed"
            onClick={() => setFeedOpen(true)} aria-haspopup="dialog">
            <PanelRightOpen size={17} aria-hidden="true" /> <span>Стрічка тривог</span>
          </button>}
          {location && <button type="button" className="location-chip" onClick={changeLocation} aria-expanded={editing}>
            <MapPin size={16} aria-hidden="true" /> <span>{location.name}</span> <ChevronDown size={15} aria-hidden="true" />
          </button>}
        </div>
      </div>
    </header>
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
        <Radar feed={feed} location={location} feedOpen={feedOpen} onFeedOpenChange={setFeedOpen} />
      </section>}
    </main>
    <footer className="site-footer">
      <span>KYIV ALERT</span>
      <a href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">Офіційна мапа <ArrowUpRight size={14} aria-hidden="true" /></a>
      <span><BellRing size={15} aria-hidden="true" /> Інформаційні дані · <a href="https://tryvoha.online/api" target="_blank" rel="noreferrer">Tryvoha.online</a></span>
    </footer>
  </>;
}
