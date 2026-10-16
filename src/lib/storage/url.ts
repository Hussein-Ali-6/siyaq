const TRACKING_PARAM = /^(?:utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|twclid|ttclid|_hsenc|_hsmi)$/i;

/** Canonical form of a page URL for caching: no fragment, no tracking parameters. */
export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}
