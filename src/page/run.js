/**
 * Page-world entry point, shared by every platform.
 *
 * Runs at document_start in the MAIN world. On a normal page load it does
 * almost nothing: it checks for a pending run and returns. When one is
 * present — meaning the content script just reloaded the tab on the user's
 * behalf — it installs the network hooks before the site has issued its first
 * feed request, and drives the run from there.
 *
 * It announces nothing at startup: the content script does not exist yet at
 * document_start, so a broadcast here would have no listener. The content
 * script reads the same run record to learn that a run is in flight.
 */

import { claimRun } from "../core/session.js";
import { post, listen, PageMsg, ContentMsg, TO_PAGE, TO_CONTENT } from "../core/protocol.js";
import { sortItems } from "../core/sort.js";
import { computeBaseline, stampScores, OUTLIER_DEFAULTS } from "../core/outlier.js";
import { resolveRange } from "../core/dates.js";
import { StopSignal } from "./runtime/abort.js";
import { installNetworkHooks } from "./runtime/net-hooks.js";
import { Collector } from "./runtime/collector.js";

/**
 * How far past the finish line a run may read to fill the outlier baseline.
 * About four pages: enough to score a "Latest 25" run or a short date range,
 * small enough that an account with few eligible posts doesn't turn a quick
 * run into a long one.
 */
const BASELINE_MAX_EXTRA = 48;

/** Metric an outlier score is measured in, per surface. */
function outlierMetric(adapter, surface) {
  // Instagram photos and carousels have no view count, so a Posts grid has to
  // be scored on likes. Anywhere views exist for every item, views is the
  // truer signal — it is not capped by how many people follow the account.
  if (adapter.id === "instagram" && surface === "posts") return "likes";
  return "views";
}

export function startPageRuntime(adapter) {
  const config = claimRun();
  if (!config || config.platform !== adapter.id) return;

  if (config.mode === "range") {
    config.resolvedRange = resolveRange(config.range);
  }

  const signal = new StopSignal();
  listen(TO_PAGE, (msg) => {
    if (msg.type === ContentMsg.STOP) signal.stop();
  });

  const collector = new Collector({
    adapter,
    config,
    signal,
    onProgress: (progress) => post(TO_CONTENT, PageMsg.PROGRESS, progress),
    // Always, not only for an outlier sort: every tile shows its score.
    baseline: {
      metric: outlierMetric(adapter, config.surface),
      need: OUTLIER_DEFAULTS.cap,
      maxExtra: BASELINE_MAX_EXTRA,
    },
  });

  const uninstall = installNetworkHooks(
    (url) => adapter.matchesFeedRequest(url),
    (_url, json) => collector.acceptPage(json),
  );

  collector
    .finished()
    .then((result) => {
      uninstall();
      finishRun(adapter, config, result);
    })
    .catch((error) => {
      uninstall();
      post(TO_CONTENT, PageMsg.FAILED, { message: String(error?.message || error) });
    });
}

function finishRun(adapter, config, result) {
  const { items, pool, reason } = result;

  if (!items.length) {
    post(TO_CONTENT, PageMsg.EMPTY, { reason, config });
    return;
  }

  const metric = outlierMetric(adapter, config.surface);

  // Score whenever we can, not only when the user asked for an outlier sort:
  // the pool is already in memory, so the scores and the extra sort option are
  // free. A stopped run is scored too — its pool is the newest part of the
  // feed, which is exactly what the baseline reads, and computeBaseline
  // declines when there is too little of it.
  const outlier = computeBaseline(pool, { metric });
  if (outlier.status === "ok") stampScores(items, outlier);

  const sorted = sortItems(items, config.sortBy, { outlierFallback: metric });

  post(TO_CONTENT, PageMsg.DONE, {
    items: sorted,
    meta: {
      reason,
      config,
      outlier,
      collected: items.length,
      poolSize: pool.length,
      profile: adapter.profileName(),
    },
  });
}
