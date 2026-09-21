import instagram from "./instagram.js";
import tiktok from "./tiktok.js";

export const ADAPTERS = { instagram, tiktok };

/** Pick the adapter for a hostname, or null when we don't handle this site. */
export function adapterForHost(hostname = location.hostname) {
  if (/(^|\.)instagram\.com$/.test(hostname)) return instagram;
  if (/(^|\.)tiktok\.com$/.test(hostname)) return tiktok;
  return null;
}
