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
