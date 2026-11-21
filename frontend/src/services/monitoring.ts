import type { Credibility } from '../hooks/useDroneThreats';

export const officialMap = 'https://map.ukrainealarm.com/';
export const droneNotice = 'Увага! Позначки відображають регіони загрози, а не фактичне місцезнаходження БпЛА. Інформація може бути неточною або надходити із затримкою';
export const credibilityLabels: Record<Credibility, string> = {
  CONFIRMED: 'Офіційно підтверджено',
  UNVERIFIED: 'Потребує перевірки',
  OUTDATED: 'Дані застаріли',
  'CONNECTION LOST': 'Зв’язок втрачено',
};

export const threatLabels = { SHAHED: 'Загроза Shahed / «Герань»', UAV: 'Загроза ударних БпЛА' };
export const kyivTime = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short',
});
