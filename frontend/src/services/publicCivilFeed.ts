import areasData from '../../../backend/KyivAlert.Api/Data/district-feed.json';
import type { AlertLevel, Feed, RegionalAlert } from '../hooks/useCivilAlerts';

interface FeedArea {
  slug: string;
  id: string | null;
  parentId: string;
  subarea?: boolean;
}

interface PublicAlert {
  slug?: string;
  level?: string;
  oblast_slug?: string;
  started_at?: string;
}

const areas = new Map((areasData as FeedArea[]).map(area => [area.slug, area]));
const strength = (level: AlertLevel) => level === 'active' ? 3 : level === 'warning' ? 2 : 1;

export function parsePublicCivilFeed(value: unknown, now = Date.now()): Feed {
  const payload = value as { alerts?: PublicAlert[]; active?: number; updated_at?: string } | null;
  const timestamp = Date.parse(payload?.updated_at ?? '');
  if (!payload || !Array.isArray(payload.alerts) || payload.active !== payload.alerts.length ||
    !Number.isFinite(timestamp) || timestamp < now - 180000 || timestamp > now + 60000)
    throw new Error('The civil alert feed is incomplete or stale.');

  const reported = new Map<string, RegionalAlert>();
  const unknownParents = new Set<string>();
  for (const entry of payload.alerts) {
    if (!entry || !['red', 'yellow'].includes(entry.level ?? ''))
      throw new Error('Unknown civil alert level.');
    if (entry.started_at && !Number.isFinite(Date.parse(entry.started_at)))
      throw new Error('Invalid announcement date.');
    const area = areas.get(entry.slug ?? '');
    if (!area?.id) {
      const parent = area?.parentId ?? areas.get(entry.oblast_slug ?? '')?.id;
      if (!parent) throw new Error('Unknown civil alert territory.');
      unknownParents.add(parent);
      continue;
    }
    const alert: RegionalAlert = {
      regionId: area.id,
      level: area.subarea ? 'partial' : entry.level === 'red' ? 'active' : 'warning',
      publishedAt: entry.started_at ?? null,
    };
    const previous = reported.get(area.id);
    if (!previous || strength(alert.level) > strength(previous.level)) reported.set(area.id, alert);
  }

  const partialParents = new Set([...areas.values()]
    .filter(area => area.id && area.id !== area.parentId && reported.has(area.id))
    .map(area => area.parentId));
  for (const id of unknownParents) partialParents.add(id);

  const alerts: RegionalAlert[] = [];
  const used = new Set<string>();
  const sortedAreas = [...areas.values()].sort((a, b) => Number(!!a.subarea) - Number(!!b.subarea));
  for (const area of sortedAreas) {
    if (!area.id || used.has(area.id)) continue;
    used.add(area.id);
    const specific = reported.get(area.id);
    const parent = area.id !== area.parentId ? reported.get(area.parentId) : undefined;
    if (parent && (!specific || strength(parent.level) > strength(specific.level))) {
      alerts.push({ ...parent, regionId: area.id, inherited: true });
    } else if (specific) {
      alerts.push(specific);
    } else if (area.id === area.parentId && partialParents.has(area.id)) {
      alerts.push({ regionId: area.id, level: 'partial', publishedAt: null });
    } else if (!area.subarea && !unknownParents.has(area.parentId)) {
      alerts.push({ regionId: area.id, level: 'clear', publishedAt: null });
    }
  }
  return { status: 'ready', checkedAt: payload.updated_at!, alerts };
}
