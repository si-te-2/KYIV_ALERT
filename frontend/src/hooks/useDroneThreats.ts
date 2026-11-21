import { usePollingFeed } from './useCivilAlerts';

export type Credibility = 'CONFIRMED' | 'UNVERIFIED' | 'OUTDATED' | 'CONNECTION LOST';

export interface DroneWarning {
  regionId: string;
  kind: 'SHAHED' | 'UAV';
  status: Credibility;
  publishedAt: string;
  sourceUrl: string;
}

export interface DroneFeed {
  status: 'connecting' | 'disabled' | 'ready' | 'unavailable';
  checkedAt: string | null;
  warnings: DroneWarning[];
}

const initial: DroneFeed = { status: 'connecting', checkedAt: null, warnings: [] };

const onDroneFailure = (previous: DroneFeed): DroneFeed => ({
  ...previous,
  status: 'unavailable',
  warnings: previous.warnings.map(warning => ({ ...warning, status: 'CONNECTION LOST' })),
});

export function useDroneThreats() {
  return usePollingFeed('/api/drone-warnings', initial, onDroneFailure);
}
