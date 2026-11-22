import { describe, expect, it } from 'vitest';
import { parsePublicCivilFeed } from './publicCivilFeed';

const now = Date.parse('2026-11-22T20:00:00Z');
const payload = (alerts: unknown[]) => ({ updated_at: new Date(now).toISOString(), active: alerts.length, alerts });

describe('public civil alert feed for GitHub Pages', () => {
  it('preserves district-only warnings and marks the parent as partial', () => {
    const result = parsePublicCivilFeed(payload([{ slug: 'odeskii-raion', level: 'red' }]), now);
    expect(result.alerts.find(alert => alert.regionId === 'UA5110')?.level).toBe('active');
    expect(result.alerts.find(alert => alert.regionId === 'UA-51')?.level).toBe('partial');
    expect(result.alerts.find(alert => alert.regionId === 'UA-30')?.level).toBe('clear');
    expect(result.alerts.find(alert => alert.regionId === 'UA-43')).toBeUndefined();
  });

  it('inherits a whole-oblast alert into its districts', () => {
    const result = parsePublicCivilFeed(payload([{ slug: 'odeska', level: 'red' }]), now);
    expect(result.alerts.filter(alert => alert.regionId.startsWith('UA51') && alert.inherited)).toHaveLength(7);
  });

  it('keeps a community alert partial in the district and oblast', () => {
    const result = parsePublicCivilFeed(payload([{
      slug: 'm-xerson-ta-xersonska-teritorialna-gromada', level: 'red',
    }]), now);
    expect(result.alerts.find(alert => alert.regionId === 'UA6510')?.level).toBe('partial');
    expect(result.alerts.find(alert => alert.regionId === 'UA-65')?.level).toBe('partial');
  });

  it('rejects incomplete, stale and unknown payloads before generating any clear status', () => {
    expect(() => parsePublicCivilFeed({ ...payload([]), active: 1 }, now)).toThrow();
    expect(() => parsePublicCivilFeed(payload([]), now + 240000)).toThrow();
    expect(() => parsePublicCivilFeed(payload([{ slug: 'unknown', level: 'red' }]), now)).toThrow();
    expect(() => parsePublicCivilFeed(payload([{ slug: 'odeska', level: 'unknown' }]), now)).toThrow();
    expect(() => parsePublicCivilFeed(null, now)).toThrow();
  });

  it('leaves uncovered districts unknown when a community cannot be matched', () => {
    const result = parsePublicCivilFeed(payload([{
      slug: 'unknown-community', oblast_slug: 'odeska', level: 'red',
    }]), now);
    expect(result.alerts.find(alert => alert.regionId === 'UA-51')?.level).toBe('partial');
    expect(result.alerts.find(alert => alert.regionId === 'UA5110')).toBeUndefined();
  });
});
