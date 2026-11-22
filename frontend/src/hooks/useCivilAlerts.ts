import { useEffect, useState } from 'react';
import { staticSite } from '../services/runtime';
import { parsePublicCivilFeed } from '../services/publicCivilFeed';

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
  return usePollingFeed(staticSite ? 'https://tryvoha.online/api/v1/alerts' : '/api/civil-alerts',
    initial, onCivilFailure, staticSite ? parsePublicCivilFeed : undefined);
}

export function usePollingFeed<T>(
  url: string | null, initialFeed: T, onFailure: (previous: T) => T,
  decode?: (value: unknown) => T,
) {
  const [feed, setFeed] = useState(initialFeed);

  useEffect(() => {
    if (!url) return;
    const feedUrl = url;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      try {
        const response = await fetch(feedUrl, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error('Regional alerts unavailable.');
        const payload = await response.json();
        const next = decode ? decode(payload) : payload as T;
        if (!controller.signal.aborted) setFeed(next);
      } catch {
        if (!controller.signal.aborted) setFeed(onFailure);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, staticSite ? 45000 : 10000);
      }
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [url, onFailure, decode]);

  return feed;
}

export function statusLabel(level?: AlertLevel) {
  return isActive(level) ? 'Тривога є' : level === 'clear' || level === 'ended' ? 'Тривоги немає' : 'Немає даних';
}
