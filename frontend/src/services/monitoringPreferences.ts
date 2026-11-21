import { mapRegions } from './locations';

export const monitoringKey = 'kyiv-alert-monitoring';
export const locationKey = 'kyiv-alert-location';

export interface MonitoringPreferences {
  theme: 'dark' | 'light';
  regions: string[];
  notifications: boolean;
}

export const defaults: MonitoringPreferences = { theme: 'dark', regions: [], notifications: true };
const regionIds = new Set(mapRegions.map(region => region.id));

export function readMonitoringPreferences(): MonitoringPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(monitoringKey) ?? 'null') as Partial<MonitoringPreferences> | null;
    return {
      theme: saved?.theme === 'light' ? 'light' : 'dark',
      regions: Array.isArray(saved?.regions) ? [...new Set(saved.regions.filter(id => regionIds.has(id)))] : [],
      notifications: saved?.notifications !== false,
    };
  } catch {
    return defaults;
  }
}

export function saveMonitoringPreferences(preferences: MonitoringPreferences) {
  try {
    localStorage.setItem(monitoringKey, JSON.stringify(preferences));
  } catch {
    // The controls are still usable for this tab.
  }
}
