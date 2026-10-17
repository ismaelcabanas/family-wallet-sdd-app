import { ListTags } from "@/application/tag/ListTags";
import { connection } from "next/server";

import { db } from "@/infrastructure/db/client";
import { DrizzleTagRepository } from "@/infrastructure/db/DrizzleTagRepository";
import { GlobalNav } from "@/infrastructure/primary/ui/global-nav";
import { TagCatalog } from "@/infrastructure/primary/ui/tag-catalog";

export default async function TagsPage() {
  await connection();

  const tags = await new ListTags(new DrizzleTagRepository(db)).execute();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Etiquetas</h1>
        <GlobalNav active="tags" />
      </div>

      <TagCatalog tags={tags} />
    </main>
  );
}
