/**
 * Popup.
 *
 * Asks the active tab what it is looking at, offers the options that surface
 * supports, and hands the config to the content script. Every option is
 * available to everyone — there is no tier to check.
 */

import { SORT_KEYS, availableSortKeys } from "../core/sort.js";
import { RANGE_PRESETS } from "../core/dates.js";
import { estimatePauseMs } from "../page/runtime/pace.js";
import { ADAPTERS, adapterForHost } from "../adapters/index.js";
import { dotIcon } from "../content/runtime/dots.js";
import { recordRunStarted, takeReviewAsk, describeBrowser, describeDiagnostics } from "../core/feedback.js";

const ui = {
  context: document.getElementById("context"),
  form: document.getElementById("form"),
  elsewhere: document.getElementById("elsewhere"),
  go: document.getElementById("go"),
  notProfile: document.getElementById("notProfile"),
  example: document.getElementById("example"),
  stale: document.getElementById("stale"),
  reload: document.getElementById("reload"),
  sortBy: document.getElementById("sortBy"),
  count: document.getElementById("count"),
  countField: document.getElementById("countField"),
  range: document.getElementById("range"),
  rangeField: document.getElementById("rangeField"),
  note: document.getElementById("note"),
  run: document.getElementById("run"),
  ask: document.getElementById("ask"),
  copyDebug: document.getElementById("copyDebug"),
};

/** What "Copy debug info" reports about the active tab; filled in by init. */
const debug = { tab: "not checked", lastRun: null };

init();

async function init() {
  fillRanges();
  for (const wrap of document.querySelectorAll(".select")) wrap.appendChild(dotIcon("caret"));
  wireFeedback();

  const tab = await activeTab();
  const context = tab ? await askContext(tab.id) : null;

  if (!context) {
    // The content script runs on every page of a supported site, so silence
    // there means the tab was loaded before the extension was.
    const site = siteOf(tab);
    if (site) {
      ui.context.textContent = `${site.label} · needs a reload`;
      debug.tab = `${site.label}, no reply from the content script`;
      ui.stale.hidden = false;
      ui.reload.addEventListener("click", () => {
        chrome.tabs.reload(tab.id);
        window.close();
      });
      return;
    }

    ui.context.textContent = "Not an Instagram or TikTok tab";
    debug.tab = "not Instagram or TikTok";
    fillDestinations();
    ui.elsewhere.hidden = false;
    return;
  }

  debug.lastRun = context.lastRun || null;

  if (!context.surface) {
    ui.context.textContent = `${context.label} · not a profile page`;
    debug.tab = `${context.label}, not a profile page`;
    ui.example.textContent = context.profileExample || "";
    ui.notProfile.hidden = false;
    return;
  }

  const surface = context.surfaces?.[context.surface];
  debug.tab = `${context.label}, ${surface?.label || context.surface} tab of a profile`;
  ui.context.textContent = `${context.label} · ${surface?.label || context.surface}${
    context.profile ? ` · @${context.profile}` : ""
  }`;

  fillSortKeys(surface?.metrics || []);
  ui.form.hidden = false;
  wireMode();

  ui.run.addEventListener("click", () => startRun(tab.id));
}

/**
 * The bug links carry the version into the issue form, and the review request
 * shows once, a few sorts in. Nothing here makes a request: the links open only
 * when clicked, and debug info goes to the clipboard for the user to read and
 * paste.
 */
function wireFeedback() {
  const { version } = chrome.runtime.getManifest();

  for (const link of document.querySelectorAll("[data-bug-link]")) {
    const url = new URL(link.href);
    url.searchParams.set("version", version);
    link.href = url.href;
  }

  if (takeReviewAsk()) ui.ask.hidden = false;

  const label = ui.copyDebug.textContent;
  let reset;
  const flash = (text) => {
    ui.copyDebug.textContent = text;
    clearTimeout(reset);
    reset = setTimeout(() => (ui.copyDebug.textContent = label), 2000);
  };

  ui.copyDebug.addEventListener("click", async () => {
    const text = describeDiagnostics({
      version,
      browser: describeBrowser(navigator.userAgentData?.brands, navigator.userAgent),
      os: navigator.userAgentData?.platform || navigator.platform || "unknown OS",
      tab: debug.tab,
      lastRun: debug.lastRun,
    });
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied");
    } catch {
      flash("Couldn't copy");
    }
  });
}

/** One button per supported site, so the way forward is a click, not a hunt. */
function fillDestinations() {
  for (const adapter of Object.values(ADAPTERS)) {
    const link = document.createElement("a");
    link.className = "go__link";
    link.href = adapter.homeUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `Open ${adapter.label}`;
    ui.go.appendChild(link);
  }
}

function siteOf(tab) {
  try {
    return tab?.url ? adapterForHost(new URL(tab.url).hostname) : null;
  } catch {
    return null;
  }
}

function fillRanges() {
  for (const [id, preset] of Object.entries(RANGE_PRESETS)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = preset.label;
    option.selected = id === "1m";
    ui.range.appendChild(option);
  }
}

function fillSortKeys(metrics) {
  ui.sortBy.replaceChildren();
  for (const key of availableSortKeys(metrics)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = SORT_KEYS[key].label;
    ui.sortBy.appendChild(option);
  }
  // Views is the metric people come here for; fall back to likes where a
  // surface has no view counts.
  ui.sortBy.value = metrics.includes("views") ? "views" : "likes";
  updateNote();
  ui.sortBy.addEventListener("change", updateNote);
}

function wireMode() {
  ui.count.addEventListener("change", updateNote);
  ui.range.addEventListener("change", updateNote);
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener("change", () => {
      const mode = currentMode();
      ui.countField.hidden = mode !== "count";
      ui.rangeField.hidden = mode !== "range";
      updateNote();
    });
  }
}

function currentMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

/** Both platforms serve a profile feed roughly a dozen items at a time. */
const ITEMS_PER_PAGE = 12;

/** The "Everything" option's sentinel value. */
const UNLIMITED = 100000;

function describeLargeRun(count) {
  const pages = (count === UNLIMITED ? 2000 : count) / ITEMS_PER_PAGE;
  const minutes = Math.round(estimatePauseMs(pages) / 60000);
  const scope =
    count === UNLIMITED
      ? "Reading the whole feed goes through the entire profile."
      : `A ${count}-post run pages through a lot of the profile.`;

  // Say what a long run costs before it starts. The run pauses between pages
  // on purpose — so it reads as someone scrolling rather than as a script —
  // which is worth explaining rather than leaving it to look like slowness.
  const detail =
    minutes >= 2
      ? ` It pauses between pages, so expect around ${minutes} minutes.`
      : " It pauses between pages, so expect a couple of minutes.";

  return `${scope}${detail} Smaller runs are gentler on your account.`;
}

function updateNote() {
  const notes = [];

  if (ui.sortBy.value === "outlier") {
    notes.push(
      "Outlier score = a post's views ÷ this account's median. A short run reads a few older posts to find that median.",
    );
  }

  const count = Number(ui.count.value);
  if (currentMode() === "count" && count >= 250) {
    notes.push(describeLargeRun(count));
  }

  if (currentMode() === "range" && ui.range.value === "all") {
    notes.push("All-time reads the whole profile, pausing between pages. On a large account that takes a while.");
  }

  ui.note.textContent = notes.join(" ");
}

async function startRun(tabId) {
  const mode = currentMode();
  const config = {
    sortBy: ui.sortBy.value,
    mode,
    count: mode === "count" ? Number(ui.count.value) : null,
    range: mode === "range" ? ui.range.value : null,
  };

  ui.run.disabled = true;
  ui.run.textContent = "Starting…";

  const response = await sendToTab(tabId, { type: "sfb:run", config });

  if (response?.ok) {
    recordRunStarted();
    window.close();
  } else {
    ui.run.disabled = false;
    ui.run.textContent = "Sort this profile";
    ui.note.textContent = response?.error || "Couldn't start — try reloading the page.";
  }
}

function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0] || null);
}

async function askContext(tabId) {
  const response = await sendToTab(tabId, { type: "sfb:context" });
  return response || null;
}

/**
 * Messaging a tab with no content script rejects. That is the normal case on
 * every other site, so it is swallowed rather than surfaced as an error.
 */
function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message).catch(() => null);
}
