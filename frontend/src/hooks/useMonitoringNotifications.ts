import { useEffect, useRef, useState } from 'react';
import { alertLabels, isActive, type AlertLevel, type Feed } from './useCivilAlerts';
import type { DroneFeed } from './useDroneThreats';
import { kyivTime, threatLabels } from '../services/monitoring';
import { mapAreas, mapDistricts, type Location } from '../services/locations';
import type { MonitoringPreferences } from '../services/monitoringPreferences';

function notificationPermission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

const parentRegions = new Map(mapDistricts.map(district => [district.id, district.parentId]));
const toRegion = (id: string) => parentRegions.get(id) ?? id;

export function useMonitoringNotifications(feed: Feed, drone: DroneFeed, location: Location | null, preferences: MonitoringPreferences) {
  const [permission, setPermission] = useState(notificationPermission);
  const lastCivil = useRef(new Map<string, AlertLevel>());
  const lastDrone = useRef(new Set<string>());
  const watched = useRef('');
  const announcements = useRef(new Set<string>());

  useEffect(() => {
    const subscriptions = new Set(preferences.regions);
    if (location) subscriptions.add(location.regionId);
    const civil = new Map(feed.alerts.filter(alert => subscriptions.has(alert.regionId)).map(alert => [alert.regionId, alert.level]));
    const droneRegions = new Set([...subscriptions].map(toRegion));
    const warnings = drone.status === 'ready'
      ? drone.warnings.filter(warning => warning.status === 'CONFIRMED' && droneRegions.has(warning.regionId)) : [];
    const ready = (feed.status === 'ready' || feed.status === 'limited') && !!feed.checkedAt;
    const signature = JSON.stringify([[...subscriptions].sort(), permission, preferences.notifications, ready, drone.status]);
    const baseline = watched.current !== signature;
    const previousCivil = lastCivil.current;
    const previousDrone = lastDrone.current;
    watched.current = signature;
    lastCivil.current = civil;
    lastDrone.current = new Set(warnings.map(warning => warning.regionId));

    if (baseline || permission !== 'granted' || !preferences.notifications) return;
    function send(id: string, title: string, timestamp: string | null) {
      const key = JSON.stringify([id, title, timestamp]);
      if (announcements.current.has(key)) return;
      if (announcements.current.size >= 120) announcements.current.clear();
      announcements.current.add(key);
      const name = mapAreas.find(area => area.id === id)?.name;
      try {
        new Notification(title, {
          body: [name, timestamp && kyivTime.format(new Date(timestamp))].filter(Boolean).join(' · '),
          tag: `kyiv-alert-${id}`,
        });
      } catch {
        setPermission('unsupported');
      }
    }
    const civilAreas = new Set<string>();
    const priority = { active: 0, partial: 1, warning: 2, ended: 3, clear: 3, none: 3 };
    const changed = feed.alerts.filter(alert => subscriptions.has(alert.regionId) && isActive(alert.level) &&
      previousCivil.has(alert.regionId) && previousCivil.get(alert.regionId) !== 'none' &&
      previousCivil.get(alert.regionId) !== alert.level).sort((a, b) => priority[a.level] - priority[b.level]);
    for (const alert of changed) {
      const region = toRegion(alert.regionId);
      if (alert.inherited && civilAreas.has(region)) continue;
      civilAreas.add(region);
      const label = alert.level === 'partial' && /^UA\d/.test(alert.regionId) ? 'Тривога в частині району' : alertLabels[alert.level];
      send(alert.regionId, label, alert.publishedAt ?? feed.checkedAt);
    }
    for (const warning of warnings) {
      const civilIsActive = feed.alerts.some(alert => toRegion(alert.regionId) === warning.regionId &&
        subscriptions.has(alert.regionId) && isActive(alert.level));
      if (!previousDrone.has(warning.regionId) && !civilAreas.has(warning.regionId) &&
        !civilIsActive) send(warning.regionId, threatLabels[warning.kind], warning.publishedAt);
    }
  }, [drone, feed, location, permission, preferences]);

  async function enable() {
    if (typeof Notification === 'undefined') return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission('unsupported');
    }
  }

  return { permission, enable };
}
