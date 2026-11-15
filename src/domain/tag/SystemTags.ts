export const CONTRIBUTION_TAG_SLUG = "aportacion-comun";
export const SAVINGS_TAG_SLUG = "ahorro";

export const SYSTEM_TAG_SLUGS = [CONTRIBUTION_TAG_SLUG, SAVINGS_TAG_SLUG] as const;

export function isProtectedTagSlug(slug: string): boolean {
  return (SYSTEM_TAG_SLUGS as readonly string[]).includes(slug);
}
