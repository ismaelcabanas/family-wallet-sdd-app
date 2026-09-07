import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL es obligatorio para migrar contra Turso (drizzle.prod.config.ts).",
  );
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/infrastructure/db/schema",
  out: "./drizzle",
  dbCredentials: {
    url,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  },
});
