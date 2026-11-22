import { Radio, TriangleAlert } from 'lucide-react';
import type { DroneFeed, DroneWarning } from '../hooks/useDroneThreats';
import { mapRegions } from '../services/locations';
import { credibilityLabels, kyivTime, officialMap, threatLabels } from '../services/monitoring';

const areaNames = new Map(mapRegions.map(area => [area.id, area.name]));
const sourceLabels = { ready: 'Потік оновлюється', connecting: 'Підключення до джерела',
  unavailable: 'Зв’язок із джерелом втрачено', disabled: 'Telegram-моніторинг вимкнено' };
const sourceNames: Record<string, string> = {
  'UA-30': 'Київська міська військова адміністрація',
  'UA-32': 'Київська обласна військова адміністрація',
};

export function ShahedIcon() {
  return <i className="shahed-icon" aria-hidden="true" />;
}

export function WarningDetails({ warning }: { warning: DroneWarning }) {
  return <div className="warning-details">
    <span className={`warning-status ${warning.kind.toLowerCase()}`} title={warning.status}>{credibilityLabels[warning.status]}</span>
    <h3>{threatLabels[warning.kind]}</h3>
    <p>{areaNames.get(warning.regionId)}</p>
    <p>{warning.status === 'CONFIRMED' ? 'Офіційне оголошення'
      : warning.status === 'UNVERIFIED' ? 'Неофіційне повідомлення з Telegram-каналу' : 'Попереднє оголошення'} ·{' '}
      <time dateTime={warning.publishedAt}>{kyivTime.format(new Date(warning.publishedAt))}</time></p>
    {warning.status !== 'UNVERIFIED' && sourceNames[warning.regionId] && <p>{sourceNames[warning.regionId]}</p>}
    <a href={warning.sourceUrl} target="_blank" rel="noreferrer">
      {warning.status === 'UNVERIFIED' ? 'Першоджерело' : 'Оригінал офіційного оголошення'}
    </a>
  </div>;
}

export function DroneWarnings({ feed, onSelect }: {
  feed: DroneFeed;
  onSelect: (warning: DroneWarning) => void;
}) {
  const warnings = feed.warnings;
  const sections = [
    { name: 'Дійсні попередження', entries: warnings.filter(warning => warning.status === 'CONFIRMED') },
    { name: 'Потребують перевірки', entries: warnings.filter(warning => warning.status !== 'CONFIRMED') },
  ];
  return <section className="panel threat-panel" id="threats" aria-labelledby="threats-title">
    <p className="eyebrow"><Radio size={16} aria-hidden="true" /> DRONE THREAT RADAR</p>
    <h2 id="threats-title">Регіональні попередження</h2>
    <p className="threat-source-state" role="status"><TriangleAlert size={16} aria-hidden="true" />{sourceLabels[feed.status]}</p>
    {feed.checkedAt && <p className="threat-time">Остання синхронізація · <time dateTime={feed.checkedAt}>{kyivTime.format(new Date(feed.checkedAt))}</time></p>}
    {sections.map(section => section.entries.length > 0 && <div key={section.name} className="threat-group">
      <h3>{section.name} <span className="threat-count">{section.entries.length}</span></h3>
      <ul>{section.entries.map(warning => <li key={warning.regionId}>
        <button type="button" onClick={() => onSelect(warning)}>
          <strong>{areaNames.get(warning.regionId)}</strong>
          <span className={`warning-status ${warning.status === 'CONFIRMED' ? warning.kind.toLowerCase() : 'inactive'}`}>
            {warning.status === 'CONFIRMED' ? threatLabels[warning.kind]
              : warning.status === 'UNVERIFIED' ? `${threatLabels[warning.kind]} · ${credibilityLabels.UNVERIFIED}`
              : credibilityLabels[warning.status]}
          </span>
        </button>
      </li>)}</ul>
    </div>)}
    {!warnings.length && feed.status !== 'ready' &&
      <p className="threat-empty">Актуальні попередження з Telegram недоступні.</p>}
    <a className="threat-official" href={officialMap} target="_blank" rel="noreferrer">Звірити стан повітряної тривоги</a>
  </section>;
}
