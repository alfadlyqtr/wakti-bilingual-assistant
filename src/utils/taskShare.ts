const PUBLIC_APP_ORIGIN = 'https://wakti.qa';

export function getTaskShareOrigin(): string {
  if (typeof window === 'undefined') {
    return PUBLIC_APP_ORIGIN;
  }

  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return PUBLIC_APP_ORIGIN;
  }

  return origin;
}

export function buildSharedTaskUrl(shareLink: string): string {
  return `${getTaskShareOrigin()}/shared-task/${encodeURIComponent(shareLink)}`;
}
