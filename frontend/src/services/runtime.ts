export const staticSite = import.meta.env.VITE_STATIC_SITE === 'true';

export function parsePublicApiOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch { return null; }
}

export const publicApiOrigin = parsePublicApiOrigin(import.meta.env.VITE_PUBLIC_API_ORIGIN);
export const droneApiUrl = staticSite
  ? publicApiOrigin ? `${publicApiOrigin}/api/drone-warnings` : null
  : '/api/drone-warnings';
