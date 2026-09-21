/**
 * Background service worker.
 *
 * Deliberately almost empty. The popup talks to content scripts directly, and
 * everything else happens in the tab, so there is no state to hold, no license
 * to check and no server to call. It exists only to open the getting-started
 * page on install.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});
