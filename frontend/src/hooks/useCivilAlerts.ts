import { useEffect, useState } from 'react';

export interface CivilAlert {
  regionId: string;
  active: boolean;
  partial: boolean;
  publishedAt: string;
  sourceUrl: string;
}

interface CivilAlertsSnapshot {
  status: 'connecting' | 'disabled' | 'ready' | 'unavailable';
  checkedAt: string | null;
  alerts: CivilAlert[];
}

export function useCivilAlerts() {
  const [snapshot, setSnapshot] = useState<CivilAlertsSnapshot>({
    status: 'connecting', checkedAt: null, alerts: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      try {
        const response = await fetch('/api/civil-alerts', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error('Civil alert feed unavailable.');
        const next = await response.json() as CivilAlertsSnapshot;
        if (!controller.signal.aborted) setSnapshot(next);
      } catch {
        if (!controller.signal.aborted) {
          setSnapshot({ status: 'unavailable', checkedAt: null, alerts: [] });
        }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 10000);
      }
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return snapshot;
}
