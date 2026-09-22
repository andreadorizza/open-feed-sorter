/**
 * The one piece of the extension the harness replaces.
 *
 * The fake profile page is served from localhost, not from instagram.com or
 * tiktok.com, so the real `adapterForHost()` would (correctly) decline to run,
 * and the real `detectSurface()` / `profileName()` would read the harness URL.
 * The build aliases `src/adapters/index.js` to this module; everything else —
 * endpoint matching, payload parsing, tile selectors, grid lookup — is the
 * real adapter, untouched.
 *
 * `?platform=tiktok` on the page URL picks the TikTok adapter; Instagram is
 * the default.
 */

import instagram from "../../src/adapters/instagram.js";
import tiktok from "../../src/adapters/tiktok.js";

export const PROFILE = "crumbwell.bakery";

export const PLATFORM =
  typeof location !== "undefined" && new URLSearchParams(location.search).get("platform") === "tiktok"
    ? "tiktok"
    : "instagram";

const SURFACE = { instagram: "reels", tiktok: "videos" };
const REAL = { instagram, tiktok };

export const harnessAdapter = {
  ...REAL[PLATFORM],
  detectSurface: () => SURFACE[PLATFORM],
  profileName: () => PROFILE,
};

export const ADAPTERS = { instagram, tiktok };

export function adapterForHost() {
  return harnessAdapter;
}
