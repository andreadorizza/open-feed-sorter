/**
 * Content-script controller.
 *
 * Owns everything the user sees, and is the only half that can talk to the
 * extension (the page world has no `chrome` APIs). It starts a run by writing
 * the config to sessionStorage and reloading the tab — on the fresh load the
 * page-world script finds that config and takes over collection.
 */

import { adapterForHost } from "../adapters/index.js";
import { saveRun, takeRun } from "../core/session.js";
import { listen, post, PageMsg, ContentMsg, TO_CONTENT, TO_PAGE } from "../core/protocol.js";
import { Banner } from "./runtime/banner.js";
import { renderGrid, clearGrid } from "./runtime/grid.js";
import { Toolbar } from "./runtime/toolbar.js";

/**
 * How long to wait for any sign of life from the page world before telling the
 * user the run could not start. Generous, because a cold profile load on a slow
 * connection can take a while to produce its first feed response.
 */
const STALL_TIMEOUT_MS = 20_000;

export function startContentRuntime() {
  const adapter = adapterForHost();
  if (!adapter) return;

  const banner = new Banner();
  const toolbar = new Toolbar({
    onReorder: (items) => render(items),
    onExit: () => {
      toolbar.remove();
      clearGrid();
    },
  });

  let meta = {};
  let settled = false;

  /**
   * Render the grid and re-seat the toolbar above it.
   *
   * The toolbar is re-mounted on every render rather than left in place: the
   * grid is destroyed and rebuilt each time, so a toolbar inserted next to the
   * old one would end up below the new one.
   */
  function render(items) {
    const grid = renderGrid(items, {
      container: adapter.gridContainer(),
      onOpen: (item) => window.open(item.url, "_blank", "noopener"),
    });
    if (grid) toolbar.mount(items, meta, grid);
  }

  listenForPopup(adapter);
  listenForPageWorld();
  resumePendingRun();

  // ── popup → content ────────────────────────────────────────────────────
  function listenForPopup(adapter) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "sfb:context") {
        sendResponse({
          platform: adapter.id,
          label: adapter.label,
          surface: adapter.detectSurface(),
          surfaces: adapter.surfaces,
          profile: adapter.profileName(),
        });
        return false;
      }

      if (message?.type === "sfb:run") {
        const surface = adapter.detectSurface();
        if (!surface) {
          sendResponse({ ok: false, error: "Open a profile page first." });
          return false;
        }

        const saved = saveRun({
          ...message.config,
          platform: adapter.id,
          surface,
          startedAt: Date.now(),
        });
        if (!saved) {
          sendResponse({ ok: false, error: "Session storage is unavailable in this tab." });
          return false;
        }

        sendResponse({ ok: true });
        // Reload after responding, so the popup's message channel isn't torn
        // down mid-reply — which surfaces as a confusing "port closed" error.
        setTimeout(() => location.reload(), 0);
        return false;
      }

      return false;
    });
  }

  // ── page world → content ───────────────────────────────────────────────
  function listenForPageWorld() {
    listen(TO_CONTENT, (message) => {
      switch (message.type) {
        case PageMsg.PROGRESS:
          settled = true;
          banner.setSubtitle(
            message.target
              ? `Collected ${message.collected} of ${message.target}`
              : `Collected ${message.collected}`,
          );
          banner.setProgress(message.ratio);
          break;

        case PageMsg.DONE:
          settled = true;
          meta = message.meta;
          render(message.items);
          banner.finish(summarise(message));
          break;

        case PageMsg.EMPTY:
          settled = true;
          banner.finish("Nothing matched — the original feed is untouched.");
          break;

        case PageMsg.FAILED:
          settled = true;
          banner.finish(`Sort failed: ${message.message}`, { autoHideMs: 8000 });
          break;
      }
    });
  }

  /**
   * Pick up a run that the page world started on this load.
   *
   * The record is the handshake. Reading it here rather than waiting for a
   * message avoids depending on which world's script ran first — see
   * core/session.js. This is the record's last reader, so it deletes it.
   */
  function resumePendingRun() {
    const run = takeRun();
    if (!run) return;

    // No claim stamp means the page-world script never ran at all — the one
    // failure that would otherwise leave the user staring at an unchanged feed.
    if (!run.claimedAt) {
      banner.show({ title: "Couldn't start the sort", onStop: () => banner.hide() });
      banner.finish("Couldn't start the sort — try reloading the page.", { autoHideMs: 8000 });
      return;
    }

    banner.show({
      title: describeRun(run),
      subtitle: "Scrolling the feed to collect posts…",
      onStop: () => {
        post(TO_PAGE, ContentMsg.STOP);
        banner.setTitle("Finishing up…");
        banner.setSubtitle("");
      },
    });

    setTimeout(() => {
      if (settled) return;
      banner.finish("The feed didn't load — try reloading the page.", { autoHideMs: 8000 });
    }, STALL_TIMEOUT_MS);
  }
}

function describeRun(config) {
  const what = config?.mode === "count" ? `${config.count} posts` : "a date range";
  return `Sorting ${what} by ${config?.sortBy ?? "views"}…`;
}

function summarise({ items, meta }) {
  if (meta.reason === "stopped") return `Stopped — showing ${items.length} sorted.`;
  if (meta.reason === "stalled") return `Showing ${items.length} — the feed stopped loading more.`;
  return `Sorted ${items.length} posts.`;
}
