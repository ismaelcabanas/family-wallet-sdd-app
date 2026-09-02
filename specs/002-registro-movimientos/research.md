# Research: Registro de Movimientos con Tags

**Feature**: `002-registro-movimientos` | **Fecha**: 2026-09-02

Investigación de Phase 0 para resolver las incógnitas del Technical Context del [plan.md](./plan.md). Cada sección documenta: decisión, racional y alternativas consideradas. Verificado contra documentación oficial (Next.js, Drizzle ORM, Vitest, Playwright) y contra el código real de `drizzle-orm@0.44.x` donde aplica.

---

## 1. Aritmética monetaria exacta (FR-003)

**Decision**: VO de dominio `Money` con **céntimos enteros** (`amountCents: number`), parseo de la entrada como *string* y formateo `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` en los adaptadores de UI. La decisión se registrará como **ADR 0007**.

**Rationale**:
- Con solo sumas/restas y 2 decimales (sin divisas ni porcentajes), los céntimos enteros son exactos por construcción: no hay coma flotante que razonar.
- `number` es seguro hasta `Number.MAX_SAFE_INTEGER` (≈ 9 × 10¹⁵ céntimos ≈ 90 billones de €): margen astronómico para una app familiar; `bigint` añade fricción (serialización, JSON, Drizzle) sin beneficio (YAGNI).
- Mapeo 1:1 con columna `INTEGER` de SQLite (`integer("amount_cents")`): input → céntimos → BD → céntimos → formato, sin conversión float en ningún punto.
- Cumple el principio VII: `Money` puro en dominio, cero dependencias externas.

**Reglas de implementación**:
- Frontera (Zod): aceptar `"850,00"`, `"850.00"` y `"850"` con regex `^\d{1,9}([.,]\d{1,2})?$` → transformar a céntimos manipulando el string (partes entera/decimal, pad a 2). **Nunca** `parseFloat(x) * 100` ni `Math.round(x * 100)`.
- Dominio: `Money.fromCents(n)` inmutable; valida entero y regla de signo (importe de movimiento > 0; balance puede ser negativo); `add`/`subtract` devuelven nuevo `Money`.
- Formateo: `Intl` es-ES en UI. *Pitfall*: el separador entre cifra y `€` es un espacio no rompible (`\u00A0`/`\u202F` según ICU) — en tests de UI comparar con cuidado o usar el código del espacio.

**Alternatives considered**:
| Opción | Contras |
|---|---|
| `decimal.js` / `big.js` | Dependencia externa prohibida en dominio; genéricas (no money-aware); overkill para 2 decimales; requerirían el wrapper `Money` igualmente. |
| `dinero.js` v2 | Dependencia externa; modelo multi-divisa irrelevante (EUR-only); más superficie API; años en beta. |
| `float` + `toFixed(2)` | Rechazada de raíz: `0.29 * 100 === 28.999999999999996`; errores silenciosos garantizados. |

---

## 2. Mutación y estado de pantalla en Next.js App Router (FR-011, FR-014..FR-018)

**Decision**: mutación vía **Server Action + `useActionState`**; estado de pantalla (cuenta activa + mes) como **URL searchParams** (`/?account=<id>&month=YYYY-MM`) renderizado en servidor. La decisión se registrará como **ADR 0008**.

**Rationale (Server Action sobre Route Handler + fetch)**:
- Errores por campo: la action devuelve `zodError.flatten().fieldErrors` y el formulario pinta cada error bajo su input (patrón de la guía oficial de forms de Next.js).
- Conservación de valores en fallo: la action devuelve los valores crudos (`values`) y los inputs renderizan `defaultValue` — nada se pierde (FR-011).
- Toast + reset + permanencia (FR-015): sin `redirect()`; en éxito React resetea el formulario y un `useEffect` sobre `status: 'success'` muestra el toast.
- Listado y balance actualizados: `revalidatePath('/')` re-renderiza la página con la URL actual (searchParams preservados) **en el mismo roundtrip** de la action; sin `router.refresh()` ni refetch cliente.
- Progressive enhancement: `<form action={formAction}>` funciona sin JS; CSRF check y límite de 1 MB integrados.
- Encaje hexagonal: la action (`src/infrastructure/primary/actions/create-movement.action.ts`) es el adaptador inbound: Zod → comando → caso de uso → mapeo de `ZodError`/excepciones de dominio al estado de UI. `src/app/page.tsx` queda fino.

**Rationale (searchParams sobre estado cliente)**:
- Fuente única de verdad para las tres regiones de la pantalla (form, listado, balance): sin bugs de sincronización entre cuenta del formulario y del listado (FR-017).
- Todo sigue renderizándose en servidor consumiendo la capa de aplicación (principio VII); el estado cliente obligaría a fetch cliente o prop-drilling.
- URL compartible/recargable; mes actual por defecto al abrir. Selectores como pequeños client components con `router.replace` + `useTransition`.
- La página es dinámica de todos modos (lecturas de BD por request): sin coste extra de prerender.

**Alternatives considered**:
| Opción | Contras |
|---|---|
| Route Handler `POST /api/movements` + `fetch` | Mapeo manual de errores por campo desde JSON; pending/toast manuales; mutación + `router.refresh()` = 2 roundtrips; sin fallback sin JS; glue CSRF/auth propio. No hay consumidor no-UI (YAGNI). Se añadiría solo si surge import/export programático. |
| Estado cliente (`useState`/Context/Zustand) para cuenta/mes | URL pierde significado; refresco pierde el contexto; listado/balance pasarían a cliente; Zustand no está en el stack (requeriría justificación). |

---

## 3. Persistencia: Drizzle + SQLite/Turso

**Decision**: `drizzle-orm` 0.44.x + `@libsql/client` como único driver (fichero en dev, Turso en prod). Migraciones SQL versionadas en `drizzle/` aplicadas por script explícito. Seed por script TypeScript idempotente.

**3.1 Migraciones** — `drizzle-kit generate` + `drizzle-kit migrate`; migraciones commiteadas. Dev: `npm run db:migrate`. Prod (Turso): mismo comando con `drizzle.prod.config.ts` (url + authToken) ejecutado **desde local como paso pre-deploy** (decisión del propietario, 2026-09-02; sin secretos de Turso en CI; documentado en quickstart.md).
- *Pitfall verificado*: el migrator de `drizzle-orm/libsql/migrator` lee las migraciones del filesystem en runtime → **prohibido** ejecutar `migrate()` en build/startup de Vercel (el output tracing no garantiza incluir `drizzle/` y penaliza cold starts). `push` solo para prototipado local, nunca contra prod.

**3.2 Seed de datos preconfigurados** — script `scripts/seed.ts` (tsx) con INSERTs idempotentes vía `onConflictDoNothing()` sobre claves naturales estables (slug de tag, nombre de cuenta). Se ejecuta tras migrar (`npm run db:seed`), en dev y en prod. El dato semilla vive tipado en `src/infrastructure/db/seed-data.ts` (reutilizable por tests).
- *Rechazado*: seed en migración SQL (mezcla esquema y datos; evolucionar el seed exige más migraciones), `drizzle-seed` (genera datos falsos, no presets fijos), ensure-seed en runtime (coste por cold start y concurrencia sobre escrituras serializadas de Turso).

**3.3 Unicidad case-insensitive de tags (FR-007)** — índice único por expresión SQL: `uniqueIndex("tags_name_nocase_uq").on(sql`lower(${tags.name})`)`; las queries de existencia comparan `lower(name) = name.toLowerCase()`.
- *Verificado en código 0.44.2*: `.collate()` **NO existe** en columnas SQLite de drizzle-orm; `uniqueIndex().on(sql...)` sí está soportado y drizzle-kit lo serializa. `lower()` equivale a COLLATE NOCASE en alcance (ASCII-only, suficiente para tags en español).

**3.4 Tipos de datos**:
- `amount_cents: integer().notNull()` (modo `number`); nada de `real`/`numeric` (constitución V/FR-003).
- `date: text().notNull()` en ISO `YYYY-MM-DD` (TEXT ordena lexicográficamente = cronológicamente). `createdAt` TEXT ISO-8601 UTC.
- **Sin columna derivada `month`**: filtro por mes con rango semicerrado sargable `where(and(gte(date, 'YYYY-MM-01'), lt(date, nextMonthFirstDay)))` + índice `(account_id, date)`. Si el futuro lo pide: `substr(date,1,7)` en GROUP BY o generated column — pospuesto (YAGNI).

**3.5 N-N movements↔tags** — tabla de unión `movement_tags` (PK compuesta `movement_id + tag_id`, FKs con `onDelete: 'cascade'`) + `relations()` para relational queries. Escritura con `db.batch([...])`: el batch de libSQL es transaccional (rollback atómico) y funciona sobre HTTP/web, a diferencia de las transacciones interactivas.

**3.6 Balance (FR-008)** — **derivado on-the-fly** (`select sum(amount_cents) ... where account_id = ?`). Sin columna persistida. Se registrará como **ADR 0009**.
- Cientos de movimientos/mes → agregación sub-milisegundo con el índice. Un balance persistido exigiría recalcular al editar/eliminar (feature 003), introduce riesgo de drift y serializa escrituras (Turso single-writer). Si el histórico creciera: snapshot mensual materializado sin tocar dominio.

**3.7 Driver y versión** — `@libsql/client` único para ambos entornos (`file:./db.sqlite` dev; `libsql://...` + authToken prod; entry `/web` en Vercel). Fijar **drizzle-orm 0.44.x** (v1.0 en RC reorganiza APIs de índices: riesgo innecesario). Criterio de actualización: migrar a v1 cuando sea estable, en un `chore:` dedicado, revisando los breaking changes de índices/collate señalados en §3.3.

---

## 4. Stack de testing y calidad

**Decision**: Vitest con `test.projects` (node para dominio/aplicación/infra, jsdom para UI), tests co-localizados junto al SUT, repositorios contra libsql `:memory:`, Playwright e2e contra `build + start` en CI, ESLint 9 flat config + Prettier.

- **Vitest + RTL** (setup oficial de Next.js): `vitest.config.mts` con `@vitejs/plugin-react` + `vite-tsconfig-paths` (alias `@/` desde tsconfig, una sola fuente de verdad). RTL v16+ soporta React 19. *Fricción conocida*: Vitest no soporta Server Components async → cubrirlos con e2e; las Server Actions se mockean con `vi.mock`. `vitest.workspace` deprecado desde 3.2 → `test.projects`.
- **Projects separados**: `node` (`src/{domain,application,infrastructure}/**/*.test.ts`) y `ui` jsdom (`src/infrastructure/primary/**/*.test.tsx`): más rápido y refuerza "dominio sin React".
- **Integración de repositorios**: `createClient({ url: ':memory:' })` + `migrate(db, { migrationsFolder: 'drizzle' })` en setup: mismo driver que prod, valida también el SQL generado por drizzle-kit; evita `better-sqlite3` (nativo, compilación).
- **Playwright en CI**: `webServer: { command: 'npm run build && npm run start', reuseExistingServer: !CI }`, `workers: CI ? 1 : undefined`; workflow con `playwright install --with-deps` + upload de report como artefacto. Lint/typecheck/vitest en job separado del e2e.
- **Lint/format**: ESLint CLI con flat config (`eslint-config-next/core-web-vitals` + `/typescript` + `eslint-config-prettier/flat`); scripts `lint` = `eslint .`, `typecheck` = `tsc --noEmit`, `test` = `vitest`, `test:e2e` = `playwright test`.

**devDependencies**: `vitest @vitejs/plugin-react jsdom vite-tsconfig-paths @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event @playwright/test eslint eslint-config-next eslint-config-prettier prettier typescript drizzle-kit tsx`.

---

## Resumen de decisiones (trazabilidad)

| Tema | Decisión | ADR |
|---|---|---|
| Dinero | Céntimos enteros en VO `Money`; parseo string en frontera | 0007 |
| Mutación | Server Action + `useActionState` + `revalidatePath('/')` | 0008 |
| Estado de pantalla | searchParams `?account=&month=` renderizados en servidor | 0008 |
| Migraciones | `drizzle-kit generate/migrate`, aplicadas por script, nunca en runtime serverless | — |
| Seed | Script idempotente `onConflictDoNothing` sobre claves naturales | — |
| Unicidad tags | `uniqueIndex` sobre `lower(name)` | — |
| Fechas | TEXT ISO `YYYY-MM-DD`; mes por rango semicerrado sargable | — |
| N-N tags | Tabla `movement_tags` + `db.batch` atómico | — |
| Balance | Derivado `SUM(amount_cents)`, no persistido | 0009 |
| Testing | Vitest projects (node/ui) + libsql `:memory:` + Playwright build+start en CI | — |
