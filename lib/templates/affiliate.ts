export const MAX_TEMPLATE_AFFILIATE_PRODUCTS = 12;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Returns unique, valid product IDs in the order they were given.
export function parseAffiliateProductIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.filter((item): item is string => typeof item === "string" && UUID_PATTERN.test(item));
  return [...new Set(ids)].slice(0, MAX_TEMPLATE_AFFILIATE_PRODUCTS);
}

export type AffiliateProductOption = { id: string; name: string; shortName: string; imageUrl: string | null };
