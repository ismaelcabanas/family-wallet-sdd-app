import { db } from "../src/infrastructure/db/client";
import { accounts, members, tags } from "../src/infrastructure/db/schema";
import { SEED_ACCOUNTS, SEED_MEMBERS, SEED_TAGS } from "../src/infrastructure/db/seed-data";

async function seed(): Promise<void> {
  await db
    .insert(members)
    .values(SEED_MEMBERS.map((member) => ({ name: member.name })))
    .onConflictDoNothing({ target: members.name });

  const existingMembers = await db.select().from(members);
  const memberIdByName = new Map(existingMembers.map((member) => [member.name, member.id]));

  await db
    .insert(accounts)
    .values(
      SEED_ACCOUNTS.map((account) => ({
        name: account.name,
        type: account.type,
        memberId: account.memberName ? (memberIdByName.get(account.memberName) ?? null) : null,
      })),
    )
    .onConflictDoNothing({ target: accounts.name });

  await db
    .insert(tags)
    .values(SEED_TAGS.map((tag) => ({ name: tag.name, slug: tag.slug, status: "active" })))
    .onConflictDoNothing({ target: tags.slug });
}

seed()
  .then(() => {
    console.log("Seed completado: 2 miembros, 3 cuentas y 12 tags garantizadas (idempotente).");
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("Seed fallido:", error);
    process.exit(1);
  });
