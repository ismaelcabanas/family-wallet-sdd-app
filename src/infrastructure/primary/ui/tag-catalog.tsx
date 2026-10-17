"use client";

import { EllipsisVerticalIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { CatalogTagDTO } from "@/application/tag/dto";

import { reactivateTag } from "../actions/reactivate-tag.action";
import { DeactivateTagDialog } from "./deactivate-tag-dialog";
import { MergeTagsDialog } from "./merge-tags-dialog";
import { RenameTagDialog } from "./rename-tag-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";

export function TagCatalog({ tags }: { tags: CatalogTagDTO[] }) {
  const [renaming, setRenaming] = useState<CatalogTagDTO | null>(null);
  const [merging, setMerging] = useState<CatalogTagDTO | null>(null);
  const [deactivating, setDeactivating] = useState<CatalogTagDTO | null>(null);
  const [isReactivating, startReactivation] = useTransition();

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
        <ul className="divide-y">
          {tags.map((tag) => (
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
              {tag.isProtected ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Acciones de ${tag.name}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                    disabled={isReactivating}
                  >
                    <EllipsisVerticalIcon className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {tag.status === "active" ? (
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
              )}
            </li>
          ))}
        </ul>
        {tags.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No hay etiquetas todavía.</p>
        ) : null}
      </section>

      {renaming ? (
        <RenameTagDialog tag={renaming} onClose={() => setRenaming(null)} />
      ) : null}
      {merging ? (
        <MergeTagsDialog tag={merging} tags={tags} onClose={() => setMerging(null)} />
      ) : null}
      {deactivating ? (
        <DeactivateTagDialog tag={deactivating} onClose={() => setDeactivating(null)} />
      ) : null}
    </>
  );
}
