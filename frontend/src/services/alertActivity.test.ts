import { describe, expect, it } from 'vitest';
import type { Feed, RegionalAlert } from '../hooks/useCivilAlerts';
import { activeCivilAlerts, changesBetween } from './alertActivity';

const first = '2026-11-19T10:00:00Z';
const second = '2026-11-19T10:01:00Z';
const area = (regionId: string, level: RegionalAlert['level'], inherited = false): RegionalAlert =>
  ({ regionId, level, inherited, publishedAt: null });
const snapshot = (checkedAt: string, alerts: RegionalAlert[], status: Feed['status'] = 'ready'): Feed =>
  ({ status, checkedAt, alerts });

describe('civil alert activity', () => {
  it('lists direct active announcements without duplicating alerts inherited from the oblast', () => {
    const feed = snapshot(first, [area('UA-51', 'active'), area('UA5102', 'active', true), area('UA-65', 'clear')]);
    expect(activeCivilAlerts(feed).map(alert => alert.regionId)).toEqual(['UA-51']);
  });

  it('records only observed changes with a confirmed status', () => {
    const before = snapshot(first, [area('UA-51', 'active'), area('UA-65', 'clear'), area('UA-32', 'active')]);
    const after = snapshot(second, [area('UA-51', 'clear'), area('UA-65', 'warning'), area('UA-32', 'none')]);
    expect(changesBetween(before, after).map(alert => [alert.regionId, alert.level]))
      .toEqual([['UA-51', 'clear'], ['UA-65', 'warning']]);
  });

  it('does not invent changes when baselining, losing coverage or receiving the same snapshot', () => {
    const before = snapshot(first, [area('UA-51', 'active')]);
    expect(changesBetween(null, before)).toEqual([]);
    expect(changesBetween(before, snapshot(first, [area('UA-51', 'clear')]))).toEqual([]);
    expect(changesBetween(before, snapshot(second, [], 'unavailable'))).toEqual([]);
    expect(changesBetween(before, snapshot(second, [area('UA-51', 'clear')], 'limited'))).toEqual([]);
  });
});
