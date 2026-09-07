import { TagId } from "./TagId";
import { InvalidTagError } from "./TagErrors";
import { TagStatus } from "./TagStatus";

export interface TagInput {
  name: string;
  slug: string;
  status: TagStatus;
}

export class Tag {
  readonly id: TagId | null;
  readonly name: string;
  readonly slug: string;
  readonly status: TagStatus;

  private constructor(id: TagId | null, name: string, slug: string, status: TagStatus) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.status = status;
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
    return new Tag(null, name, slug, input.status);
  }

  static rehydrate(id: number, name: string, slug: string, status: TagStatus): Tag {
    return new Tag(TagId(id), name, slug, status);
  }
}
