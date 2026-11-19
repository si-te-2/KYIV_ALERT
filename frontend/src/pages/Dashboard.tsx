import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, BellRing, CircleHelp, House, MapPin, Radio, Radar as RadarIcon, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { StatusCard } from '../components/StatusCard';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { monitoringLabel } from '../services/statusLabel';
import { Radar } from './Radar';
import { readPreferences, savePreferences, type Preferences } from '../services/preferences';

const pages = [
  { id: 'overview', label: 'Огляд', icon: House },
  { id: 'radar', label: 'Радар', icon: RadarIcon },
  { id: 'settings', label: 'Налаштування', icon: SettingsIcon },
  { id: 'updates', label: 'Що нового', icon: Sparkles },
] as const;

function currentPage() {
  return pages.find(page => `#/${page.id}` === window.location.hash)?.id ?? 'overview';
}

export function Dashboard() {
  const [page, setPage] = useState(currentPage);
  const [preferences, setPreferences] = useState(readPreferences);
  const main = useRef<HTMLElement>(null);
  const { snapshot, connection } = useSystemStatus();
  const connected = connection === 'online';
  const connectionLabel = { online: 'API підключено', offline: 'З’єднання втрачено', loading: 'Підключення…' }[connection];

  useEffect(() => {
    const onNavigate = () => {
      setPage(currentPage());
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    };
    window.addEventListener('hashchange', onNavigate);
    return () => window.removeEventListener('hashchange', onNavigate);
  }, []);

  function updatePreferences(next: Preferences) {
    setPreferences(next);
    savePreferences(next);
  }

  const telegram = snapshot?.sources.filter(source => source.status === 'PENDING_ACCESS') ?? [];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); main.current?.focus(); }}>До вмісту</a>
      <aside className="sidebar">
        <a className="brand" href="#/overview" aria-label="KYIV ALERT · Огляд">
          <span className="brand-mark"><RadarIcon size={23} aria-hidden="true" /></span>
          <span>KYIV<strong> ALERT</strong></span>
        </a>
        <nav aria-label="Головне меню">
          {pages.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#/${id}`} aria-current={page === id ? 'page' : undefined}>
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="demo-pip" /> DEMO MODE</div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span><MapPin size={16} aria-hidden="true" /> Київ, Україна</span>
          <span className="connection" role="status"><i className={connected ? 'online' : ''} />{connectionLabel}</span>
        </header>
        <main id="main" ref={main} tabIndex={-1} className="content">
          {!connected && snapshot && <p className="notice" role="alert">Показано останні отримані дані. Поточний стан API невідомий.</p>}
          {page === 'overview' && <>
            <section className="hero">
              <div className="hero-rings" aria-hidden="true"><RadarIcon /></div>
              <div className="hero-copy">
                <span className="demo-label"><span className="demo-pip" /> DEMO MODE</span>
                <h1>Панель тривог<span>.</span></h1>
                <p>Перегляньте карту України та перевірте стан моніторингу. На радарі доступний навчальний сценарій та окремий розділ офіційних повідомлень для Києва й області.</p>
                <a className="primary-button" href="#/radar"><RadarIcon size={19} aria-hidden="true" /> Відкрити радар <ArrowUpRight size={17} aria-hidden="true" /></a>
              </div>
            </section>

            <div className="status-grid" aria-live="polite">
              <StatusCard label="Система" value={connected ? 'Демо доступне' : 'Стан невідомий'} detail={connected ? 'Локальний API відповідає' : 'Очікуємо відповідь локального API'} icon={<Activity size={18} />} />
              <StatusCard label="Моніторинг" value={monitoringLabel(snapshot?.monitoringStatus, connected)} detail="Статус демонстраційного аналізатора" icon={<Radio size={18} />} warning />
              <StatusCard label="Telegram" value={connected && snapshot?.telegramStatus === 'NOT_CONFIGURED' ? 'Очікує доступу' : 'Стан невідомий'} detail={`${telegram.length} каналів у списку джерел`} icon={<BellRing size={18} />} />
            </div>

            <div className="overview-grid">
              <section className="panel">
                <h2>Джерела Telegram</h2>
                <p className="muted">Для отримання публікацій адміністратор каналу має додати бота.</p>
                {telegram.length > 0 ? <ul className="source-list">
                  {telegram.map(source => (
                    <li key={source.name}>
                      <a href={source.originalUrl ?? undefined} target="_blank" rel="noreferrer">{source.name}<ArrowUpRight size={14} aria-hidden="true" /></a>
                      <span>Очікує доступу</span>
                    </li>
                  ))}
                </ul> : <p className="empty">Очікуємо список від API.</p>}
              </section>
              <section className="panel">
                <h2>Історія повідомлень</h2>
                {snapshot?.messages.map(message => <article className="message" key={message.id}>
                  <div className="message-meta"><span className="tag">ДЕМО</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}</time></div>
                  <p>{message.text}</p>
                  <small>Джерело · {message.sourceName}</small>
                  {message.originalUrl && <a href={message.originalUrl} target="_blank" rel="noreferrer">Відкрити оригінал</a>}
                </article>)}
                {!snapshot && <p className="empty">Очікуємо демонстраційні повідомлення.</p>}
              </section>
            </div>
          </>}
          {page === 'radar' && <Radar preferences={preferences} />}
          {page === 'settings' && <>
            <div className="page-title"><h1>Налаштування</h1><p>Параметри радара для цього браузера.</p></div>
            <section className="panel settings-panel">
              <h2>Відображення карти</h2>
              <label className="setting"><span><strong>Підписи областей</strong><small>Показувати назви регіонів на карті.</small></span><input type="checkbox" checked={preferences.labels} onChange={event => updatePreferences({ ...preferences, labels: event.target.checked })} /></label>
              <label className="setting"><span><strong>Початковий вигляд</strong><small>Відкривати радар з огляду України або Києва.</small></span>
                <select value={preferences.focus} onChange={event => updatePreferences({ ...preferences, focus: event.target.value === 'kyiv' ? 'kyiv' : 'ukraine' })}>
                  <option value="ukraine">Україна</option><option value="kyiv">Київ</option>
                </select>
              </label>
            </section>
          </>}
          {page === 'updates' && <>
            <div className="page-title"><h1>Що нового</h1><p>Оновлення KYIV ALERT.</p></div>
            <div className="release-list">
              <article className="panel"><span className="tag">v0.2</span><h2>Радар і меню</h2><p>Додано інтерактивну карту областей, налаштування відображення та посилання на сім джерел Telegram.</p></article>
              <article className="panel"><span className="tag">v0.1</span><h2>Локальна DEMO-версія</h2><p>Додано початкову панель, стан локального API й історію тестових повідомлень.</p></article>
            </div>
          </>}
          <footer className="footer"><span>KYIV ALERT</span><span><CircleHelp size={14} aria-hidden="true" /> Локальна DEMO-версія</span></footer>
        </main>
      </div>
    </div>
  );
}
