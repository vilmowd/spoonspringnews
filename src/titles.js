export const TITLES = [
  {
    slug: "magazine",
    name: "Spoonspring",
    path: "/",
    line: "The flagship magazine.",
  },
  {
    slug: "wire",
    name: "Wire",
    path: "/title/wire",
    line: "The news of the day.",
  },
  {
    slug: "ledger",
    name: "Ledger",
    path: "/title/ledger",
    line: "Money, work, and markets.",
  },
  {
    slug: "laboratory",
    name: "Laboratory",
    path: "/title/laboratory",
    line: "Science and health.",
  },
  {
    slug: "signal",
    name: "Signal",
    path: "/title/signal",
    line: "Technology.",
  },
  {
    slug: "stage",
    name: "Stage",
    path: "/title/stage",
    line: "Culture.",
  },
];

export function titleBySlug(slug) {
  return TITLES.find((title) => title.slug === slug) || null;
}
