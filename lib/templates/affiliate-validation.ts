export type AffiliateProductInput = {
  name: string;
  shortName: string;
  imagePath: string;
  affiliateUrl: string;
  sortOrder: number;
  isActive: boolean;
};

// Validates a request body for creating or updating an affiliate product. Returns an error message or the cleaned input.
export function parseAffiliateProductInput(body: unknown, userId: string): { error: string } | { value: AffiliateProductInput } {
  const data = (body ?? {}) as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const shortName = typeof data.shortName === "string" ? data.shortName.trim() : "";
  const imagePath = typeof data.imagePath === "string" ? data.imagePath.trim() : "";
  const affiliateUrl = typeof data.affiliateUrl === "string" ? data.affiliateUrl.trim() : "";
  const sortOrder = Number(data.sortOrder ?? 0);

  if (!name || name.length > 120) return { error: "Enter a product name under 120 characters." };
  if (!shortName || shortName.length > 30) return { error: "Enter a short name under 30 characters." };
  // Uploaded images live under the admin's own folder in the media bucket; seeded ones are static files in /public/affiliate.
  if (!imagePath.startsWith(`${userId}/`) && !imagePath.startsWith("/affiliate/")) return { error: "Upload an image for this product." };
  if (!/^https:\/\//i.test(affiliateUrl) || affiliateUrl.length > 2000) return { error: "Enter a full https:// affiliate link." };
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) return { error: "Enter a valid display order." };

  return {
    value: {
      name,
      shortName,
      imagePath,
      affiliateUrl,
      sortOrder,
      isActive: data.isActive !== false,
    },
  };
}
