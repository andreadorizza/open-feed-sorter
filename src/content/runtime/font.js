/**
 * The Matrix Sans Screen typeface, for everything we draw on the host page.
 *
 * The font is bundled into the content script as bytes and registered with the
 * FontFace API. Linking it with @font-face would mean a web_accessible_resources
 * entry — which lets any page probe for the extension — and a font request the
 * host's Content-Security-Policy may block. Bytes handed to FontFace are not a
 * request at all.
 *
 * Matrix Sans © The Matrix Sans Project Authors, SIL Open Font License 1.1 —
 * see src/fonts/OFL.txt.
 */

import fontBytes from "../../fonts/MatrixSansScreen-Regular.woff2";

/** Namespaced, so it can never collide with a family the host page defines. */
export const FONT_FAMILY = "SFF Matrix Sans Screen";

let installed = false;

export function installFont(doc = document) {
  if (installed || typeof FontFace !== "function" || !doc.fonts) return;
  installed = true;
  try {
    const face = new FontFace(FONT_FAMILY, fontBytes);
    doc.fonts.add(face);
    // Binary sources still decode asynchronously; a failure just leaves the
    // monospace fallback in place.
    face.load().catch(() => {});
  } catch {
    // Same: the UI stays usable in the fallback face.
  }
}
