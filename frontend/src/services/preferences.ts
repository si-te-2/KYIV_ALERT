export interface Preferences {
  labels: boolean;
  focus: 'ukraine' | 'kyiv';
}

const storageKey = 'kyiv-alert-map-preferences';
const defaults: Preferences = { labels: true, focus: 'ukraine' };

export function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<Preferences> | null;
    return {
      labels: typeof saved?.labels === 'boolean' ? saved.labels : defaults.labels,
      focus: saved?.focus === 'kyiv' ? 'kyiv' : defaults.focus,
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Preferences still apply for the open tab when storage is unavailable.
  }
}
