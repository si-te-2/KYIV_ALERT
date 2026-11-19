import { ArrowUpRight, Radio } from 'lucide-react';
import type { CivilAlert, useCivilAlerts } from '../hooks/useCivilAlerts';

const regions = [
  { id: 'UA-30', name: 'Київ' },
  { id: 'UA-32', name: 'Київська область' },
];
const statusLabels = {
  connecting: 'Підключення…',
  disabled: 'Моніторинг вимкнено',
  ready: 'Канал доступний',
  unavailable: 'Джерело недоступне',
};

const dateFormat = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short',
});

export function CivilAlertsPanel({ feed }: { feed: ReturnType<typeof useCivilAlerts> }) {
  const entries = feed.status === 'ready' ? feed.alerts : [];

  return <section className="panel civil-alerts" aria-labelledby="civil-title">
    <div className="civil-header">
      <h2 id="civil-title"><Radio size={19} aria-hidden="true" /> Офіційні повідомлення</h2>
      <span className={'tag' + (feed.status === 'unavailable' ? ' active-alert' : '')}>{statusLabels[feed.status]}</span>
    </div>
    <div className="civil-regions" aria-live="polite">
      {regions.map(region => <CivilAlertSummary key={region.id} name={region.name}
        entry={entries.find(item => item.regionId === region.id)} />)}
    </div>
    <div className="civil-footer muted">
      <span>{feed.status === 'ready' && feed.checkedAt
        ? `Перевірено ${dateFormat.format(new Date(feed.checkedAt))}`
        : 'Поточний стан тривог невідомий.'}</span>
      <a href="https://map.ukrainealarm.com/" target="_blank" rel="noreferrer">Офіційна мапа <ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
  </section>;
}

function CivilAlertSummary({ name, entry }: { name: string; entry?: CivilAlert }) {
  return <article className="civil-region">
    <h3>{name}</h3>
    <p className={entry?.active ? 'warning' : 'muted'}>
      {entry ? (entry.active ? alertLabel(entry) : 'Останнє повідомлення · відбій') : 'Стан невідомий'}
    </p>
    {entry && <a className="civil-source muted" href={entry.sourceUrl} target="_blank" rel="noreferrer">
      <time dateTime={entry.publishedAt}>{dateFormat.format(new Date(entry.publishedAt))}</time>
      <span>Оригінальний допис <ArrowUpRight size={13} aria-hidden="true" /></span>
    </a>}
  </article>;
}

function alertLabel(entry: CivilAlert) {
  return entry.partial ? 'Тривога в частині області' : 'Повітряна тривога';
}