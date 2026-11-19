export interface Snapshot {
  name: string;
  demoMode: boolean;
  monitoringStatus: string;
  telegramStatus: string;
  checkedAt: string;
  sources: { name: string; status: string; originalUrl: string | null }[];
  messages: {
    id: string; text: string; classification: string; isTest: boolean;
    createdAt: string; sourceName: string; originalUrl: string | null;
  }[];
}

export async function getStatus(signal: AbortSignal): Promise<Snapshot> {
  const response = await fetch('/api/status', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Не вдалося отримати стан системи.');
  return response.json() as Promise<Snapshot>;
}
