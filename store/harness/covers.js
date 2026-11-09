/**
 * The maintainer's own video covers, which the demo profile's posts show.
 *
 * Each file in `covers/` is a cover from the maintainer's short-form videos
 * (Instagram, TikTok), cropped to its centre 3:4, the part a profile grid
 * shows, and saved at 360×480. The caption is the video's title. Only the
 * pictures are real: every count the screenshots show is invented in
 * fixture.js.
 *
 * Order matters: newest video first, because the newest covers are the ones
 * the screenshots should show. When a post on a screen needs a cover, it gets
 * the first one no post on that screen already uses, and the posts nearest
 * the top of a screen choose first. Claude Science is last, whatever its
 * date: its title is not one for a store listing.
 */

export const COVERS = [
  { slug: "dashboard-finanze", caption: "Basta Excel: la dashboard delle finanze con l'AI" },
  { slug: "open-feed-sorter-2", caption: "Ruba i video virali della tua nicchia" },
  { slug: "siti-scroll", caption: "Siti a scorrimento con l'AI" },
  { slug: "vibe-coding-sicuro", caption: "Vibe coding sicuro" },
  { slug: "nvidia-api", caption: "API gratis: le offre Nvidia" },
  { slug: "sicurezza-per-tutti", caption: "Ti hanno hackerato? Cosa fare subito" },
  { slug: "professional-pics", caption: "Foto pro senza fotografo" },
  { slug: "siti-animati", caption: "Siti animati in 10 minuti" },
  { slug: "professional-pics-broll", caption: "6 prompt per foto LinkedIn e CV" },
  { slug: "ai-cybersecurity", caption: "Vibe coding sicuro: 2 tool gratis" },
  { slug: "ai-websites", caption: "Siti da migliaia di euro, fatti con l'AI" },
  { slug: "learn-from-youtube", caption: "Rendi il tuo agente esperto in tutto" },
  { slug: "open-feed-sorter", caption: "Trova i video virali degli altri creator" },
  { slug: "agent-reach", caption: "La tua AI ora può usare i social" },
  { slug: "freellmapi", caption: "Smetti di pagare le chiavi API" },
  { slug: "paper2agent", caption: "Ogni paper diventa un agente AI" },
  { slug: "ai-job-search", caption: "L'AI che cerca lavoro per te" },
  { slug: "handy", caption: "Digita alla velocità della voce" },
  { slug: "confronto-modelli", caption: "Quale AI usare? Tre siti per sceglierla" },
  { slug: "humanizer", caption: "Come umanizzare il testo scritto dall'AI" },
  { slug: "claude-science", caption: "Claude Science: l'analisi dei dati per chi fa ricerca" },
];

/** Where the harness server serves a cover. */
export function coverUrl(slug) {
  return `/store/harness/covers/${slug}.jpg`;
}

export const AVATAR_URL = "/store/harness/covers/avatar.jpg";
