export const SEED_MEMBERS = [{ name: "Miembro A" }, { name: "Miembro B" }] as const;

export const SHARED_ACCOUNT_NAME = "Cuenta común";

export const SEED_ACCOUNTS = [
  { name: null, type: "personal", memberName: "Miembro A" },
  { name: null, type: "personal", memberName: "Miembro B" },
  { name: SHARED_ACCOUNT_NAME, type: "shared", memberName: null },
] as const;

export const SEED_TAGS = [
  { name: "Hogar", slug: "hogar" },
  { name: "Coche", slug: "coche" },
  { name: "Salud", slug: "salud" },
  { name: "Alimentación", slug: "alimentacion" },
  { name: "Ocio", slug: "ocio" },
  { name: "Viaje", slug: "viaje" },
  { name: "Ropa", slug: "ropa" },
  { name: "Regalos", slug: "regalos" },
  { name: "Suscripciones online", slug: "suscripciones-online" },
  { name: "Sin Clasificar", slug: "sin-clasificar" },
  { name: "Vivienda", slug: "vivienda" },
  { name: "Hipoteca", slug: "hipoteca" },
  { name: "Aportación Común", slug: "aportacion-comun" },
] as const;
