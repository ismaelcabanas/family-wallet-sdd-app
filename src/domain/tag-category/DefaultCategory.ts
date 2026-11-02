export const DEFAULT_CATEGORY_SLUG = "general";

export function isDefaultCategorySlug(slug: string): boolean {
  return slug === DEFAULT_CATEGORY_SLUG;
}
