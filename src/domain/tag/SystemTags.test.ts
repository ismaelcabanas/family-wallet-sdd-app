import { CONTRIBUTION_TAG_SLUG, SYSTEM_TAG_SLUGS, isProtectedTagSlug } from "./SystemTags";
import { describe, expect, it } from "vitest";

describe("isProtectedTagSlug", () => {
  it("protege el slug de la etiqueta de aportación común", () => {
    expect(isProtectedTagSlug("aportacion-comun")).toBe(true);
  });

  it.each(["luz", "sin-clasificar", ""])("no protege el slug %j", (slug) => {
    expect(isProtectedTagSlug(slug)).toBe(false);
  });
});

describe("SYSTEM_TAG_SLUGS", () => {
  it("contiene el slug de aportación común con CONTRIBUTION_TAG_SLUG", () => {
    expect(CONTRIBUTION_TAG_SLUG).toBe("aportacion-comun");
    expect(SYSTEM_TAG_SLUGS).toContain(CONTRIBUTION_TAG_SLUG);
  });
});
