export const MAX_TEMPLATE_SPECS = 12;
export const SPEC_LABEL_MAX = 60;
export const SPEC_VALUE_MAX = 200;

export type TemplateSpecInput = { label: string; value: string };

// Accepts the raw request value and returns clean, non-empty label/value pairs.
export function parseTemplateSpecs(input: unknown): TemplateSpecInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const { label, value } = item as { label?: unknown; value?: unknown };
      if (typeof label !== "string" || typeof value !== "string") return [];
      return [{ label: label.trim().slice(0, SPEC_LABEL_MAX), value: value.trim().slice(0, SPEC_VALUE_MAX) }];
    })
    .filter((spec) => spec.label && spec.value)
    .slice(0, MAX_TEMPLATE_SPECS);
}
