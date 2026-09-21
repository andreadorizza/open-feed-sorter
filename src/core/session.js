/**
 * Run state that has to survive a page reload.
 *
 * Both platforms are single-page apps that only fetch a profile feed once, on
 * load. By the time the user opens our popup that request is long gone, so a
 * run works by stashing its config, reloading the tab, and letting the
 * page-world hook catch the feed request the fresh load makes. sessionStorage
 * is the right store: it survives the reload and dies with the tab, so a run
 * can never leak into a new session.
 *
 * Both worlds read the record, and they start at different times — the page
 * world at document_start, the content script at document_idle. Rather than
 * depend on that ordering, each reads the record in turn and the content
 * script, as the last reader, deletes it:
 *
 *   document_start   page world    claimRun()  → stamps claimedAt
 *   document_idle    content       takeRun()   → reads, then deletes
 *
 * The stamp is also the re-run guard. A record that already carries `claimedAt`
 * belongs to a load that never finished — a crash, or a manual refresh
 * mid-run — so the page world discards it instead of silently starting a sort
 * nobody asked for.
 */

const KEY = "sfb:run";

/**
 * @typedef {object} RunConfig
 * @property {"instagram"|"tiktok"} platform
 * @property {string} surface      e.g. "posts", "reels", "videos"
 * @property {string} sortBy       see core/sort.js
 * @property {"count"|"range"} mode
 * @property {number} count        target item count when mode === "count"
 * @property {string|object} range preset id or {fromMs,toMs} when mode === "range"
 * @property {number} startedAt
 * @property {number} [claimedAt]  set by the page world when it picks the run up
 */

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(config) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function saveRun(config) {
  return write(config);
}

/** Read the pending run without changing it. */
export function peekRun() {
  return read();
}

/**
 * Page world: take ownership of a pending run.
 *
 * Returns null — and clears the record — when it has already been claimed,
 * which means the previous load did not finish.
 */
export function claimRun() {
  const run = read();
  if (!run) return null;

  if (run.claimedAt) {
    clearRun();
    return null;
  }

  run.claimedAt = Date.now();
  write(run);
  return run;
}

/** Content script: read the record and delete it, whatever state it is in. */
export function takeRun() {
  const run = read();
  clearRun();
  return run;
}

export function clearRun() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage disabled; nothing to clear */
  }
}
