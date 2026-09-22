/**
 * The page-world half of the extension, started the way
 * src/page/<platform>.entry.js starts it — on the harness adapter instead of
 * the platform's own, because the page is served from localhost.
 *
 * Everything from here down is the real code: the run-record handshake, the
 * fetch/XHR hooks, the collect loop, the pacing, the scroll driver, the
 * outlier baseline and the sort.
 */

import { startPageRuntime } from "../../src/page/run.js";
import { harnessAdapter } from "./adapter.js";

startPageRuntime(harnessAdapter);

