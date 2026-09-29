/**
 * Feedback: when the popup asks for a review, and the debug info a user pastes
 * into a bug report.
 *
 * Neither sends anything. The review request is a link the user may click, and
 * the debug info goes to the clipboard, so the user sees every word of it
 * before it reaches an issue.
 */

/** Sorts started from the popup before it asks, once, for a review. */
export const REVIEW_ASK_AFTER_RUNS = 3;

/**
 * The popup's own record, in the extension's localStorage. That storage belongs
 * to the extension's origin, so Instagram and TikTok cannot read it — unlike
 * the tab's sessionStorage the run handshake uses.
 */
const KEY = "sfb:feedback";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return {
      runs: Number.isFinite(parsed?.runs) ? parsed.runs : 0,
      asked: parsed?.asked === true,
    };
  } catch {
    return null;
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function recordRunStarted() {
  const state = read();
  if (state) write({ ...state, runs: state.runs + 1 });
}

/**
 * True exactly once: on the first popup opened after enough sorts. It is marked
 * as asked before it is shown, so the popup never asks twice — and if storage
 * cannot be written, it does not ask at all rather than asking every time.
 *
 * It does not look at how the last sort went. Asking only people whose sorts
 * worked would be picking reviewers by likely rating; the request carries a
 * bug link beside the review link instead.
 */
export function takeReviewAsk() {
  const state = read();
  if (!state || state.asked || state.runs < REVIEW_ASK_AFTER_RUNS) return false;
  return write({ ...state, asked: true });
}

/**
 * "Google Chrome 138", "Brave 138", "Microsoft Edge 138" — the store installs
 * into any Chromium browser, and bugs sometimes belong to one of them.
 *
 * @param {{brand:string, version:string}[]|undefined} brands  navigator.userAgentData.brands
 * @param {string} [userAgent]  fallback where userAgentData is missing
 */
export function describeBrowser(brands, userAgent = "") {
  const real = (brands || []).filter((b) => !/not.?a.?brand/i.test(b.brand));
  const named = real.find((b) => b.brand !== "Chromium") || real[0];
  if (named) return `${named.brand} ${named.version}`;
  const chrome = /Chrome\/(\d+)/.exec(userAgent);
  return chrome ? `Chromium ${chrome[1]}` : "unknown browser";
}

/** The popup's "Everything" option. */
const UNLIMITED = 100000;

function describeSettings(run) {
  const amount =
    run.mode === "range" ? `posted within ${run.range}` : run.count >= UNLIMITED ? "everything" : `latest ${run.count}`;
  return `sort by ${run.sortBy}, ${amount}`;
}

function describeOutcome(run) {
  switch (run.outcome) {
    case "running":
      return `still running, ${run.collected ?? 0} collected`;
    case "done":
      return `sorted ${run.items} (ended: ${run.reason})`;
    case "empty":
      return `nothing matched (ended: ${run.reason})`;
    case "failed":
      return `failed: ${run.error}`;
    case "no-feed":
      return "no feed response within 20 s";
    case "not-started":
      return "page script never ran";
    default:
      return run.outcome;
  }
}

/**
 * Plain text for the bug form's "Debug info" field.
 *
 * Leaves out the profile name, the tab's address and every post: a bug report
 * is public, and the form asks for a profile separately, as an opt-in.
 *
 * @param {object} info
 * @param {string} info.version
 * @param {string} info.browser  from describeBrowser
 * @param {string} info.os
 * @param {string} info.tab      what the popup made of the active tab
 * @param {object|null} [info.lastRun]  the content script's record of this tab's last sort
 */
export function describeDiagnostics({ version, browser, os, tab, lastRun }) {
  const lines = [`Open Feed Sorter ${version}`, `Browser: ${browser} on ${os}`, `Tab: ${tab}`];

  if (!lastRun) {
    lines.push("Last sort: none in this tab since it loaded");
  } else {
    lines.push(`Last sort: ${describeOutcome(lastRun)}`);
    lines.push(`Settings: ${lastRun.surface}, ${describeSettings(lastRun)}`);
    if (lastRun.outlier) lines.push(`Outlier baseline: ${lastRun.outlier}`);
  }
  return lines.join("\n");
}
