# Chrome Web Store listing

Everything the Developer Dashboard asks for, ready to paste, for **Open Feed
Sorter 0.1.0**. Researched on 22 September 2026 against the current Chrome
docs and program policies; the sources are at the bottom, and each section
cites the ones it relies on.

Blocks marked `text` are the exact strings to paste. Character counts were
measured on those blocks (Unicode code points, final newline excluded).
`https://chromewebstore.google.com/detail/inbpbmepkjibdpakmmogmefkcgnfcbma` stands for the listing URL, which exists only once the item is
published.

**Status:** 0.1.0 published on 23 September 2026 with these fields.
Listing: https://chromewebstore.google.com/detail/inbpbmepkjibdpakmmogmefkcgnfcbma (item ID `inbpbmepkjibdpakmmogmefkcgnfcbma`). Change this file first when the listing changes, so it stays the
record of what the store shows.

Contents:

1. [Store listing tab](#1-store-listing-tab)
2. [Privacy tab](#2-privacy-tab)
3. [Distribution tab](#3-distribution-tab)
4. [Test instructions tab](#4-test-instructions-tab)
5. [Before you submit](#5-before-you-submit)
6. [Search](#6-search)
7. [Sources](#7-sources)

---

## 1. Store listing tab

### Item name

Comes from `name` in `src/manifest.json`; it cannot be edited in the dashboard.
The limit is 75 characters, for every locale, since February 2024 [S1, S2].

Value, applied in the manifest (41/75):

```text
Open Feed Sorter for Instagram and TikTok
```

Why this form is covered in [§6 Search](#6-search).

### Summary

Comes from `description` in the manifest. Limit 132 characters, plain text
[S3]. The best-practice page asks for the main use case and no superlatives
[S4].

Value, applied in the manifest, 128/132 (reasoning in [§6b](#6b-summary)):

```text
Free and open source: sort Instagram Reels and posts or TikTok videos by views, likes, comments or outlier score. Export to CSV.
```

### Description

Plain text. The store shows line breaks but no Markdown or HTML, so headings
are in capitals and lists use hyphens [S5, S6]. The dashboard documents no
length limit [S5]; this is 3,194 characters.

Written against the policies on metadata [S7, S8]:

- It opens with what the extension does, as the listing docs ask [S5, S4].
- No keyword appears more than five times. The spam FAQ says more than five
  instances of one keyword "may result in increased scrutiny" [S8]. Counts in
  this text: Instagram 4, TikTok 3, sort 5, views 5, profile 4, export 4.
- No list of sites or brands, no testimonials, no ranking claims [S7, S9].
- Every claim matches the README, including its caveats: version 0.1,
  breakage when a platform changes, the terms-of-service warning, no
  transcription and no Sheets export.

```text
Sort any Instagram or TikTok profile by views, likes, comments or outlier score, and see every count on every tile.
Free and open source. No account, no server and no paywall: it works inside the tab and sends nothing anywhere.

On the web, Instagram's Posts grid shows no numbers: hover a tile and you see likes and comments for that one post, and never its views. This extension reads the counts the page has already loaded for its own grid, then lays the grid out again, best first.

WHAT IT DOES
- Sorts posts by most views, likes, comments, shares or saves, newest or oldest, or biggest outliers.
- Puts an outlier score on every tile. 3.4x means a post did 3.4 times the account's recent median. Pinned posts and posts under three days old are left out of that median, because both would skew it. Accounts with fewer than 20 eligible posts are not scored.
- Collects as much as you ask for: the latest 25, 50, 100, 250 or 500 posts, the whole feed, or a date range from the last week to all time. Nothing is held back for a paid tier.
- Shows every metric on every tile at once.
- Changes the order instantly. Collected posts stay in memory, so switching from views to comments redraws the grid without collecting again.
- Exports to CSV, Excel (.xlsx) or JSON. The files are generated in the tab.
- Stops when you press Stop, and keeps what it has collected so far.
- Puts the site's own grid back when you press Show original feed.

WHERE IT WORKS
- Instagram: the Posts and Reels tabs of a profile. Photos and carousels have no view count, so a Posts grid is scored on likes.
- TikTok: views, likes, comments, shares and saves.

HOW TO USE IT
1. Open a profile page.
2. Click the extension icon, then choose a sort and how much to collect.
3. Press Sort this profile.

The tab reloads and then scrolls itself while it collects. The reload is needed because the site sends the first page of posts only when the page loads, and each later page only when you scroll. When it finishes, the grid is laid out again with a toolbar above it for changing the order and exporting.

PRIVACY
There is no backend, no account and no analytics. The extension makes no network requests of its own. It reads the responses the page has already received, keeps them in the tab's memory, and generates exports on your computer. It asks for access to the two sites it works on and to nothing else.

FAIR USE
It reads what the site has already sent to your browser, at the pace of a person scrolling, with a random pause between pages. It never sends feed requests of its own. Even so, automating a site is generally against the platforms' terms of service, whoever does it. Use your own judgement about your own account, and prefer the smallest run that answers your question.

LIMITS
This is version 0.1. It relies on how each site loads its feed, so a change on either site can break it until an update ships. It does no transcription and no Google Sheets export, because both would need a server.

SOURCE AND SUPPORT
Source code, issues and privacy policy: https://github.com/andreadorizza/open-feed-sorter
MIT licence. Free, with no paid tier.

Not affiliated with Instagram, Meta, TikTok or ByteDance.
```

The first two lines carry the search terms and the reasons to choose it;
alternatives are weighed in [§6c](#6c-first-two-lines-of-the-description).

### Category

**Lifestyle > Social Networking.**

The store's extension categories fall into three groups: Productivity
(Communication, Developer Tools, Education, Tools, Workflow & Planning),
Lifestyle (Art & Design, Entertainment, Games, Household, Just for Fun, News &
Weather, Shopping, Social Networking, Travel, Well-being) and Make Chrome Yours
(Accessibility, Functionality & UI, Privacy & Security). The groups were
announced in August 2023 [S10]; the 18 names above are the category pages
on the live store, read on 22 September 2026 [S11].

Of the 26 sorters in [§6](#6-search), 18 use Lifestyle > Social Networking,
7 use Productivity > Tools and 1 uses Productivity > Workflow & Planning. All
three with 90,000 users or more are in Social Networking. People browsing for
a tool that works on Instagram and TikTok look there, and the extension does
nothing outside those two sites. Productivity > Tools is the reasonable second
choice if you would rather not sit in the same category page as the largest
listings. The docs describe the category as deciding where the item appears
in the store [S5]; they say nothing about search.

### Language

**English.** The manifest has no `default_locale`, so the listing language is
set here, and it is what lets people find the item when searching in their
language [S5]. The text uses British spelling; that does not call for a
separate English (UK) listing.

### Graphic assets

Requirements are from the image guidelines [S12] and the listing page [S5].

| Dashboard field | Required | Spec | File | Notes |
|---|---|---|---|---|
| Store icon | Yes | 128×128 PNG; artwork 96×96 with 16 px transparent padding each side; must work on light and dark backgrounds | `store/graphics/store-icon-128.png` if it is made, otherwise `src/icons/icon-128.png` | Check the padding: the toolbar icon is often drawn edge to edge, which the store icon should not be. Must not use the Instagram or TikTok logos (see [§6a](#6a-name-suffix)). |
| Screenshots | At least 1, at most 5 | 1280×800 (or 640×400), square corners, full bleed, no padding | `store/screenshots/01-sorted-grid.png` and the rest of that folder, in filename order | Use all five; the docs ask for "preferably the maximum allowed five" [S12]. Only real UI, per the listing requirement that nothing be misleading [S7]. |
| Small promo tile | Yes | 440×280 PNG or JPEG | `store/graphics/promo-small-440x280.png` | "Avoid text", and it must still read at half size [S12]. |
| Marquee promo tile | No | 1400×560 PNG or JPEG | `store/graphics/marquee-1400x560.png` | Optional [S5, S12]. Same rule on text as the small tile. |
| YouTube video | No | A YouTube link | none yet | Optional. A 30–60 s screen recording of a run would show the reload-and-scroll better than stills. |

The small and marquee tiles cannot be localised; screenshots and video can
[S5].

### URLs

| Field | Value | Notes |
|---|---|---|
| Official URL | leave empty for now | Offers only sites verified as yours in Google Search Console, and shows a verified mark when set [S5]. Once the landing page is live, verify `https://andreadorizza.github.io/open-feed-sorter/` in Search Console (HTML-tag method on that page) and pick it here. Whether the dashboard accepts a path-level GitHub Pages property could not be checked without the dashboard. |
| Homepage URL | `https://andreadorizza.github.io/open-feed-sorter/` once it is live; until then `https://github.com/andreadorizza/open-feed-sorter` | Matches `homepage_url` in the manifest. |
| Support URL | `https://github.com/andreadorizza/open-feed-sorter/issues` | The privacy policy already names issues as the contact route. |
| Mature content | Off | Nothing in the extension is mature. |

---

## 2. Privacy tab

Field list from [S13]; policy text from [S14, S15, S16, S17].

### Single purpose

Policy: "a single purpose that is narrow and easy to understand" [S13, S9].
Sorting and exporting are one purpose here: exporting the sorted list is the
output of the sort. 295 characters.

```text
Open Feed Sorter sorts the posts on an Instagram or TikTok profile by their counts (views, likes, comments, shares, saves, date, or an outlier score measured against the account's own recent median), shows the sorted grid in place of the site's own, and exports the result to CSV, Excel or JSON.
```

### Permission justification

After this launch prep the manifest has **no API permissions**, so there is
nothing to justify except host access. (If a `tabs` field still appears, the
upload is an old build: re-run `npm run package`.) Reviews take longer for
broad host patterns such as `<all_urls>` and for "sensitive execution
permissions" such as `tabs` [S18]; two named hosts and no API permissions is
the easy case.

**Host permission justification** (619 characters):

```text
The extension works only on Instagram and TikTok. Its content scripts run on these two sites to read the post counts in the feed responses the page already requests for its own grid, show the grid in sorted order, and generate exports in the tab. The popup uses the same access to read the active tab's address, so it can tell whether the tab is an Instagram or TikTok profile. Both sites move between pages without a full page load, so the scripts must be present across each site; they do nothing until the user starts a sort from the popup. No other site is accessed, and the extension requests no other permissions.
```

If the dashboard asks per host instead:

`https://www.instagram.com/*` (265 characters)

```text
Runs the content scripts on Instagram so the extension can read like, comment and view counts from the feed responses Instagram already loads for a profile's Posts and Reels tabs, and show the sorted grid with its toolbar. Lets the popup recognise an Instagram tab.
```

`https://www.tiktok.com/*` (245 characters)

```text
Runs the content scripts on TikTok so the extension can read view, like, comment, share and save counts from the feed responses TikTok already loads for a profile, and show the sorted grid with its toolbar. Lets the popup recognise a TikTok tab.
```

### Remote code

Select **"No, I am not using remote code."** Manifest V3 does not allow loading
and running remotely hosted code at all [S13], and violation Blue Argon covers
it [S9]. The dashboard only asks for a justification on "Yes"; if a text box
is shown anyway (246 characters):

```text
All code ships in the package. The extension loads no external scripts, uses no eval or new Function, and makes no network requests of its own. The only outside input is the JSON the two sites already fetch for their grids, which is read as data.
```

Checked on 22 September 2026: `src/` contains no `eval(`, `new Function` or
`importScripts`, and the only non-platform URLs in it are XML namespace names
in the `.xlsx` writer and the SVG namespace. The test instructions tell the
reviewer so.

### Data usage

**Recommendation: tick "Website content" and nothing else. Tick all three
certifications.**

The question is whether data that is processed only in the tab, and never
leaves it, has to be declared. The User Data FAQ answers it directly:

> Q3. Does an extension need to disclose user data handling if the data is
> only processed or stored locally on a user's device?
> "Yes. Extensions are required to disclose how they handle user data, even
> when data is processed or stored locally on a user's device and is not
> transmitted to external servers or third parties." [S14]

The same FAQ lists "Website content and resources" as user data (Q4), and
says that a product which stores information only locally still needs a
privacy policy (Q14) [S14]. The public listing uses the word "handles": an
extension that ticks a box is shown as "*Name* handles the following: Website
content — For example: text, images, sounds, videos, or hyperlinks" (seen on a
live listing's privacy page [S19]).
The listing requirements add that everything in the privacy fields must be
accurate, and that contradictions with the code may lead to removal [S7].

What Open Feed Sorter handles, from `PRIVACY.md` and the code:

| Category | Tick? | Why |
|---|---|---|
| Personally identifiable information | No | It reads nothing about the user. The usernames it reads belong to the authors of the posts on the page being sorted: page content, counted under "Website content". |
| Health information | No | None. |
| Financial and payment information | No | None. |
| Authentication information | No | It never reads passwords, cookies or tokens. The site's own requests carry the user's session; the extension does not touch them. |
| Personal communications | No | None. |
| Location | No | None. |
| Web history | No | The popup reads the active tab's address only when it is opened, only on the two sites, and keeps nothing. No list of visited pages is read or kept. |
| User activity | No | It records no clicks, keystrokes or scrolling. The network hook reads the site's feed responses, and only during a run the user started; it is removed when the run ends. What it reads there is page content, covered by the next row. |
| **Website content** | **Yes** | It reads captions, counts, dates, post IDs, author usernames and thumbnail addresses from the feed responses, copies the grid's tiles, and writes that content into exports. |

The three certifications are all true, since nothing is sold, transferred or
used for anything but the sort [S15, S20]:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

The wording of the three checkboxes was confirmed on public listing privacy
pages [S21, S19]; confirm it matches the dashboard.

**The alternative, ticking nothing**, would make the listing say "The
developer has disclosed that it will not collect or use your data". That is
what several well-known extensions that read page content locally declare,
among them Dark Reader, Refined GitHub and uBlock Origin Lite [S21]. It reads
better and it is arguably the common practice. It is not what the FAQ says,
and the FAQ is the document a reviewer would point to. Ticking "Website
content" costs one line on the privacy page and removes the only privacy-field
question a reviewer could raise. The privacy policy already says, in plain
terms, what is read and that none of it leaves the tab, so the two agree.

**Prominent disclosure.** The current policy asks extensions that handle user
data to disclose it prominently and get "affirmative and informed consent"
[S16]; the FAQ adds that consent means the user takes "a specific action
clearly agreeing to the disclosure before collecting or handling user data"
(Q10) [S14]. Here the handling is the feature itself, and it only starts when
the user presses "Sort this profile", under a hint that already says the tab
will reload and "scroll the feed to collect posts". That is very likely
enough; the three extensions above ship no consent screen at all. To make it
unarguable at almost no cost, the hint under the button could name what is
read and where it goes. That is a change to `src/popup/popup.html`, which this
file does not own, so it is listed as a decision in §6e.

**Limited Use.** The policy asks for an affirmative statement on a website
belonging to the extension that its use of data complies with the Limited Use
requirements [S15]. `PRIVACY.md` has one: "Open Feed Sorter's handling of data
complies with the Chrome Web Store User Data Policy, including its Limited Use
requirements."

### Privacy policy URL

```text
https://github.com/andreadorizza/open-feed-sorter/blob/main/PRIVACY.md
```

It must be reachable when the review starts (violation Purple Lithium is a
missing or inaccessible policy [S9]), so merge `PRIVACY.md` to `main` before
submitting. If the landing page later hosts the policy, keep this URL working.

---

## 3. Distribution tab

Fields from [S22]; deferred publishing from [S23].

| Field | Value |
|---|---|
| Payments | Free. No in-app purchases. (The Ko-fi link buys nothing, so it is not a payment feature.) |
| Visibility | **Public**, with deferred publishing (see below) |
| Regions | All regions |

**Public with deferred publishing, rather than unlisted first.** Reasoning:

- Unlisted items are installable by URL but have no listing in search [S22].
  Search is the channel this launch depends on; an unlisted week gains no
  installs from it.
- The package being reviewed is the one the release workflow builds and CI
  checks (`npm run package`, `test/package.test.js`). Installing it from an
  unlisted listing would test the same bytes again.
- Deferred publishing gives the one thing unlisted-first would: control over
  the moment it goes live. Untick "publish automatically" when submitting;
  after approval there are 30 days to press Publish before the submission
  reverts to a draft [S23]. That lets the listing go live the same day as the
  landing page and the launch posts.
- The listing URL is known before publishing. The item ID is in the dashboard
  from the first upload, and `https://chromewebstore.google.com/detail/<item-id>`
  redirects to the full URL (checked on a live item, 22 September 2026). Use
  that short form for `https://chromewebstore.google.com/detail/inbpbmepkjibdpakmmogmefkcgnfcbma`: it keeps working if the name, and so the
  slug, changes.

Unlisted first is the better choice only if you want a few people to use the
store build on real accounts before strangers can rate it. At v0.1 that is a
reasonable worry, but a private beta can equally run from the GitHub release
zip.

Regions: all. There is no reason to exclude any, and in the EU the only
difference is the trader notice (see §5).

---

## 4. Test instructions tab

Optional, and meant for items that need credentials or a paid account [S24].
Worth filling in here because the first run reloads the tab and scrolls it on
its own, which could read as a fault to a reviewer who has not been told, and
because Yellow Magnesium ("functionality not working as described") is the
likely rejection if a reviewer cannot get a run to start [S9].

The username and password fields: leave empty. A new Instagram account signing
in from a reviewer's location would usually be stopped by Instagram's
suspicious-login check, which sends a code only the owner receives, so a test
account would not help. TikTok works without signing in, and the instructions
say so.

Additional instructions (491/500 characters; the dashboard caps this field at 500):

```text
No extension account needed. Quickest check: open https://www.tiktok.com/@nasa (works logged out), click the extension icon, pick Most views and Latest 25, press Sort this profile. The tab reloads on purpose, then scrolls itself while it collects. A sorted grid with an outlier score (e.g. 2.1x) on each tile and a toolbar appear. Try re-sort, Export (CSV/Excel/JSON), Stop and Show original feed. Instagram profiles (Posts or Reels tab) work the same but need a signed-in Instagram account.
```

Before pasting, run it yourself on the exact zip being uploaded, as the policy
asks ("Test the exact files that you submit") [S9]. The Instagram login-wall
statement comes from third-party write-ups, not from Instagram [S25]; if
Instagram behaves differently on the day, adjust the last sentence.

---

## 5. Before you submit

Account (once):

- [ ] Register as a Chrome Web Store developer and pay the one-time
      registration fee [S26]. The docs do not print the amount; it has been
      US$5 since 2010 and third-party guides still give US$5 in 2026 [S27].
      The account email cannot be changed later, so pick it deliberately
      [S26].
- [ ] Turn on 2-Step Verification for that Google account. It is required
      before publishing or updating any item [S28].
- [ ] Set the publisher name (shown under the title) and add and verify a
      contact email; verification is mandatory for new accounts [S29]. Review
      and rejection mail goes to it.
- [ ] A physical address is only required for items that sell something
      [S29]. This one does not.
- [ ] Declare trader or non-trader status (EU Digital Services Act). It is
      your own legal call; Google says so and will not decide it for you
      [S30, S31]. A trader is someone "acting for purposes relating to his
      trade, business, craft or profession"; for traders the store verifies
      and shows a phone number and address as well as the email [S30, S32].
      For a non-trader, EU users are told that consumer-protection rights do
      not apply to contracts with you [S30]. A free MIT project with an
      optional tip jar that buys nothing reads as non-trader, but if the
      extension is part of your professional work, declare trader. The
      status can be changed later [S31].

This submission:

- [ ] `PRIVACY.md` is merged to `main` and the privacy-policy URL loads.
- [ ] `src/manifest.json` has no `permissions` key (or an empty one), the two
      host permissions, and `homepage_url`. `npm run verify` passes.
- [ ] The name and summary are final. They live in the manifest, so changing
      them later needs a new version and a new review.
- [ ] Build the zip with `npm run package` from a clean checkout of the
      release commit, and upload `release/open-feed-sorter-0.1.0.zip`.
- [ ] Load that same zip unpacked (after unzipping) and run the test
      instructions on both sites.
- [ ] Images: icon, five screenshots, small promo tile, marquee.
- [ ] Every text field pasted from this file; counts checked in the dashboard.
- [ ] Privacy tab: single purpose, host justification, remote code "No",
      "Website content" ticked, three certifications ticked, policy URL.
- [ ] Distribution: free, public, all regions.
- [ ] Untick automatic publishing, then submit. Review usually takes a few
      days and can take weeks; new developers and new items get closer review
      [S18]. Contact support if it passes three weeks [S18].
- [ ] After publishing: replace `https://chromewebstore.google.com/detail/inbpbmepkjibdpakmmogmefkcgnfcbma` everywhere (`README.md`,
      landing page, launch notes), and change the README's install section.

---

## 6. Search

### What is known about store search

Google does not publish how store search ranks items. What it does say:

- The title "should accurately reflect the extension's core function", be
  "brief and memorable", and not be stuffed with keywords [S4].
- The summary should highlight the main use cases, in 132 characters, without
  superlatives [S4].
- The description should be an overview paragraph and a short list of
  features, focused on "the keywords that represent the most important
  features" [S4].
- Keyword spam is a listing violation (Yellow Argon): lists of sites or brands
  without added value, and "unnatural repetition of the same keyword more than
  5 times" [S7, S9]. When listing supported sites or brands, list no more than
  five [S8].

Two articles by an extension-marketing vendor, not Google, report that the
title carries the most weight, that an exact keyword in the title beats the
same word in the description, and that search results show about the first 35
characters of a title [S33, S34]. Treat that as informed opinion. The
competitor titles below are consistent with it: almost all of them put
platform names and "sort" in the title.

### Competitors

The ten largest sorters by users, read from their listings on 22 September
2026. All 26, the seven small tools built on an outlier score, the summaries
word for word and the store's own search results are in
[`research/cws-competitors-2026-09-22.md`](research/cws-competitors-2026-09-22.md).

| Title on the store | Users | Rating (count) | Price model | Category | Keywords in title and summary |
|---|---|---|---|---|---|
| [Feed Sorter For TikTok™ & Instagram™](https://chromewebstore.google.com/detail/bmljpagafjlkebnopbdncpnifkknlobk) | 100,000 | 3.7 (140) | Freemium: Instagram needs premium; $5 a month to $43 a year (ovszon.com) | Lifestyle > Social Networking | feed, sorter, TikTok, Instagram, Reels, posts, likes, comments, views, date, viral, CSV |
| [TikTok Downloader, Sort & Analytics \| KOLSprite](https://chromewebstore.google.com/detail/penohjgblobinadflplocjekaclnoemh) | 100,000 | 4.5 (213) | Freemium: Plus $199.9/yr, Pro $499/yr (kolsprite.com) | Lifestyle > Social Networking | TikTok, downloader, sort, analytics, AI, export |
| [Sort Feed — Sort, Download & Transcribe. Works on Instagram, TikTok +2 more](https://chromewebstore.google.com/detail/lhiilgfanjkbombmnlfelondlfohfpfg) | 90,000 | 3.4 (297) | Freemium: free up to 25 posts or 7 days; Pro $9–14/mo (sortfeed.com) | Lifestyle > Social Networking | sort feed, download, transcribe, Instagram, TikTok, Reels, outliers, views, likes, Sheets |
| [Sort for TikTok Videos by Viewed or Likes](https://chromewebstore.google.com/detail/dpfmkbcoaddghkkhebjcjaoaiaefigln) | 20,000 | 2.8 (28) | Not shown | Productivity > Tools | sort, TikTok, videos, viewed, likes, comments |
| [UpDog - TikTok & Instagram Analytics](https://chromewebstore.google.com/detail/epcimkknpagnkogjlpkpdbefemggkagh) | 10,000 | 4.5 (31) | Free; enterprise custom (updog.marketing) | Lifestyle > Social Networking | TikTok, Instagram, analytics, engagement |
| [IShort - Instagram Downloader, Reel Transcript & Data Analytics](https://chromewebstore.google.com/detail/ljjhbiolkeopnaglmnepmlboldpohohl) | 8,000 | 4.9 (13) | Freemium: $10 or $30/mo (ishort.pro) | Lifestyle > Social Networking | Instagram, downloader, Reels, transcript, analytics, free, AI |
| [Sort Feed - TikTok & Instagram Sorter](https://chromewebstore.google.com/detail/gabccihfalldbkbafogodoelhknbodbo) | 5,000 | 4.8 (46) | Freemium: free latest 25; Pro $12/mo (sortfeed.io) | Productivity > Tools | sort feed, sorter, TikTok, Instagram, Reels, posts, likes, views, comments, date, viral, CSV |
| [Sort Posts](https://chromewebstore.google.com/detail/epdghlkfggehpkolnnfnjnapdekaaggp) | 4,000 | 3.5 (2) | Not shown | Lifestyle > Social Networking | sort, posts, Instagram, likes, comments |
| [Zetrr - Sort Instagram viral content \[100% Free\]](https://chromewebstore.google.com/detail/heigefdmoanlgaedfpapghbaopohnhfg) | 3,000 | 4.8 (27) | Free (listing) | Lifestyle > Social Networking | sort, Instagram, viral, free, engagement, download |
| [IG Sorter - Sort Feed - works on Instagram™ US](https://chromewebstore.google.com/detail/faglepdniaalgbkakcbhioblejlfoihn) | 3,000 | 5.0 (21) | Freemium, price not shown (listing) | Productivity > Tools | IG, sorter, sort feed, Instagram, Reels, Excel, download |

Links use the short `/detail/<id>` form, which redirects to the full listing.
Prices marked with a domain were read on the developer's site; the rest are
from the listing.

What stands out:

- **Category**: 18 of 26 in Lifestyle > Social Networking, 7 in Productivity >
  Tools, 1 in Workflow & Planning.
- **Price**: of the ten above, six are freemium or paid, two free, two do not
  say. Typical Pro plans cost $9–15 a month.
- **Common summary words** across all 26: sort (22), Instagram (21), Reels
  (18), views (14), posts (14), likes (13), comments (12), TikTok (11), export
  (10), download (9), CSV (6), viral (6).
- **Free, local and no account** are already claimed, mostly by small
  listings: Insta sorter, IG Sort, ReelSorter, MediaSort, Zetrr, SocialMiner.
- **An outlier score against the account's own numbers** is also offered by
  Sortflare, OutViral and Moteru (all under 25 users), and Sort Feed sorts
  "by outliers".
- **Open source**: none of the 33 listings checked mentions open source,
  GitHub or an MIT licence. It is the one claim in this listing that no
  competitor makes.
- **Names**: "Sort Feed" is a brand for at least four unrelated publishers.
  "Feed Sorter" is the head term of the largest listing. No listing is called
  "Open Feed Sorter" or "Sort Feed for Free".

### 6a. Name suffix

The rules that bear on it:

- **Chrome Web Store.** The title should reflect the core function and not be
  stuffed with keywords [S4]. Do not "represent that your product is
  authorized by, endorsed by, or produced by another company" [S17]; the
  matching violation is Red Silicon, impersonation [S9]. The limit is 75
  characters [S1].
- **Meta (Instagram).** "If you offer an app … that uses the Instagram APIs
  or is otherwise compatible with or related to Instagram, you may only use
  Instagram to say that your app is 'for Instagram' … in a descriptive
  manner." Also: do not combine "Insta" or "gram" with your own brand, do not
  abbreviate the word, and do not use or register a Meta trademark as part of
  a trade name [S35].
- **TikTok.** The developer design guidelines forbid TikTok logos, icons and
  symbols without written permission, and point to TikTok's Brand and Use
  Guidelines [S36]. That brand site is script-only and could not be read, so
  no permitted form like Meta's "for Instagram" was found. TikTok's developer
  terms forbid implying "any inaccurate affiliation, sponsorship, or
  endorsement" [S37]. Those terms bind apps using TikTok's API, which this
  extension does not, but the principle is the same. Using "for TikTok"
  alongside "for Instagram" is the conservative reading.
- **What competitors do.** "For TikTok™ & Instagram™" (the largest), "Works on
  Instagram, TikTok +2 more", "IG" or "Insta" in the name (at least four listings),
  names that start with "Instagram" or "TikTok" (three), and verb phrases such
  as "Sort Instagram Reels" (five or more). Several of these are forms Meta's
  guidelines rule out. That they are on the store says nothing about whether
  Meta will object to them.

The options:

| | Name | Length | For | Against |
|---|---|---|---|---|
| A | `Open Feed Sorter` | 16/75 | No brand names in the title at all, so nothing to argue about. | Neither platform, nor "sort", nor "Reels" in the title. Queries like "sort instagram" or "tiktok sorter" rest on the summary and description, which third-party analyses rate as weaker [S33, S34]. |
| **B ★** | `Open Feed Sorter for Instagram and TikTok` | 41/75 | Both platform names in the title, in the one form Meta explicitly permits. Reads as a plain description of where it works. | Close in shape to the largest listing, "Feed Sorter For TikTok™ & Instagram™". "Open" at the front, a different icon and a different publisher keep them apart, and "feed sorter" is a plain description used by other listings too. About 35 characters show in results, so "TikTok" may be cut off there [S33]. |
| C | `Open Feed Sorter: sort Instagram and TikTok by views` | 52/75 | Adds "sort" and "views" to the title. | Uses "Instagram" outside the "for Instagram" form Meta allows, and reads as keywords appended to a name. |

**Recommendation: B, `Open Feed Sorter for Instagram and TikTok`.** It puts
both platform names in the title, in the form Meta's guidelines
allow, without claiming any link to either company. Write "and" rather than
"&", and leave out ™: the guidelines fetched ask for neither, and the
description already carries the "not affiliated" line.

What changes if B is adopted: only the manifest `name`. The popup heading, the
welcome page and `short_name` ("Feed Sorter") stay as they are; nothing in
`scripts/` or `test/` reads the name. The listing's URL slug is taken from the
name, which is another reason to use the short `/detail/<id>` form for
`https://chromewebstore.google.com/detail/inbpbmepkjibdpakmmogmefkcgnfcbma`.

### 6b. Summary

Current, 127/132:

```text
Free and open source: sort any Instagram or TikTok profile by views, likes, comments or outlier score, then export. No account.
```

It is good. It leads with the one claim no competitor makes, it says "free"
(only three of the 26 competitor summaries do), it names both platforms, the
three metrics competitor summaries use most and the outlier score, and it has
no superlatives. Two gaps against those 26 summaries: "Reels" appears in 18
of them and not here, and "then export" does not say what to; "CSV" appears
in six.

**Recommended, 128/132:**

```text
Free and open source: sort Instagram Reels and posts or TikTok videos by views, likes, comments or outlier score. Export to CSV.
```

It adds "Reels" and "CSV" and drops "No account" and "profile". "No account"
is still in the second line of the description and in the privacy section.
If you would rather keep "No account" in the summary, this also fits
(129/132), without "Reels":

```text
Free and open source: sort any Instagram or TikTok profile by views, likes, comments or outlier score. Export to CSV. No account.
```

### 6c. First two lines of the description

They open the listing's overview, so they repeat the search terms as a plain
sentence and then give the reasons to pick this one:

```text
Sort any Instagram or TikTok profile by views, likes, comments or outlier score, and see every count on every tile.
Free and open source. No account, no server and no paywall: it works inside the tab and sends nothing anywhere.
```

115 and 111 characters. If the summary keeps "profile" instead of "Reels",
consider putting Reels in the first line instead (131 characters):

```text
Sort the posts and Reels of any Instagram profile, or the videos of any TikTok profile, by views, likes, comments or outlier score.
```

### 6d. Manifest diff

Applied on 22 September 2026.

```diff
--- a/src/manifest.json
+++ b/src/manifest.json
@@
   "manifest_version": 3,
-  "name": "Open Feed Sorter",
+  "name": "Open Feed Sorter for Instagram and TikTok",
   "short_name": "Feed Sorter",
   "version": "0.1.0",
-  "description": "Free and open source: sort any Instagram or TikTok profile by views, likes, comments or outlier score, then export. No account.",
+  "description": "Free and open source: sort Instagram Reels and posts or TikTok videos by views, likes, comments or outlier score. Export to CSV.",
   "homepage_url": "https://github.com/andreadorizza/open-feed-sorter",
```

Chrome also shows both in the install prompt and on `chrome://extensions`, so
check they read well there too. They must be final before the upload:
changing either later means a new version and a new review.

### 6e. Decisions

Made on 22 September 2026:

- **Name**: B, `Open Feed Sorter for Instagram and TikTok`.
- **Summary**: the recommended one, with "Reels" and "CSV".
- **Data usage**: tick "Website content" only, plus the three certifications.
- **Reviewer login**: none; the credential fields stay empty (see §4).
- **Instagram's own sort**: the README now says the app offers a "most viewed"
  order on the Reels tab, and what this adds.

Still open:

1. **Popup disclosure line** (optional, `src/popup/popup.html`). The hint under
   the button reads "Reloads the tab, then scrolls the feed to collect posts.
   You can stop at any time." Adding one sentence would make pressing the
   button an explicit agreement to what is read, which is what the FAQ's
   consent wording asks for [S14]:

   ```text
   Reloads the tab, then scrolls the feed to collect posts. The counts are read from this page and never leave your browser. You can stop at any time.
   ```

2. **Visibility**: public with deferred publishing ★, or unlisted first (§3).
3. **Category**: Social Networking ★ or Tools (§1).
4. **Trader status**: yours to declare (§5).

---

## 7. Sources

All fetched on 22 September 2026. "Updated" is the date printed on the page.

Google's own documentation and policies:

| # | Source | Updated |
|---|---|---|
| S1 | [PSA: Updates to extension name length requirements](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/mpDvFpT0KJM), Patrick Kettner, chromium-extensions group | posted 22 Feb 2024 |
| S2 | [Manifest: name](https://developer.chrome.com/docs/extensions/reference/manifest/name) | 2013-05-12 |
| S3 | [Manifest: description](https://developer.chrome.com/docs/extensions/reference/manifest/description) | 2013-05-12 |
| S4 | [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing) | 2024-08-02 |
| S5 | [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) | not printed |
| S6 | [Formatting in the web store description field](https://groups.google.com/a/chromium.org/g/chromium-apps/c/8afvZlwAYAo), chromium-apps group | posted Nov 2012 (old, but the field is still plain text) |
| S7 | [Program policies: Listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements) | 2024-07-10 |
| S8 | [Program policies: Spam FAQ](https://developer.chrome.com/docs/webstore/program-policies/spam-faq) | 2020-05-01 |
| S9 | [Troubleshooting Chrome Web Store violations](https://developer.chrome.com/docs/webstore/troubleshooting) | 2026-07-20 |
| S10 | [Announcement: Chrome Web Store categories are changing](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/YS-HD7Ta3EQ), chromium-extensions group | posted 24 Aug 2023 |
| S11 | The store's category pages, e.g. [Social Networking](https://chromewebstore.google.com/category/extensions/lifestyle/social) (all 18 read) | read 22 Sep 2026 |
| S12 | [Supplying images](https://developer.chrome.com/docs/webstore/images) | 2018-06-11 |
| S13 | [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) | not printed |
| S14 | [Updated Privacy Policy & Secure Handling Requirements (User Data FAQ)](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), questions 3, 4, 7, 10, 12 and 14 | footer reads 2016-04-23, which predates some of its content |
| S15 | [Program policies: Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use) | 2022-11-01 |
| S16 | [Program policies: Disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements) | 2022-11-01 |
| S17 | [Program policies: Impersonation and intellectual property](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property) | 2022-11-01 |
| S18 | [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process) | 2021-12-10 |
| S22 | [Distribute your extension](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution) | not printed |
| S23 | [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish) (deferred publishing, 30-day window) | not printed |
| S24 | [Provide test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions) | 2025-05-16 |
| S26 | [Register your developer account](https://developer.chrome.com/docs/webstore/register) | 2024-02-13 |
| S28 | [Program policies: 2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification) | 2022-11-01 |
| S29 | [Set up your developer account](https://developer.chrome.com/docs/webstore/set-up-account) | 2023-10-16 |
| S30 | [Trader/Non-Trader developer identification and verification](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure) | 2024-02-09 |
| S31 | [Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq) | not printed |
| S32 | [PSA: Updates to trader requirements in the Chrome Web Store](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/ZI9R_KAA3BQ), Oliver Dunk, chromium-extensions group | posted 15 Feb 2024 |

Live store pages, read 22 September 2026:

| # | Source |
|---|---|
| S19 | [TextUs Chrome Extension, privacy practices](https://chromewebstore.google.com/detail/textus-chrome-extension/hjnjkiddcmpamechmdjonecfjckboean/privacy): how a ticked "Website content" box is shown |
| S21 | Privacy practices of [Dark Reader](https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh/privacy), [Refined GitHub](https://chromewebstore.google.com/detail/refined-github/hlepfoohegkhhmjieoechaddaejaokhf/privacy) and [uBlock Origin Lite](https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh/privacy): all declare no data, and all show the same three certifications |
| — | Competitor listings: see [`research/cws-competitors-2026-09-22.md`](research/cws-competitors-2026-09-22.md) |

Platform brand rules:

| # | Source | Updated |
|---|---|---|
| S35 | [Instagram brand assets and guidelines](https://www.meta.com/brand/resources/instagram/instagram-brand/), Meta | not printed (© 2026) |
| S36 | [Design guidelines](https://developers.tiktok.com/docs/en/getting-started-design-guidelines), TikTok for Developers; links to the Brand and Use Guidelines at tiktokbrandhub.com, which could not be read without a browser | 2026-08-04 |
| S37 | [TikTok Developer Terms of Service](https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en) | 2025-12-26 |

News:

| # | Source | Date |
|---|---|---|
| S38 | [Instagram sort by views stuck](https://piunikaweb.com/2025/11/24/instagram-sort-by-views-stuck/), Dwayne Cubbins, PiunikaWeb: the in-app "Most viewed / Latest" Reels sort, rolling out gradually | 24 Nov 2025 |

Third party, used only where Google is silent:

| # | Source | Date |
|---|---|---|
| S20 | [Chrome Web Store requiring developers to disclose what data extensions collect](https://9to5google.com/2020/11/18/chrome-web-store-disclosure/), Abner Li, 9to5Google: the data categories and three certifications | 18 Nov 2020 |
| S25 | [Instagram web viewer: browse without an account](https://www.outfame.com/blog/instagram-web-viewer-browse-without-account-guide), Outfame: guests get a login prompt after "3 to 10 posts" | 12 Jan 2026 |
| S27 | [Publishing Chrome extensions: what it takes, what it costs](https://pearpages.com/blog/2026/07/19/publishing-chrome-extensions-what-it-takes-what-it-costs), Pere Pages: the fee is a one-time US$5 | 19 Jul 2026 |
| S33 | [Chrome Web Store SEO: ranking guide](https://www.extensionfast.com/blog/chrome-web-store-seo-complete-ranking-guide-for-2025), Michael McGarvey, ExtensionFast: title weight, 35-character truncation | 17 Nov 2025 |
| S34 | [How the Chrome Web Store ranking algorithm works](https://www.extensionfast.com/blog/chrome-web-store-ranking-algorithm-how-extensions-get-ranked-in-2025), Michael McGarvey, ExtensionFast | 12 Jun 2026 |
