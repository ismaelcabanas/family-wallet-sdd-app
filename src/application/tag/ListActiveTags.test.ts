import { Tag } from "@/domain/tag/Tag";
import { describe, expect, it, vi } from "vitest";

import { ListActiveTags } from "./ListActiveTags";

describe("ListActiveTags", () => {
  it("devuelve las tags activas como DTOs ordenadas por nombre", async () => {
    const repository = {
      findAllActive: vi.fn().mockResolvedValue([
        Tag.rehydrate(2, "Vivienda", "vivienda", "active"),
        Tag.rehydrate(1, "Alimentación", "alimentacion", "active"),
      ]),
      findByIds: vi.fn(),
      findBySlug: vi.fn(),
    };
    const useCase = new ListActiveTags(repository);

    const result = await useCase.execute();

    expect(repository.findAllActive).toHaveBeenCalledExactlyOnceWith();
    expect(result).toEqual([
      { id: 1, name: "Alimentación", slug: "alimentacion" },
      { id: 2, name: "Vivienda", slug: "vivienda" },
    ]);
  });
});
