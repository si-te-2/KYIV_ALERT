import { Bell, Radio } from 'lucide-react';
import { alertLabels, isActive, type Feed } from '../hooks/useCivilAlerts';
import type { Location } from '../services/locations';

const dateFormat = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
});

export function CivilAlertsPanel({ feed, location, notifications, enableNotifications }: {
  feed: Feed;
  location: Location;
  notifications: string;
  enableNotifications: () => void;
}) {
  const region = feed.alerts.find(entry => entry.regionId === location.regionId);
  const active = isActive(region?.level);

  return <section className={'panel regional-panel' + (active ? ' regional-active' : '')}>
    <div className="section-icon"><Radio size={20} aria-hidden="true" /></div>
    <div className="regional-summary" aria-live="polite">
      <p className="eyebrow">{location.name}</p>
      <h2>{region ? alertLabels[region.level] : 'Стан невідомий'}</h2>
      <p>{region?.publishedAt ? `Оголошення · ${dateFormat.format(new Date(region.publishedAt))}` :
        feed.checkedAt && region ? `Перевірено · ${dateFormat.format(new Date(feed.checkedAt))}` :
        feed.status === 'connecting' ? 'Оновлюємо дані…' : 'Актуальні дані для цього регіону недоступні.'}</p>
    </div>
    <div className="notification-settings">
      {notifications === 'default' &&
        <button className="secondary-button" type="button" onClick={enableNotifications}>
          <Bell size={16} aria-hidden="true" /> Увімкнути сповіщення
        </button>}
      <p>{notifications === 'granted' ? 'Сповіщення увімкнено, поки сайт відкрито.' :
        notifications === 'denied' ? 'Браузер заблокував сповіщення.' :
        notifications === 'unsupported' ? 'Браузер не підтримує сповіщення на цьому пристрої.' :
        'Сповіщення працюють, поки сайт відкрито.'}</p>
    </div>
  </section>;
}
