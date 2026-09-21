/**
 * The progress banner.
 *
 * A run scrolls the page on its own for anything from a second to a minute, so
 * the interface has to say what is happening and offer a way out at all times.
 * The banner is the only chrome shown while collecting, and Stop is always
 * live.
 */

const ID = "sfb-banner";

export class Banner {
  constructor() {
    this.el = null;
    this._onStop = null;
  }

  show({ title, subtitle = "", onStop } = {}) {
    this._onStop = onStop;
    if (!this.el) this.el = this._build();

    this.setTitle(title);
    this.setSubtitle(subtitle);
    this.setProgress(null);

    if (!this.el.isConnected) document.body.appendChild(this.el);
    return this.el;
  }

  setTitle(text) {
    const node = this.el?.querySelector(".sfb-banner__title");
    if (node) node.textContent = text ?? "";
  }

  setSubtitle(text) {
    const node = this.el?.querySelector(".sfb-banner__subtitle");
    if (!node) return;
    node.textContent = text ?? "";
    node.hidden = !text;
  }

  /** @param {number|null} ratio 0..1, or null for an indeterminate bar */
  setProgress(ratio) {
    const bar = this.el?.querySelector(".sfb-banner__fill");
    const track = this.el?.querySelector(".sfb-banner__track");
    if (!bar || !track) return;

    if (ratio == null) {
      track.classList.add("sfb-banner__track--indeterminate");
      bar.style.width = "";
    } else {
      track.classList.remove("sfb-banner__track--indeterminate");
      bar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    }
  }

  /** Swap the Stop button for a dismiss affordance and auto-hide. */
  finish(message, { autoHideMs = 4000 } = {}) {
    if (!this.el) return;
    this.setTitle(message);
    this.setSubtitle("");
    this.setProgress(1);
    this.el.querySelector(".sfb-banner__stop")?.remove();
    this.el.querySelector(".sfb-banner__track")?.remove();
    if (autoHideMs) setTimeout(() => this.hide(), autoHideMs);
  }

  hide() {
    this.el?.remove();
  }

  _build() {
    const root = document.createElement("div");
    root.id = ID;
    root.className = "sfb-banner";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");

    root.innerHTML = `
      <div class="sfb-banner__body">
        <div class="sfb-banner__title"></div>
        <div class="sfb-banner__subtitle" hidden></div>
        <div class="sfb-banner__track"><div class="sfb-banner__fill"></div></div>
      </div>
      <button type="button" class="sfb-banner__stop">Stop</button>
    `;

    root.querySelector(".sfb-banner__stop").addEventListener("click", () => {
      this._onStop?.();
    });

    return root;
  }
}
