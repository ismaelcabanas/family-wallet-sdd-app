# Research — KPIs fijos y destacados en la página de cuenta personal (022)

**Feature**: `022-kpis-fijos-cuenta` | **Fecha**: 2026-10-21 | Fuentes: código actual (verificado), specs 018/019/021, ADR 0016/0017/0019, convenciones e2e de `AGENTS.md`.

Feature de **lectura/UI**: dos KPIs (aportación neta del mes y saldo del mes) en un bloque sticky de la página de cuenta personal. Sin entidades nuevas, sin cambios de esquema, sin actions nuevas. Cada sección: **Decisión · Rationale · Alternativas**.

---

## 1. Fuente del KPI de aportación neta: el movimiento enlazado del registro de materialización

**Decisión**: el importe del KPI se lee del **movimiento materializado enlazado**: `CommonContributionRepository.findMaterializedMovement(contributionId, month)` (puerto existente de 021) → `movement.amount.amountCents`, o `0` si no hay movimiento. La existencia de configuración se lee con `findByAccountId` (puerto existente). Se encapsula en un caso de uso de lectura nuevo (§3).

**Rationale**:
- **Coherencia por construcción** (FR-006/SC-002): el importe mostrado es literalmente el del movimiento «Aportación Común» que el listado muestra — mismo dato, cero deriva posible. El materializador ya ha corrido **antes** de la lectura (orden intacto de la página: `MaterializeRegularIncomes` → `MaterializeCommonContributions` → lecturas), así que el mes en curso llega re-sincronizado (021) y los cerrados congelados.
- Cubre todos los casos de la spec sin lógica adicional (verificado contra el flujo de guardas de `MaterializeCommonContributions`, §1.2.1 de `specs/021-…/data-model.md`):

  | Caso | Registro (`common_contribution_months`) | `findMaterializedMovement` | KPI |
  |---|---|---|---|
  | Sin configuración | — (sin fila en `common_contributions`) | — (ni se consulta) | «Sin aportación configurada» + 0,00 € |
  | Neta materializada | fila + `movement_id` → movimiento | movimiento | importe neto vigente |
  | Retirada por neto 0 (021) | fila borrada (`withdrawMaterialization`) | `null` (sin fila) | 0,00 € (sin literal) |
  | Borrado del usuario | fila sin movimiento válido | `null` | 0,00 € (definitivo) |
  | Mes fuera de ventana / futuro | sin fila (guardas de generación) | `null` | 0,00 € |
  | Config desactivada, mes en curso ya generado | fila + movimiento | movimiento | importe vigente (021) |

- El alcance del descuento sigue sellado en `MovementRepository.sumSharedExpenseCents` (ADR 0019): el KPI **no** recalcula nada, luego no puede divergir de la regla.

**Alternativas descartadas**:
- *Recomputar* `percentage.netAppliedToCents(ingreso, Σ gastos)` en un nuevo caso de uso: duplica la regla de 021 en una segunda vía de cálculo (riesgo de deriva con listado/cierre; FR-006 lo prohíbe de facto) y exige leer ingreso regular + SUM en cada render.
- Exponer el `id` de la config en `CommonContributionDTO` y que la página combine `GetCommonContribution` + `findMaterializedMovement`: filtra un identificador de persistencia a un DTO de presentación y reparte la regla «configurada ⇔ importe» entre página y aplicación.
- Filtrar el listado por tag `aportacion-comun` / nota «Aportación común de …»: heurística frágil (el usuario puede crear movimientos con ese tag/note) y sin distinción «sin configuración».

## 2. Fuente del KPI de saldo del mes: reutilizar `closure.monthBalanceCents`

**Decisión**: el saldo del mes es el `monthBalanceCents` del `MonthlyClosureDTO` que la página **ya calcula** en cada render (`GetMonthlyClosure` → `MonthlyClosure.fromMovements` = Σ ingresos − Σ gastos del mes, incluida la aportación). El KPI consume ese valor; **cero cálculo nuevo**.

**Rationale**: FR-003 define exactamente esa resta; FR-006 exige coincidencia permanente con el cierre — reutilizar el mismo número la garantiza por construcción. Verificado: `src/app/accounts/[accountId]/page.tsx:78-83` ya obtiene `closure` en el `Promise.all`; `MonthlyClosurePanel` ya muestra «Saldo del mes» con `formatSignedCents` (misma etiqueta que usará el KPI).

**Alternativas descartadas**: nuevo caso de uso o método SQL `SUM` por tipo (duplica `MonthlyClosure`; deriva posible), o derivar del listado en cliente (lógica de negocio en UI, prohibido — constitución VII).

## 3. Caso de uso de lectura nuevo: `GetMonthNetContribution` (aplicación)

**Decisión**: un caso de uso mínimo en `src/application/common-contribution/`:

```ts
export interface MonthNetContributionDTO {
  configured: boolean;   // false ⇔ no existe fila de config para la cuenta
  amountCents: number;   // importe del movimiento enlazado del mes; 0 si no existe
}

class GetMonthNetContribution {
  constructor(commonContributions: CommonContributionRepository) {}
  execute(accountId: AccountId, month: string): Promise<MonthNetContributionDTO>;
}
```

Flujo: valida `month` (`/^\d{4}-(0[1-9]|1[0-2])$/`, igual que `GetMonthlyClosure`) → `findByAccountId` → `null` (o `id null` defensivo) ⇒ `{ configured: false, amountCents: 0 }` → si no, `findMaterializedMovement(config.id, month)` ⇒ `{ configured: true, amountCents: movement?.amount.amountCents ?? 0 }`. **Sin puertos nuevos** (reusa los dos existentes de 019/021); el adaptador Drizzle no cambia.

**Rationale**: la página es un adaptador inbound fino que ya solo habla con casos de uso (`ListAccounts`, `ListMovements`, `GetMonthlyClosure`…); el KPI no puede ser excepción (constitución VII). Un DTO pequeño deja la regla «configurada ⇔ importe» en la aplicación y el componente 100 % presentacional.

**Alternativas descartadas**: página → repositorio directo (rompe hexagonal); ampliar `GetCommonContribution` con parámetro mes (cambia firma usada por `/` y mezcla dos lecturas); un `GetAccountMonthKpis` que devuelva también el saldo (duplicaría §2).

## 4. Bloque sticky: componente servidor `AccountMonthKpis` + CSS `position: sticky`

**Decisión** (mecanismo fijado en clarify 2026-10-21):
- Componente **servidor** (sin interactividad) `src/infrastructure/primary/ui/account-month-kpis.tsx`, props `{ netContribution: MonthNetContributionDTO; monthBalanceCents: number; month: string }`.
- Se renderiza **solo para `account.type === "personal"`** (FR-005), como hijo directo de `<main>`, **entre `MonthStepper` y `GroupedMovementList`** (el listado sigue inmediatamente después; el selector NO viaja en la barra sticky).
- Fijación con `sticky top-0 z-20` + fondo sólido `bg-background` que sangra hasta cubrir el padding de `main` (`-mx-4 px-4 sm:-mx-6 sm:px-6`), tarjeta interior `rounded-lg border bg-card p-4` (idioma visual existente; no existe `card.tsx` en el repo). `main` (`flex flex-col`) no es contenedor de scroll ni tiene `overflow` que anule sticky — verificado en `page.tsx:86` y `layout.tsx`.
- La barra incluye una **etiqueta pasiva del mes consultado** (`monthLabel(month)`, `text-xs text-muted-foreground`): al quedar pegada, el stepper (fuera de la barra) se ha ido del viewport y el mes es el contexto necesario para leer los KPIs. Es texto, no el selector — cumple el clarify.
- El saldo pinta con `formatSignedCents` (rojo `text-red-600` si < 0, igual que el cierre) y la aportación con `formatAmountCents` (magnitud ≥ 0, sin signo: es una cantidad aportada, y la spec la ejemplifica «0,00 €»).

**Rationale**: sticky puro CSS — cero JS, cero estado cliente, funciona con el scroll de página existente y con la navegación por `router.replace` del stepper (cada mes es un render nuevo de servidor). La convención «diálogos por fila» no aplica (no hay diálogos aquí).

**Consecuencia sobre e2e existente** (verificado): `e2e/pagina-cuenta.spec.ts` P1 (líneas 138-148) aserta `listIndex === stepperIndex + 1` («sin bloques intermedios») inspeccionando `main > *`. 022 **actualiza esa aserción**: el bloque KPIs (`aria-labelledby` → región «KPIs del mes») queda entre selector y listado (`listIndex === stepperIndex + 2` y `kpiIndex === stepperIndex + 1`). Es el único cambio contractual del layout.

**Alternativas descartadas**: barra `fixed` (solapa contenido y exige reservar hueco), `useScroll`/IntersectionObserver en cliente (JS innecesario), incluir el stepper en la barra (rechazado en clarify), colapsar la barra al avanzar (complejidad extra sin spec).

**Nota menor**: el `<Toaster position="top-center">` de sonner solapa transitoriamente la barra pegada al topear la parte alta del viewport; los toasts son efímeros y se descarta tratamiento especial.

## 5. Literales y etiquetas (a congelar en `contracts/ui-contract.md`)

- Región accesible: `section aria-labelledby` con `<h2>` **«KPIs del mes»** (patrón `movement-list-title` / `account-balance-title` del repo; selector e2e `getByRole("region", { name: "KPIs del mes" })`).
- KPI 1: dt **«Aportación común»**; sin configuración añade `p.text-xs.text-muted-foreground` **«Sin aportación configurada»** (literal exacto de FR-002) — con configuración no hay texto auxiliar ni con neto 0.
- KPI 2: dt **«Saldo del mes»** (misma etiqueta que el cierre, coherencia léxica).
- Estructura `dl > div > dt/dd` en `grid grid-cols-2 gap-3`, con `dt text-xs text-muted-foreground` y `dd text-xl font-semibold tabular-nums` (idioma de `MonthlyClosurePanel`).

## 6. Aislamiento e2e: cuenta A (id 1) + mes en curso real + limpieza completa

**Decisión**: fichero nuevo `e2e/kpis-fijos-cuenta.spec.ts` (orden alfabético «k»: corre tras `gestion-tags`/`ingresos-regulares` y antes de `pagina-cuenta`/`panel-cuentas`/`registro-movimientos`/`resumen-global`), serial, sobre **Cuenta de Miembro A (id 1)** en el **mes en curso real** (y su mes anterior vía ‹), con **limpieza total UI-driven** al final (desactivar aportación → desactivar ingreso regular → borrar todos los movimientos creados → verificar listado vacío).

**Rationale — matriz de ocupación verificada** (`workers: 1`, orden alfabético sobre `e2e.sqlite` compartida):

| Spec | Cuenta | Mes(es) |
|---|---|---|
| aportacion-comun | B (2) + común | en curso real |
| cierre-mensual | B | en curso real (deja «Hipoteca» 850,00 shared) |
| creacion-tags | B | 2026-05 |
| cuenta-resultados-anual | B | 2027-01/07 (anual completo) |
| descuento-gastos-comunes | B | en curso real (D11: desactiva configs B, restaura Hipoteca) |
| edicion-movimientos | B | 2026-07/08 |
| gestion-tags | B | 2026-09 |
| ingresos-regulares | A (1) | en curso real (R4/R5: borra movimiento, desactiva config) |
| **kpis-fijos-cuenta (022)** | **A (1)** | **en curso real + mes anterior** |
| pagina-cuenta | B | 2026-04/03 (+ en curso y 2027-06) — **aserta acumulado absoluto** (−120,00 en abr; 0,00 en mar) |
| panel-cuentas | home + B | 2026-03 |
| registro-movimientos | común + A | en curso real — **aserta acumulado absoluto de A (1.500,00) y común (500,00)** |
| resumen-global | común/A/B | 2026-06 (fijo) |

- **A en curso** es el único hueco viable para el camino feliz de la aportación: la materialización exige `activatedAtMonth ≤ month ≤ currentMonth`, y `activatedAtMonth` siempre es el mes en curso al configurar → **cualquier mes fijo pasado solo puede probar el caso 0,00** (fuera de ventana). A llega limpio a «k» (ingresos-regulares limpia y corre antes).
- A es además la cuenta cuyo acumulado absoluto aserta un spec **posterior** (`registro-movimientos` E3: 1.500,00 tras su nómina): la limpieza total restaura el baseline 0,00 y las configs quedan desactivadas (estado idéntico al que ya deja 018-R5, verificada la compatibilidad con los specs posteriores: ninguno aserta estado de menú ni saldo de A antes de crear los suyos).
- **B queda descartada**: su mes en curso arrastra «Hipoteca» 850,00 shared (obliga a ingresos > 3.400 € para neto no nulo), sus configs acaban desactivadas por D11 (reactivar + restaurar), sus meses pasados están ocupados o congelados por aserciones absolutas de `pagina-cuenta` (≤ 2026-03) y `cuenta-resultados-anual` (2027), y 2026-06 contaminaría `resumen-global` (posterior).
- Flujo congelado (importes espejo de 021): K0 sin config («Sin aportación configurada» + 0,00; saldo 0,00 en mes vacío) → K1 configurar ingreso **2.000,00 (rellenado explícito: 018-R3 deja 2.100 pre-rellenado)** + aportación 25 % → KPIs 500,00 / −500,00 → K2 gasto común 120,55 → 379,45 / −500,00 + coherencia textual con el cierre → K3 ‹ mes anterior (0,00 sin literal — fuera de ventana — y saldo 0,00; etiqueta de mes cambia) y › vuelta (valores restaurados, SC-004) → K4 tanda de ≥ 12 movimientos + scroll a fondo con KPIs en viewport (SC-001) → K5 gasto común 400,00 (Σ 520,55 ≥ 500) → retirada → KPI 0,00 sin literal → K6 `/accounts/3` sin bloque (FR-005) → K7 limpieza.
- **SC-001 (≥ 50 movimientos)** se valida en `quickstart.md` (manual); el e2e usa ≥ 12 filas (≈ >720 px, suficiente para desbordar el viewport de Desktop Chrome y forzar el sticky) para mantener el tiempo de spec y de limpieza acotado.

## 7. Matriz de tests (FR-010)

| Nivel | Fichero (co-localizado) | Casos |
|---|---|---|
| Aplicación (node, dobles in-memory) | `src/application/common-contribution/GetMonthNetContribution.test.ts` | sin config → `{configured:false,0}`; con config + movimiento enlazado → importe exacto; con config sin fila (retirada/futuro) → 0; con config + fila sin movimiento (borrado usuario) → 0; mes inválido → throw |
| Componente (ui/jsdom) | `src/infrastructure/primary/ui/account-month-kpis.test.tsx` | con aportación (379,45 €); sin configuración (literal + 0,00 €); neto cero con config (0,00 € sin literal); saldo negativo (−51,20 € + `text-red-600`); mes vacío (saldo 0,00 €); etiqueta del mes consultado visible; clases sticky (`sticky`, `top-0`) y grid 2 columnas |
| e2e (Playwright, serial, fichero propio) | `e2e/kpis-fijos-cuenta.spec.ts` | K0–K7 de §6: visibilidad continua (scroll), importes exactos, mes consultado, cuenta común sin bloque, limpieza |
| e2e (modificación) | `e2e/pagina-cuenta.spec.ts` | P1: orden selector → KPIs → listado (§4) |

«Mes consultado distinto al en curso» (FR-010) queda cubierto a nivel de componente por la etiqueta del mes + a nivel de flujo por el caso de aplicación (parámetro `month`) y K3; el componente no recibe «mes en curso» porque no hay comportamiento diferencial (todo mes se pinta igual).

## 8. Documentación y cierre (FR-011)

- **AGENTS.md**: nueva convención de UI («bloque KPIs sticky en cuentas personales») junto a las existentes de diálogos/tarjetas — es el primer uso de `position: sticky` del repo.
- **Roadmap maestro** (`specs/001-family-wallet/spec.md`): fila 022 → Completada con nota datada al cerrar la feature.
- **Sin ADR nuevo**: no hay decisión arquitectónica de peso — la fuente del KPI (movimiento enlazado del registro) es consecuencia directa de ADR 0016/0017 (materialización por consulta) y 0019 (neto + re-sincronización); se documenta aquí y en el ui-contract. Si `/speckit.tasks` o el propietario lo reclaman, se promueve a ADR.
- **`docs/architecture/diagrams/`**: el diagrama de componentes de la página de cuenta se amplía con el bloque KPIs reutilizando el de este plan como base (regla anti-drift).
