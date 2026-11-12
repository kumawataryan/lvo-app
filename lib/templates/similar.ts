import type { PublishedTemplate } from "@/lib/templates/types";

// Scores how closely each candidate matches the source template, so the most similar ones show first.
// Weights: shared tags (strongest), shared supplies, overlapping age range, same difficulty.
const TAG_WEIGHT = 3;
const SUPPLY_WEIGHT = 2;
const AGE_WEIGHT = 2;
const DIFFICULTY_WEIGHT = 1;

function agesOverlap(a: PublishedTemplate, b: PublishedTemplate) {
  if (a.minimumAge == null && a.maximumAge == null) return false;
  if (b.minimumAge == null && b.maximumAge == null) return false;
  const aMin = a.minimumAge ?? 0;
  const aMax = a.maximumAge ?? 99;
  const bMin = b.minimumAge ?? 0;
  const bMax = b.maximumAge ?? 99;
  return aMin <= bMax && bMin <= aMax;
}

export function rankSimilarTemplates(source: PublishedTemplate, candidates: PublishedTemplate[]) {
  const sourceTags = new Set(source.tags.map((tag) => tag.toLowerCase()));
  const sourceSupplies = new Set(source.supplies.map((supply) => supply.name.toLowerCase()));

  const scoreOf = (candidate: PublishedTemplate) => {
    let score = 0;
    for (const tag of candidate.tags) if (sourceTags.has(tag.toLowerCase())) score += TAG_WEIGHT;
    for (const supply of candidate.supplies) if (sourceSupplies.has(supply.name.toLowerCase())) score += SUPPLY_WEIGHT;
    if (agesOverlap(source, candidate)) score += AGE_WEIGHT;
    if (candidate.difficulty === source.difficulty) score += DIFFICULTY_WEIGHT;
    return score;
  };

  // Ties keep the original category order, so the rest of the list stays predictable.
  return candidates
    .map((item, index) => ({ item, index, score: scoreOf(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_SIMILAR_TEMPLATES = 12;

// Unique template IDs chosen by the author, without the template itself.
export function parseSimilarTemplateIds(input: unknown, ownId?: string): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.filter((item): item is string => typeof item === "string" && UUID_PATTERN.test(item) && item !== ownId);
  return [...new Set(ids)].slice(0, MAX_SIMILAR_TEMPLATES);
}

export type SimilarTemplateOption = { id: string; title: string; imageUrl: string | null };
