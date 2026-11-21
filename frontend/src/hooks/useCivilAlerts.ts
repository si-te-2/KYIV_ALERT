import { useEffect, useState } from 'react';

export type AlertLevel = 'active' | 'warning' | 'partial' | 'ended' | 'clear' | 'none';

export interface RegionalAlert {
  regionId: string;
  level: AlertLevel;
  publishedAt: string | null;
  inherited?: boolean;
}

export interface Feed {
  status: 'connecting' | 'disabled' | 'limited' | 'ready' | 'unavailable';
  checkedAt: string | null;
  alerts: RegionalAlert[];
}

export const alertLabels: Record<AlertLevel, string> = {
  active: 'Повітряна тривога',
  warning: 'Попередження про загрозу',
  partial: 'Тривога в частині області',
  ended: 'Тривоги немає',
  clear: 'Тривоги немає',
  none: 'Немає даних',
};

export function isActive(level?: AlertLevel) {
  return level === 'active' || level === 'partial' || level === 'warning';
}

const initial: Feed = { status: 'connecting', checkedAt: null, alerts: [] };
const onCivilFailure = (previous: Feed): Feed => ({ ...previous, status: 'unavailable', alerts: [] });

export function useCivilAlerts() {
  return usePollingFeed('/api/civil-alerts', initial, onCivilFailure);
}

export function usePollingFeed<T>(url: string, initialFeed: T, onFailure: (previous: T) => T) {
  const [feed, setFeed] = useState(initialFeed);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error('Regional alerts unavailable.');
        const next = await response.json() as T;
        if (!controller.signal.aborted) setFeed(next);
      } catch {
        if (!controller.signal.aborted) setFeed(onFailure);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 10000);
      }
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [url, onFailure]);

  return feed;
}

export function statusLabel(level?: AlertLevel) {
  return isActive(level) ? 'Тривога є' : level === 'clear' || level === 'ended' ? 'Тривоги немає' : 'Немає даних';
}
