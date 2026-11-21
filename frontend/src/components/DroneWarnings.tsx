import { Radio, TriangleAlert } from 'lucide-react';
import type { DroneFeed, DroneWarning } from '../hooks/useDroneThreats';
import { mapRegions } from '../services/locations';
import { credibilityLabels, droneNotice, kyivTime, officialMap, threatLabels } from '../services/monitoring';

const areaNames = new Map(mapRegions.map(area => [area.id, area.name]));
const sourceLabels = { ready: 'Потік оновлюється', connecting: 'Підключення до джерела',
  unavailable: 'Зв’язок із джерелом втрачено', disabled: 'Telegram-моніторинг вимкнено' };

export function WarningDetails({ warning }: { warning: DroneWarning }) {
  return <div className="warning-details">
    <span className={`warning-status ${warning.kind.toLowerCase()}`} title={warning.status}>{credibilityLabels[warning.status]}</span>
    <h3>{threatLabels[warning.kind]}</h3>
    <p>{areaNames.get(warning.regionId)}</p>
    <p>{warning.status === 'CONFIRMED' ? 'Офіційне оголошення' : 'Попереднє оголошення'} ·{' '}
      <time dateTime={warning.publishedAt}>{kyivTime.format(new Date(warning.publishedAt))}</time></p>
    <a href={warning.sourceUrl} target="_blank" rel="noreferrer">
      {warning.status === 'UNVERIFIED' ? 'Першоджерело' : 'Оригінал офіційного оголошення'}
    </a>
  </div>;
}

export function DroneWarnings({ feed, onSelect }: { feed: DroneFeed; onSelect: (warning: DroneWarning) => void }) {
  const sections = [
    { name: 'Дійсні попередження', entries: feed.warnings.filter(warning => warning.status === 'CONFIRMED') },
    { name: 'Потребують перевірки', entries: feed.warnings.filter(warning => warning.status !== 'CONFIRMED') },
  ];
  return <section className="panel threat-panel" id="threats" aria-labelledby="threats-title">
    <p className="eyebrow"><Radio size={16} aria-hidden="true" /> DRONE THREAT RADAR</p>
    <h2 id="threats-title">Регіональні попередження</h2>
    <p className="threat-caution">{droneNotice}.</p>
    <p className="threat-source-state" role="status"><TriangleAlert size={16} aria-hidden="true" />{sourceLabels[feed.status]}</p>
    {feed.checkedAt && <p className="threat-time">Остання синхронізація · <time dateTime={feed.checkedAt}>{kyivTime.format(new Date(feed.checkedAt))}</time></p>}
    {sections.map(section => section.entries.length > 0 && <div key={section.name} className="threat-group">
      <h3>{section.name}</h3>
      <ul>{section.entries.map(warning => <li key={warning.regionId}>
        <button type="button" onClick={() => onSelect(warning)}>
          <strong>{areaNames.get(warning.regionId)}</strong>
          <span className={`warning-status ${warning.status === 'CONFIRMED' ? warning.kind.toLowerCase() : 'inactive'}`}>
            {warning.status === 'CONFIRMED' ? threatLabels[warning.kind] : credibilityLabels[warning.status]}
          </span>
        </button>
      </li>)}</ul>
    </div>)}
    {!feed.warnings.length && <p className="threat-empty">{feed.status === 'ready'
      ? 'У підключених джерелах зараз немає окремих попереджень цього типу. Покриття Telegram: Київ і Київська область.'
      : 'Актуальні попередження з Telegram недоступні.'}</p>}
    <a className="threat-official" href={officialMap} target="_blank" rel="noreferrer">Звірити стан повітряної тривоги</a>
  </section>;
}
