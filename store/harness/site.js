/**
 * A stand-in for a social site's profile page.
 *
 * Deliberately generic and greyscale: no platform's logo, colours, icons or
 * layout. What matters is that it behaves the way the extension expects a
 * profile page to behave:
 *
 *   - the feed arrives as JSON from an endpoint the real adapter recognises,
 *     fetched by the page itself;
 *   - tiles are rendered from that JSON after it lands, a page at a time;
 *   - more is loaded by infinite scroll when the reader reaches the bottom of
 *     the page — so the extension's own scrolling is what paginates it.
 *
 * It loads only at the very bottom, under a footer, rather than as the last
 * row approaches. The extension centres each tile as it captures it, so an
 * early trigger would let a page land while the collector pauses between
 * pages. The collector only looks at its queue again once a later page
 * arrives, so a page landing in that pause makes the run depend on timing.
 * Loading only when the collector scrolls to the end keeps every run
 * identical.
 *
 * `?platform=tiktok` switches the endpoint and tile links to the TikTok
 * shapes. `?hold=N` stops loading after N posts, which freezes a run
 * mid-collection for the "collecting" screenshot.
 */

import { ACCOUNT } from "./fixture.js";
import { avatar } from "./thumbs.js";

const params = new URLSearchParams(location.search);
const PLATFORM = params.get("platform") === "tiktok" ? "tiktok" : "instagram";
const HOLD = Number(params.get("hold")) || Infinity;

const FEEDS = {
  instagram: {
    url: (page) => `/api/graphql?query=profile_clips&page=${page}`,
    read(json) {
      const connection = json.data.xdt_api__v1__clips__user__connection_v2;
      return {
        hasMore: connection.page_info.has_next_page,
        posts: connection.edges.map(({ node: { media } }) => ({
          href: `/${media.user.username}/reel/${media.code}/`,
          image: media.image_versions2.candidates[0].url,
        })),
      };
    },
  },
  tiktok: {
    url: (page) => `/api/post/item_list/?cursor=${page}`,
    read(json) {
      return {
        hasMore: json.hasMore,
        posts: json.itemList.map((item) => ({
          href: `/@${item.author.uniqueId}/video/${item.id}`,
          image: item.video.cover,
        })),
      };
    },
  },
};

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

function renderShell() {
  const face = avatar();
  document.body.innerHTML = `
    <header class="topbar">
      <div class="topbar__inner">
        <span class="topbar__mark" aria-hidden="true"></span>
        <div class="topbar__search"><span class="topbar__lens" aria-hidden="true"></span>Search</div>
        <nav class="topbar__icons" aria-hidden="true">
          <span class="ico ico--home"></span><span class="ico ico--bell"></span><span class="ico ico--plus"></span>
          <img class="topbar__me" src="${face}" alt="">
        </nav>
      </div>
    </header>
    <main class="page">
      <section class="profile">
        <img class="profile__avatar" src="${face}" alt="">
        <div class="profile__info">
          <div class="profile__titleRow">
            <h1 class="profile__name">${ACCOUNT.name}</h1>
            <span class="profile__demo">${ACCOUNT.note}</span>
          </div>
          <p class="profile__handle">@${ACCOUNT.handle}</p>
          <p class="profile__stats"><b>${ACCOUNT.posts}</b> posts <b>${ACCOUNT.followers}</b> followers <b>${ACCOUNT.following}</b> following</p>
          <p class="profile__bio">${ACCOUNT.bio}</p>
        </div>
        <div class="profile__actions">
          <button class="btn btn--solid" type="button">Follow</button>
          <button class="btn" type="button">Message</button>
        </div>
      </section>
      <nav class="tabs" aria-label="Profile sections">
        <a class="tabs__tab">All</a>
        <a class="tabs__tab is-active">${PLATFORM === "tiktok" ? "Videos" : "Reels"}</a>
        <a class="tabs__tab">Photos</a>
        <a class="tabs__tab">About</a>
      </nav>
      <div class="feed">
        <div class="feed__grid"></div>
        <div class="feed__sentinel"></div>
        <div class="feed__spinner" hidden><span></span><span></span><span></span></div>
      </div>
      <footer class="footer">
        <p>About · Help · Press · Jobs · Privacy · Terms · Language</p>
        <p>A fictional profile page, made for screenshots.</p>
      </footer>
    </main>
  `;
}

function tile(post) {
  const node = el("div", "post");
  node.innerHTML =
    `<a class="post__link" href="${post.href}">` +
    `<img class="post__img" src="${post.image}" alt="">` +
    `</a>`;
  return node;
}

async function main() {
  renderShell();

  const feed = FEEDS[PLATFORM];
  const grid = document.querySelector(".feed__grid");
  const sentinel = document.querySelector(".feed__sentinel");
  const spinner = document.querySelector(".feed__spinner");

  let page = 0;
  let shown = 0;
  let loading = false;
  let hasMore = true;

  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    spinner.hidden = false;

    // The frozen-run screenshot: keep the spinner up and never fetch again.
    if (shown >= HOLD) return;

    const response = await fetch(feed.url(page));
    const { posts, hasMore: more } = feed.read(await response.json());
    grid.append(...posts.map(tile));
    shown += posts.length;
    page += 1;
    hasMore = more;

    // Decode before revealing, as a real grid's images would have loaded.
    await Promise.all([...grid.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
    spinner.hidden = true;
    loading = false;
    document.documentElement.dataset.feedPages = String(page);

    // A short page that does not fill the screen: keep going.
    if (hasMore && document.documentElement.scrollHeight <= innerHeight + 4) loadMore();
  }

  // Load at the bottom of the page. The sentinel check keeps a parked grid
  // (see src/content/runtime/grid.js) from loading more: parked, it sits far
  // below the viewport whatever the scroll position.
  addEventListener(
    "scroll",
    () => {
      const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
      if (atBottom && sentinel.getBoundingClientRect().top < innerHeight) loadMore();
    },
    { passive: true },
  );

  await loadMore();
}

main();
