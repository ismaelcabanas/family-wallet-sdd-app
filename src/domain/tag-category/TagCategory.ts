import { TagCategoryId } from "./TagCategoryId";
import { InvalidCategoryError } from "./TagCategoryErrors";

export interface TagCategoryInput {
  name: string;
  slug: string;
}

export class TagCategory {
  readonly id: TagCategoryId | null;
  readonly name: string;
  readonly slug: string;

  private constructor(id: TagCategoryId | null, name: string, slug: string) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    Object.freeze(this);
  }

  static create(input: TagCategoryInput): TagCategory {
    const name = input.name.trim();
    if (name === "") {
      throw new InvalidCategoryError();
    }
    const slug = input.slug.trim();
    if (slug === "") {
      throw new InvalidCategoryError("El slug de la categoría es obligatorio.");
    }
    return new TagCategory(null, name, slug);
  }

  static rehydrate(id: number, name: string, slug: string): TagCategory {
    return new TagCategory(TagCategoryId(id), name, slug);
  }

  rename(name: string): TagCategory {
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new InvalidCategoryError();
    }
    return new TagCategory(this.id, trimmed, this.slug);
  }
}
