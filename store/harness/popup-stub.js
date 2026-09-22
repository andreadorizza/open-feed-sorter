/**
 * `chrome.*` for the real popup, running in an iframe beside the harness page.
 *
 * The popup only ever talks to the active tab, so each call is forwarded to
 * the page iframe's content script (see content.entry.js). What comes back —
 * the platform, surface and profile — is the real content script's answer.
 * Loaded as a module before popup.js, so it is in place when the popup starts.
 */

const tab = () => parent.document.getElementById("page").contentWindow;

globalThis.chrome = {
  runtime: { id: "harness", getURL: (path) => `/src/${path}` },
  tabs: {
    query: async () => [{ id: 1, active: true, url: tab().__harness.tabUrl }],
    get: async () => ({ id: 1, active: true, url: tab().__harness.tabUrl }),
    sendMessage: async (_tabId, message) => tab().__harness.sendMessage(message),
    reload: async () => tab().location.reload(),
  },
};
