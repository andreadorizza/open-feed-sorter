/** Raw item JSON — the export for anyone who wants to do their own analysis. */

const OMIT = new Set(["html"]); // the captured DOM tile: large and useless off-page

export function toJson(items, meta = {}) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      generator: "sort-feed-better",
      ...meta,
      items: items.map((item) => {
        const copy = {};
        for (const [key, value] of Object.entries(item)) {
          if (!OMIT.has(key)) copy[key] = value;
        }
        return copy;
      }),
    },
    null,
    2,
  );
}
