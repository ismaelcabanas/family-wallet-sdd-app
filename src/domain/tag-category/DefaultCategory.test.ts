import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORY_SLUG, isDefaultCategorySlug } from "./DefaultCategory";

describe("DefaultCategory", () => {
  it("el slug de la categoría genérica es exactamente «general»", () => {
    expect(DEFAULT_CATEGORY_SLUG).toBe("general");
  });

  it("isDefaultCategorySlug solo es verdadero para el slug constante", () => {
    expect(isDefaultCategorySlug("general")).toBe(true);
    expect(isDefaultCategorySlug("General")).toBe(false);
    expect(isDefaultCategorySlug("hogar")).toBe(false);
    expect(isDefaultCategorySlug("")).toBe(false);
  });
});
