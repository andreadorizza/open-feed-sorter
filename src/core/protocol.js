/**
 * The wire protocol between the two halves of the extension.
 *
 * The page-world script and the content script live in different JavaScript
 * realms on the same document and can only talk over `window.postMessage`.
 * Every message carries `NS` so we ignore the considerable amount of unrelated
 * chatter Instagram and TikTok put on that channel, and `dir` so a script never
 * picks up its own broadcast.
 */

export const NS = "sortfeedforfree";

export const TO_PAGE = "to-page";
export const TO_CONTENT = "to-content";

/**
 * page-world → content script
 *
 * There is no "ready" message. The page world starts at document_start and the
 * content script at document_idle, so anything announced at startup would be
 * broadcast before there was a listener. The content script learns that a run
 * is in flight by reading the run record itself (core/session.js).
 */
export const PageMsg = {
  /** items collected so far; drives the progress bar */
  PROGRESS: "progress",
  /** collection finished; carries the sorted items */
  DONE: "done",
  /** finished, but nothing matched (e.g. an empty date range) */
  EMPTY: "empty",
  /** collection could not start or blew up */
  FAILED: "failed",
};

/** content script → page-world */
export const ContentMsg = {
  /** abort an in-flight run and render whatever has been collected */
  STOP: "stop",
};

export function post(dir, type, payload = {}) {
  window.postMessage({ [NS]: true, dir, type, ...payload }, "*");
}

/**
 * Subscribe to one direction of the channel. Returns an unsubscribe function.
 */
export function listen(dir, handler) {
  const onMessage = (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data[NS] !== true || data.dir !== dir) return;
    handler(data);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
