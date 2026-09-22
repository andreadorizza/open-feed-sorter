/**
 * The content-script half of the extension, started the way
 * src/content/<platform>.entry.js starts it.
 *
 * The harness page is an ordinary web page, so it has no `chrome.*` and no
 * downloads shelf. Two stand-ins cover that and nothing else:
 *
 *   - `chrome.runtime.onMessage`, so the real popup (in the stage's other
 *     iframe) can talk to this tab through `chrome.tabs.sendMessage`;
 *   - a catch on download links, so an export is captured instead of saved
 *     to disk. The file itself is the real exporter's output.
 */

import { startContentRuntime } from "../../src/content/run.js";
import { PLATFORM, PROFILE } from "./adapter.js";

const listeners = [];

globalThis.chrome = {
  runtime: {
    id: "harness",
    onMessage: { addListener: (listener) => listeners.push(listener) },
  },
};

const downloads = [];
const realClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  if (!this.hasAttribute("download")) return realClick.call(this);
  const filename = this.download;
  // Read the blob now: the toolbar revokes its URL a second after the click.
  downloads.push(
    fetch(this.href)
      .then((response) => response.blob())
      .then(async (blob) => ({ filename, type: blob.type, size: blob.size, text: await blob.text() })),
  );
};

window.__harness = {
  /** The URL the popup believes the active tab is on. */
  tabUrl:
    PLATFORM === "tiktok"
      ? `https://www.tiktok.com/@${PROFILE}`
      : `https://www.instagram.com/${PROFILE}/reels/`,

  /** The receiving end of chrome.tabs.sendMessage. */
  sendMessage(message) {
    return new Promise((resolve) => {
      let answered = false;
      const sendResponse = (response) => {
        answered = true;
        resolve(response);
      };
      for (const listener of listeners) listener(message, { id: "harness" }, sendResponse);
      if (!answered) resolve(undefined);
    });
  },

  /** Every export clicked so far, as {filename, type, size, text}. */
  downloads: () => Promise.all(downloads),
};

startContentRuntime();
