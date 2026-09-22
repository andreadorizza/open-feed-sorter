/*
 * A fixed clock for the fake profile page.
 *
 * The fixture's posts are dated relative to one moment (NOW in fixture.js),
 * and the extension's outlier baseline leaves out posts younger than three
 * days measured from Date.now(). Pinning Date.now() to that moment keeps the
 * scores, and so the screenshots, identical whenever they are regenerated.
 * Time still advances from there, so timers and animations behave normally.
 */
(() => {
  const FIXTURE_NOW = Date.UTC(2026, 8, 21, 15, 0); // keep in step with fixture.js
  const realNow = Date.now.bind(Date);
  const offset = FIXTURE_NOW - realNow();
  Date.now = () => realNow() + offset;
})();
