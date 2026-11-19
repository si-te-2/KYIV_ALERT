import { isActive, type Feed, type RegionalAlert } from '../hooks/useCivilAlerts';

export interface AlertActivity extends RegionalAlert {
  detectedAt: string;
}

export function activeCivilAlerts(feed: Feed): RegionalAlert[] {
  return feed.alerts
    .filter(alert => isActive(alert.level) && !alert.inherited)
    .sort((left, right) => (right.publishedAt ? Date.parse(right.publishedAt) : 0) -
      (left.publishedAt ? Date.parse(left.publishedAt) : 0));
}

export function changesBetween(previous: Feed | null, current: Feed): AlertActivity[] {
  const detectedAt = current.checkedAt;
  if (!previous?.checkedAt || !detectedAt || previous.status !== current.status ||
    Date.parse(previous.checkedAt) >= Date.parse(detectedAt)) return [];

  const previousLevels = new Map(previous.alerts.map(alert => [alert.regionId, alert.level]));
  return current.alerts.flatMap(alert => {
    const before = previousLevels.get(alert.regionId);
    if (!before || before === 'none' || alert.level === 'none' || before === alert.level ||
      alert.inherited || (!isActive(before) && !isActive(alert.level))) return [];
    return [{ ...alert, detectedAt }];
  });
}
