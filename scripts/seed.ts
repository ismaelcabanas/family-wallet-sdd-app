import { and, eq } from "drizzle-orm";

import { db } from "../src/infrastructure/db/client";
import { accounts, members, tags } from "../src/infrastructure/db/schema";
import { SEED_ACCOUNTS, SEED_MEMBERS, SEED_TAGS } from "../src/infrastructure/db/seed-data";

async function seed(): Promise<void> {
  for (const member of SEED_MEMBERS) {
    const [existing] = await db
      .select()
      .from(members)
      .where(eq(members.name, member.name))
      .limit(1);
    if (existing === undefined) {
      await db.insert(members).values({ name: member.name });
    }
  }

  const existingMembers = await db.select().from(members);
  const memberIdByName = new Map(existingMembers.map((member) => [member.name, member.id]));

  for (const account of SEED_ACCOUNTS) {
    if (account.type === "shared") {
      const [existing] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.name, account.name))
        .limit(1);
      if (existing === undefined) {
        await db.insert(accounts).values({ name: account.name, type: account.type, memberId: null });
      }
      continue;
    }

    const memberId = account.memberName ? (memberIdByName.get(account.memberName) ?? null) : null;
    if (memberId === null) continue;

    const [existing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.type, "personal"), eq(accounts.memberId, memberId)))
      .limit(1);
    if (existing === undefined) {
      await db.insert(accounts).values({ name: null, type: account.type, memberId });
    }
  }

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
