export function getModusignRedirectUrl(path: string, siteUrl?: string) {
  if (!siteUrl) return undefined;

  try {
    const url = new URL(path, siteUrl);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
