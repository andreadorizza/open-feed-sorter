/**
 * The maintainer's own video covers, which the demo profile's posts show.
 *
 * Each file in `covers/` is a cover from the maintainer's short-form videos
 * (Instagram, TikTok), cropped to its centre 3:4, the part a profile grid
 * shows, and saved at 360×480. The caption is the video's title. Only the
 * pictures are real: every count the screenshots show is invented in
 * fixture.js.
 *
 * Order matters. When a post needs a cover, it gets the first one that no
 * post on the same screen already uses, so the covers near the top of the
 * list are the ones most likely to be seen.
 */

export const COVERS = [
  { slug: "open-feed-sorter-2", caption: "Ruba i video virali della tua nicchia" },
  { slug: "siti-scroll", caption: "Siti a scorrimento con l'AI" },
  { slug: "sicurezza-per-tutti", caption: "Ti hanno hackerato? Cosa fare subito" },
  { slug: "nvidia-api", caption: "API gratis: le offre Nvidia" },
  { slug: "dashboard-finanze", caption: "Basta Excel: la dashboard delle finanze con l'AI" },
  { slug: "ai-websites", caption: "Siti da migliaia di euro, fatti con l'AI" },
  { slug: "humanizer", caption: "Come umanizzare il testo scritto dall'AI" },
  { slug: "vibe-coding-sicuro", caption: "Vibe coding sicuro" },
  { slug: "freellmapi", caption: "Smetti di pagare le chiavi API" },
  { slug: "professional-pics", caption: "Foto pro senza fotografo" },
  { slug: "professional-pics-broll", caption: "6 prompt per foto LinkedIn e CV" },
  { slug: "siti-animati", caption: "Siti animati in 10 minuti" },
  { slug: "ai-cybersecurity", caption: "Vibe coding sicuro: 2 tool gratis" },
  { slug: "open-feed-sorter", caption: "Trova i video virali degli altri creator" },
  { slug: "agent-reach", caption: "La tua AI ora può usare i social" },
  { slug: "learn-from-youtube", caption: "Rendi il tuo agente esperto in tutto" },
  { slug: "paper2agent", caption: "Ogni paper diventa un agente AI" },
  { slug: "ai-job-search", caption: "L'AI che cerca lavoro per te" },
  { slug: "handy", caption: "Digita alla velocità della voce" },
  { slug: "confronto-modelli", caption: "Quale AI usare? Tre siti per sceglierla" },
  { slug: "claude-science", caption: "Claude Science: l'analisi dei dati per chi fa ricerca" },
];

/** Where the harness server serves a cover. */
export function coverUrl(slug) {
  return `/store/harness/covers/${slug}.jpg`;
}

export const AVATAR_URL = "/store/harness/covers/avatar.jpg";
