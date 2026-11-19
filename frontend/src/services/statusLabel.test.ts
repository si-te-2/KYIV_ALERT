import { describe, expect, it } from 'vitest';
import { monitoringLabel } from './statusLabel';

describe('monitoring status', () => {
  it('displays unknown status when disconnected even with a previous snapshot', () => {
    expect(monitoringLabel('STOPPED', false)).toBe('Стан невідомий');
  });
  it('keeps unfamiliar server values visible as unknown', () => {
    expect(monitoringLabel('RUNNING', true)).toBe('Стан невідомий');
  });
});
