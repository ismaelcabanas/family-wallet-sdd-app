import { TagId } from "./TagId";
import { TagCategoryId } from "../tag-category/TagCategoryId";
import { InvalidTagError } from "./TagErrors";
import { TagStatus } from "./TagStatus";

export interface TagInput {
  name: string;
  slug: string;
  status: TagStatus;
  categoryId: TagCategoryId;
}

export class Tag {
  readonly id: TagId | null;
  readonly name: string;
  readonly slug: string;
  readonly status: TagStatus;
  readonly categoryId: TagCategoryId;

  private constructor(
    id: TagId | null,
    name: string,
    slug: string,
    status: TagStatus,
    categoryId: TagCategoryId,
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.status = status;
    this.categoryId = categoryId;
    Object.freeze(this);
  }

  static create(input: TagInput): Tag {
    const name = input.name.trim();
    if (name === "") {
      throw new InvalidTagError("El nombre de la etiqueta es obligatorio.");
    }
    const slug = input.slug.trim();
    if (slug === "") {
      throw new InvalidTagError("El slug de la etiqueta es obligatorio.");
    }
    return new Tag(null, name, slug, input.status, input.categoryId);
  }

  static rehydrate(
    id: number,
    name: string,
    slug: string,
    status: TagStatus,
    categoryId: TagCategoryId,
  ): Tag {
    return new Tag(TagId(id), name, slug, status, categoryId);
  }

  rename(name: string): Tag {
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new InvalidTagError("El nombre de la etiqueta es obligatorio.");
    }
    return new Tag(this.id, trimmed, this.slug, this.status, this.categoryId);
  }

  withStatus(status: TagStatus): Tag {
    return new Tag(this.id, this.name, this.slug, status, this.categoryId);
  }

  moveToCategory(categoryId: TagCategoryId): Tag {
    return new Tag(this.id, this.name, this.slug, this.status, categoryId);
  }
}
