export const SECTIONS = [
  { slug: "technology", label: "Technology" },
  { slug: "science", label: "Science" },
  { slug: "business", label: "Business" },
  { slug: "health", label: "Health" },
  { slug: "culture", label: "Culture" },
  { slug: "world", label: "World" },
];

export const TOPIC_TAGS = {
  technology: ["technology", "tech", "software", "ai", "gadgets", "computing", "internet"],
  science: ["science", "space", "physics", "climate", "environment", "nature"],
  business: ["business", "markets", "economy", "finance", "work", "jobs"],
  health: ["health", "medicine", "food", "disease"],
  culture: ["culture", "film", "music", "books", "art"],
  world: ["world", "politics", "policy", "war", "election"],
};

export function tagsForSection(tags, section) {
  const own = new Set(TOPIC_TAGS[section.slug] || []);
  const foreign = new Set(
    Object.entries(TOPIC_TAGS)
      .filter(([slug]) => slug !== section.slug)
      .flatMap(([, list]) => list),
  );
  const kept = (tags || [])
    .map((tag) => String(tag).toLowerCase())
    .filter((tag) => tag && tag !== section.slug && (own.has(tag) || !foreign.has(tag)));
  return [section.slug, ...kept].slice(0, 6);
}
