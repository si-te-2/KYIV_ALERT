export function monitoringLabel(status: string | undefined, connected: boolean): string {
  if (!connected) return 'Стан невідомий';
  if (status === 'STOPPED') return 'Зупинено';
  return 'Стан невідомий';
}
