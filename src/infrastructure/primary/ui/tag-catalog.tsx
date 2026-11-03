"use client";

import { EllipsisVerticalIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { CategoryDTO } from "@/application/tag-category/dto";
import type { CatalogTagDTO, TagCatalogGroupDTO } from "@/application/tag/dto";

import { reactivateTag } from "../actions/reactivate-tag.action";
import { CreateTagDialog } from "./create-tag-dialog";
import { DeactivateTagDialog } from "./deactivate-tag-dialog";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { MergeTagsDialog } from "./merge-tags-dialog";
import { MoveTagDialog } from "./move-tag-dialog";
import { RenameCategoryDialog } from "./rename-category-dialog";
import { RenameTagDialog } from "./rename-tag-dialog";
import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";

const MENU_TRIGGER_CLASS =
  "inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function TagCatalog({ groups }: { groups: TagCatalogGroupDTO[] }) {
  const [renaming, setRenaming] = useState<CatalogTagDTO | null>(null);
  const [merging, setMerging] = useState<CatalogTagDTO | null>(null);
  const [deactivating, setDeactivating] = useState<CatalogTagDTO | null>(null);
  const [moving, setMoving] = useState<CatalogTagDTO | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<CategoryDTO | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryDTO | null>(null);
  const [isReactivating, startReactivation] = useTransition();

  const allTags = groups.flatMap((group) => group.tags);
  const allCategories = groups.map((group) => group.category);
  const totalTags = allTags.length;

  function currentCategoryIdOf(tag: CatalogTagDTO): number {
    return groups.find((group) => group.tags.some((candidate) => candidate.id === tag.id))
      ?.category.id as number;
  }

  function reactivate(tag: CatalogTagDTO) {
    startReactivation(async () => {
      const result = await reactivateTag(tag.id);
      if (result.ok) {
        toast.success("Etiqueta reactivada");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <section aria-label="Catálogo de etiquetas">
        <div className="flex items-center justify-between gap-4 pb-3">
          <span className="text-sm text-muted-foreground">
            {groups.length} {groups.length === 1 ? "categoría" : "categorías"}
          </span>
          <Button type="button" variant="outline" onClick={() => setCreatingTag(true)}>
            Nueva etiqueta
          </Button>
        </div>
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section
              key={group.category.id}
              aria-label={`Categoría ${group.category.name}`}
              className="rounded-lg border"
            >
              <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                <h2 className="text-sm font-semibold">
                  {group.category.name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {group.tags.length === 0
                      ? "Sin etiquetas"
                      : `${group.tags.length} ${group.tags.length === 1 ? "etiqueta" : "etiquetas"}`}
                  </span>
                </h2>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Acciones de la categoría ${group.category.name}`}
                    className={MENU_TRIGGER_CLASS}
                  >
                    <EllipsisVerticalIcon className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setRenamingCategory(group.category)}>
                      Renombrar…
                    </DropdownMenuItem>
                    {group.category.isDefault ? null : (
                      <DropdownMenuItem onSelect={() => setDeletingCategory(group.category)}>
                        Eliminar…
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <ul className="divide-y px-4">
                {group.tags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center justify-between gap-4 py-3"
                    aria-label={tag.name}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="truncate text-sm font-medium">{tag.name}</span>
                      {tag.isProtected ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Sistema
                        </span>
                      ) : null}
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        {tag.status === "active" ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Acciones de ${tag.name}`}
                        className={MENU_TRIGGER_CLASS}
                        disabled={isReactivating}
                      >
                        <EllipsisVerticalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setMoving(tag)}>
                          Mover a categoría…
                        </DropdownMenuItem>
                        {tag.isProtected ? null : tag.status === "active" ? (
                          <>
                            <DropdownMenuItem onSelect={() => setRenaming(tag)}>
                              Renombrar…
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setMerging(tag)}>
                              Fusionar en otra…
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDeactivating(tag)}>
                              Desactivar…
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onSelect={() => reactivate(tag)}>
                            Reactivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
              {group.category.isDefault && totalTags === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No hay etiquetas todavía.</p>
              ) : null}
            </section>
          ))}
        </div>
      </section>

      {creatingTag ? (
        <CreateTagDialog categories={allCategories} onClose={() => setCreatingTag(false)} />
      ) : null}
      {renamingCategory ? (
        <RenameCategoryDialog category={renamingCategory} onClose={() => setRenamingCategory(null)} />
      ) : null}
      {deletingCategory ? (
        <DeleteCategoryDialog category={deletingCategory} onClose={() => setDeletingCategory(null)} />
      ) : null}
      {moving ? (
        <MoveTagDialog
          tag={moving}
          categories={allCategories}
          currentCategoryId={currentCategoryIdOf(moving)}
          onClose={() => setMoving(null)}
        />
      ) : null}
      {renaming ? (
        <RenameTagDialog tag={renaming} onClose={() => setRenaming(null)} />
      ) : null}
      {merging ? (
        <MergeTagsDialog tag={merging} tags={allTags} onClose={() => setMerging(null)} />
      ) : null}
      {deactivating ? (
        <DeactivateTagDialog tag={deactivating} onClose={() => setDeactivating(null)} />
      ) : null}
    </>
  );
}
