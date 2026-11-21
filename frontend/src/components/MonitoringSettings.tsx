import { Bell, X } from 'lucide-react';
import type { RefObject } from 'react';
import { mapRegions } from '../services/locations';
import type { MonitoringPreferences } from '../services/monitoringPreferences';

export function MonitoringSettings({ dialog, preferences, update, permission, enable }: {
  dialog: RefObject<HTMLDialogElement | null>;
  preferences: MonitoringPreferences;
  update: (preferences: MonitoringPreferences) => void;
  permission: string;
  enable: () => void;
}) {
  return <dialog ref={dialog} className="panel message-dialog monitor-dialog" aria-labelledby="settings-title">
    <div className="dialog-title">
      <h2 id="settings-title">Налаштування</h2>
      <form method="dialog"><button type="submit" aria-label="Закрити налаштування"><X size={21} aria-hidden="true" /></button></form>
    </div>
    <label className="settings-opt-in">
      <input type="checkbox" checked={preferences.notifications}
        onChange={event => update({ ...preferences, notifications: event.target.checked })} />
      Сповіщати в цьому браузері
    </label>
    <p className="dialog-note">Сповіщення діють, поки сайт відкрито. Поточна вибрана територія додається автоматично.</p>
    {permission === 'default' && <button type="button" className="secondary-button" onClick={enable}>
      <Bell size={16} aria-hidden="true" /> Дозволити сповіщення
    </button>}
    {permission === 'denied' && <p>Браузер заблокував сповіщення. Дозвіл можна змінити в налаштуваннях браузера.</p>}
    {permission === 'unsupported' && <p>Сповіщення недоступні в цьому браузері.</p>}
    <fieldset className="settings-regions">
      <legend>Додаткові області</legend>
      {mapRegions.map(region => <label key={region.id}>
        <input type="checkbox" checked={preferences.regions.includes(region.id)}
          onChange={event => update({
            ...preferences,
            regions: event.target.checked ? [...preferences.regions, region.id] : preferences.regions.filter(id => id !== region.id),
          })} />
        {region.name}
      </label>)}
    </fieldset>
  </dialog>;
}
