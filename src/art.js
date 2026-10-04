export const PALETTES = {
  clay: { bg: "#f6efe6", fg: "#2a211c", accent: "#e25b2a", mute: "#e7d3c4" },
  tide: { bg: "#e7f3ef", fg: "#102422", accent: "#1f8f7a", mute: "#c5e4dc" },
  ink: { bg: "#f4efe6", fg: "#161616", accent: "#e44545", mute: "#e6dccf" },
  moss: { bg: "#f3f6ea", fg: "#1c2416", accent: "#6a8f3a", mute: "#d5e0c2" },
  dusk: { bg: "#f8eef3", fg: "#241624", accent: "#c45b86", mute: "#f0d5e3" },
  citrus: { bg: "#fff6ea", fg: "#241c12", accent: "#ff8a3d", mute: "#f6d7b4" },
};

export const MOTIFS = ["orbit", "grid", "wave", "stack", "slash", "ring"];

function hash(str) {
  let h = 2166136261;
  for (const char of String(str)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawMotif(motif, pal, rand) {
  const cx = 820 + Math.round((rand() - 0.5) * 40);
  const cy = 250 + Math.round((rand() - 0.5) * 30);
  if (motif === "grid") {
    return `
      <rect x="620" y="0" width="580" height="675" fill="${pal.mute}"/>
      <rect x="760" y="0" width="150" height="675" fill="${pal.accent}"/>
      <rect x="980" y="80" width="220" height="220" fill="${pal.fg}"/>`;
  }
  if (motif === "wave") {
    return `
      <path d="M0 430 C 220 300, 420 520, 680 390 C 920 270, 1040 480, 1200 360 L 1200 675 L 0 675 Z" fill="${pal.mute}"/>
      <path d="M0 520 C 260 420, 480 600, 760 500 C 980 420, 1080 560, 1200 500 L 1200 675 L 0 675 Z" fill="${pal.accent}"/>`;
  }
  if (motif === "stack") {
    return `
      <rect x="560" y="90" width="520" height="150" fill="${pal.mute}"/>
      <rect x="640" y="270" width="480" height="150" fill="${pal.accent}"/>
      <rect x="500" y="450" width="560" height="150" fill="${pal.fg}"/>`;
  }
  if (motif === "slash") {
    return `<polygon points="520,0 1200,0 1200,675 760,675" fill="${pal.accent}"/>`;
  }
  if (motif === "ring") {
    const r = 230 + Math.round(rand() * 20);
    return `
      <circle cx="${cx + 80}" cy="${cy}" r="${r}" fill="${pal.accent}"/>
      <circle cx="${cx + 80}" cy="${cy}" r="${r - 70}" fill="${pal.bg}"/>
      <circle cx="${cx - 40}" cy="${cy + 40}" r="46" fill="${pal.fg}"/>`;
  }
  const r = 210 + Math.round(rand() * 24);
  return `
    <circle cx="${cx + 70}" cy="${cy - 10}" r="${r}" fill="${pal.accent}"/>
    <circle cx="${cx - 30}" cy="${cy + 80}" r="${Math.round(r * 0.42)}" fill="${pal.fg}"/>`;
}

function plate(pal, shapes) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <rect width="1200" height="675" fill="${pal.bg}"/>
  ${shapes}
</svg>`;
}

export function renderCover({ palette, motif, seed }) {
  const pal = PALETTES[palette] || PALETTES.ink;
  const shape = MOTIFS.includes(motif) ? motif : "orbit";
  const rand = rng(hash(seed || "spoonspring"));
  return plate(pal, drawMotif(shape, pal, rand));
}

export function renderHomeBanner() {
  const pal = PALETTES.ink;
  return plate(pal, `
    <circle cx="860" cy="250" r="230" fill="${pal.accent}"/>
    <path d="M0 470 C 180 390, 340 560, 560 470 C 760 390, 900 530, 1200 430 L 1200 675 L 0 675 Z" fill="${pal.fg}"/>
    <circle cx="250" cy="180" r="54" fill="${pal.fg}"/>
  `);
}
