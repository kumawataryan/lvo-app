export const TEMPLATE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TEMPLATE_SLUG_MAX_LENGTH = 90;

/** Turns any text into a URL-safe slug (lowercase, hyphen-separated, no leading/trailing hyphens). */
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TEMPLATE_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** The base slug if it is free, otherwise base-2, base-3, … (trimming the base so the suffix still fits). */
export function nextAvailableSlug(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  for (let counter = 2; ; counter += 1) {
    const suffix = `-${counter}`;
    const candidate = `${base.slice(0, TEMPLATE_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
