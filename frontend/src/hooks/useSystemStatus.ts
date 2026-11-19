import { useEffect, useState } from 'react';
import { getStatus, type Snapshot } from '../services/api';

export function useSystemStatus() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<'loading' | 'online' | 'offline'>('loading');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;

    async function refresh() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const next = await getStatus(controller.signal);
        if (active) {
          setSnapshot(next);
          setConnection('online');
        }
      } catch {
        if (active) setConnection('offline');
      } finally {
        clearTimeout(timeout);
        if (active) timer = setTimeout(refresh, 10000);
      }
    }

    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return { snapshot, connection };
}
