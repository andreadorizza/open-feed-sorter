/**
 * Reading the feed by watching the page fetch it.
 *
 * The counts we sort on — views, likes, comments — are in the JSON the site
 * requests for its own rendering. They are not all in the DOM: Instagram shows
 * no numbers on a grid tile at all. So instead of scraping rendered markup, we
 * wrap the page's own network primitives and read the response it was already
 * going to receive.
 *
 * This runs in the MAIN world, where the site's `window.fetch` and
 * `XMLHttpRequest` live. A content script's isolated world has its own copies
 * and would see none of this traffic.
 *
 * Both primitives are wrapped because the two platforms use different ones and
 * either may change: Instagram's GraphQL goes over XHR today, TikTok's feed
 * over fetch.
 */

/**
 * @param {(url: string, json: any) => void} onResponse
 * @param {(url: string) => boolean} matches
 * @returns {() => void} uninstall
 */
export function installNetworkHooks(matches, onResponse) {
  if (window.__sfbHooked) return () => {};
  window.__sfbHooked = true;

  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  const deliver = (url, text) => {
    if (!text || typeof text !== "string") return;
    // Cheap guard before the parse: these hooks sit on every request the page
    // makes, and most of them are not JSON.
    if (text.charCodeAt(0) !== 123 /* { */) return;
    try {
      onResponse(url, JSON.parse(text));
    } catch {
      /* a body we can't read is a body that wasn't ours */
    }
  };

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const response = await originalFetch.apply(this, arguments);

    if (matches(String(url))) {
      // Clone before reading: consuming the original body would starve the
      // page of the response it asked for.
      try {
        response
          .clone()
          .text()
          .then((text) => deliver(String(url), text))
          .catch(() => {});
      } catch {
        /* an already-consumed or opaque response can't be cloned */
      }
    }

    return response;
  };

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__sfbUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const url = this.__sfbUrl;
    if (typeof url === "string" && matches(url)) {
      this.addEventListener("load", () => {
        // responseText throws for binary response types; only text is ours.
        if (this.responseType === "" || this.responseType === "text") {
          deliver(url, this.responseText);
        }
      });
    }
    return originalSend.call(this, body);
  };

  return function uninstall() {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    window.__sfbHooked = false;
  };
}
