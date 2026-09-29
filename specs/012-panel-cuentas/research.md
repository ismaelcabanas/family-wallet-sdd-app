# Research: Panel de Cuentas

**Feature**: `012-panel-cuentas` | **Fecha**: 2026-09-29

Investigación de Phase 0 para resolver las incógnitas del Technical Context del [plan.md](./plan.md). Sin incógnitas tecnológicas nuevas (stack fijado por 002–011 y la constitución): las decisiones son de **ubicación y tecnología de la navegación global, propagación del contexto temporal, renderizado dinámico del panel, diseño de la tarjeta lanzadora, jubilación de componentes y adaptación e2e**. Cada sección documenta: decisión, racional y alternativas consideradas.

---

## 1. Dónde vive la navegación global: `GlobalNav` de servidor renderizado por cada página (FR-003, US2)

**Decision**: componente de servidor **`global-nav.tsx`** (`GlobalNav({ active, month? })`, sin `"use client"`, sin hooks) renderizado por las 4 páginas en la misma ranura de cabecera donde hoy viven los navs locales:

```text
GlobalNav({ active: "panel" | "summary" | "annual", month?: string })
```

- Enlaces: **Panel** → `/` (sin query), **Resumen global** → `/summary?month={mes de contexto}`, **Cuenta de resultados** → `/annual?year={año de contexto}`.
- `month` es opcional: si no llega, el componente usa `currentMonth()` (`format.ts`, ya usada server-side en todas las páginas). La página de cuenta y `/summary` pasan su mes resuelto; `/annual` pasa `${year}-01` (§2).
- Estado activo: el enlace del destino actual recibe `aria-current="page"` y clases `font-medium text-foreground`; los inactivos mantienen el estilo actual (`text-sm text-muted-foreground underline-offset-4 hover:underline`). En la página de cuenta, `active="panel"` (computa como «Panel», escenario US2-3).
- Cada página sustituye su bloque `<nav>` local por `<GlobalNav active="…" month="…" />`; el h1 de cada página no cambia.

**Rationale**:
- La spec lo deja abierto («vive en el layout raíz o equivalente de presentación; su ubicación técnica exacta se decide en el plan»). El componente de servidor por página es el equivalente de presentación más simple: **cero JS de cliente**, cero hooks de navegación, y el mes ya está resuelto en cada página (prop explícita en lugar de inferirlo de la URL).
- Los layouts de servidor **no reciben `searchParams`** (docs de Next 16: un layout compartido no se re-renderiza en navegaciones cliente y quedaría con valores caducados). La única forma de leer el mes en un layout sería un cliente con `usePathname()` + `useSearchParams()`; `useSearchParams` exige frontera `<Suspense>` en prerender y la página 404 (estática, comparte layout raíz) rompería el build sin ella (docs verificadas en `node_modules/next/dist/docs/.../use-search-params.md`).
- «Persistente» se cumple en sentido de producto: mismo componente, mismos destinos, misma posición en el 100% de las páginas (SC-004); el punto de montaje por página es un detalle técnico que la spec delega al plan.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Cliente `GlobalNav` en `layout.tsx` con `usePathname` + `useSearchParams` | JS de cliente + `<Suspense>` obligatoria; la página 404 estática comparte layout y falla el build sin la frontera; el mes se re-deriva de la URL en cliente cuando ya está resuelto en servidor. |
| Nav en `layout.tsx` de servidor sin mes | Los layouts no reciben `searchParams`: se pierde la propagación del mes visible (FR-003, escenario US2-4) que hoy hacen los navs locales. |
| Mantener navs locales y añadir solo el enlace «Panel» | Duplicación que la spec pide eliminar expresamente («sustituyendo los navs locales duplicados»); SC-004 exige que ninguna página retenga un nav local. |

---

## 2. Propagación del contexto temporal en los enlaces (FR-003, escenario US2-4)

**Decision**: `month?` como única fuente del contexto temporal; reglas por página:

| Página | `month` pasado a `GlobalNav` | Resumen global → | Cuenta de resultados → |
|---|---|---|---|
| `/` (panel) | — (sin mes visible → `currentMonth()` interna) | `/summary?month={mes actual}` | `/annual?year={año actual}` |
| `/accounts/[id]?month=M` | `M` | `/summary?month=M` | `/annual?year={M.slice(0,4)}` |
| `/summary?month=M` | `M` | — (es el destino activo) | `/annual?year={M.slice(0,4)}` |
| `/annual?year=Y` | `${Y}-01` | `/summary?month={Y}-01` | — (es el destino activo) |

- «Panel» enlaza siempre a `/` sin query: el panel no depende del mes (edge case de la spec) y descarta cualquier residuo de la pasarela anterior.
- En `/annual`, la página pasa `${year}-01` **manteniendo la paridad con el nav local actual de `/annual`** (hoy enlaza `/summary?month=${year}-01`): la clarificación 2026-09-29 fija «conservar el mes… paridad con los navs locales actuales». Sin mes visible en la URL, el año visible es el mejor contexto disponible y evita el salto al mes real actual desde, p. ej., `/annual?year=2027`.

**Rationale**: FR-003 exige conservar el mes visible al navegar («igual que los navs locales actuales») y enlazar al mes/año actual cuando no lo hay; derivar `${year}-01` en `/annual` es exactamente lo que su nav local hace hoy — quitarlo sería un cambio funcional no pedido.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| `/annual` → Resumen global al mes actual real | Ruptura de la paridad con el nav local actual (la clarificación la pide); saltar de la vista del año 2027 a septiembre de 2026 pierde el contexto sin motivo. |
| Prop `year` adicional en `GlobalNav` | Dos props para el mismo concepto (contexto temporal) y dos reglas de composición de enlaces; `${year}-01` en el call site es una línea. |
| Estado de cliente compartido (mes «global» en contexto React) | Estado global para un dato que ya vive en la URL; complejidad no justificada (I). |

---

## 3. Renderizado dinámico del panel: `await connection()` (FR-002, SC-003)

**Decision**: la nueva `/` es un server component que llama **`await connection()`** (`next/server`) antes de `ListAccounts` y **no lee `searchParams`** (el panel ignora cualquier query residual, edge case de la spec).

**Rationale**:
- La página actual de `/` es dinánica *de facto* porque hace `await searchParams`. El panel nuevo ya no tiene por qué leer parámetros; sin ninguna API de petición, Next 16 prerenderizaría la ruta en `build` congelando las cuentas del momento del build — la spec exige «el panel muestra siempre las cuentas actuales en el momento de la petición» (assumption).
- `connection()` es la vía recomendada en Next 16 para ligar semánticamente el render al request (docs de `useSearchParams`: «prefer using the connection function»), sin código muerto ni flags de config. `revalidatePath("/")` de las Server Actions (FR-006) sigue presente como seguro adicional y no interfiere.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| `await searchParams` e ignorar el valor | Código muerto que finge leer parámetros para forzar dinamismo; menos explícito que `connection()`. |
| `export const dynamic = "force-dynamic"` | Enfoque sustituido por `connection()` en Next 16; flag de configuración en lugar de semántica de petición. |
| Dejar que prerenderice + confiar en `revalidatePath("/")` | El panel quedaría congelado en el build para altas de cuentas hechas fuera de las acciones (seed, BD, gestión 008 futura); revalida solo cuando alguien escribe un movimiento. |

---

## 4. El panel: `AccountCardGrid`, tarjeta lanzadora pura y rejilla responsiva (FR-001, FR-002, US1)

**Decision**: componente de servidor **`account-card-grid.tsx`** (`AccountCardGrid({ accounts })`, sin estado ni hooks) que renderiza:

- `<ul>` con `aria-label="Cuentas"` y rejilla responsiva `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`: escala vertical con más cuentas (edge case), sin máximo fijo.
- Una tarjeta por `AccountDTO` **en el orden de `ListAccounts`** (id ascendente, determinista — edge case): `<li>` cuyo contenido íntegro es un `Link` a `/accounts/${account.id}` **sin `?month=`** (la página de cuenta aplica su mes actual por defecto, FR-001).
- Contenido de la tarjeta: nombre de la cuenta (prominente) + etiqueta de tipo («Cuenta común» / «Cuenta personal de {miembro}»), las mismas cadenas que hoy usan el subtítulo de la página de cuenta y el selector jubilado. **Nada más**: sin balance, sin gasto del mes, sin estados de carga (lanzador puro, decisión del propietario 2026-09-29; tarjetas con y sin movimientos equivalentes, escenario US1-3).

**Rationale**:
- Componente extraído (y no un map inline en la página) para testear con RTL por separado, siguiendo el patrón del repo (p. ej. `account-balance`); la página queda como adaptador fino: `connection()` → `ListAccounts` → `GlobalNav` + `AccountCardGrid`.
- La redundancia nombre+tipo en la cuenta común («Cuenta común» × 2) ya existe hoy en la página de cuenta (h1 + subtítulo) y se conserva por consistencia; no se maquilla con condicionales.
- El tipo se deriva con la misma expresión que la página de cuenta (`type === "shared" ? "Cuenta común" : "Cuenta personal de ${memberName ?? "miembro"}`): presentación pura de un DTO existente, sin cálculo (FR-002, constitución VII).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Tarjetas con balance/gasto del mes (diseño original) | Retirado por decisión del propietario (2026-09-29): exigiría N queries de balance/cierre en `/` (vierte cálculo y consultas prohibidas por FR-002). |
| Card de shadcn/ui nueva | El catálogo local (`components/ui/`) no tiene Card; añadirla copia un componente para un caso trivial de Link+bordes que las clases Tailwind existentes ya resuelven. |
| Rejilla de 1 columna fija | Desperdicia el escritorio (prioritario, assumption heredada de 011) con 3 cuentas; `sm:2/lg:3` cubre 3 tarjetas en una fila y escala hacia abajo. |
| Selector/lista en vez de tarjetas | Exactamente lo que la spec retira de `/` (FR-001): el panel es la puerta de entrada sin selectores intermedios. |

---

## 5. Jubilaciones y conservaciones tras la sustitución de `/` (FR-004, FR-006)

**Decision**:

| Pieza | Acción | Motivo |
|---|---|---|
| `movement-list.tsx` (+ test) | **Eliminar** | Solo lo consumía la pasarela `/`; 011 ya anticipó su jubilación. `GroupedMovementList` queda como único listado. |
| `account-month-selector.tsx` (+ test) | **Eliminar** | Selector de cuenta jubilado con la pasarela; el selector de mes de `/` muere con él. |
| `MovementForm`, `MonthlyClosurePanel`, `AccountBalance`, `MonthStepper`, `GroupedMovementList` | **Conservar** | Los consume la página de cuenta (011) sin cambios. |
| `AccountBalance` (prop `subtitle` con valor por defecto) | **Conservar tal cual** | El valor por defecto queda sin uso en `/`, pero es una línea inofensiva de un componente reutilizable; tocarlo es churn sin valor. |
| Selector de cuenta del diálogo de edición (003) | **Conservar** | Es funcionalidad de edición (mover movimiento entre cuentas), no navegación; el ui-contract de 011 §1.3 ya lo fijó y FR-004 solo retira selectores/enlaces de cambio de cuenta de la página. |
| `revalidatePath("/")` en las 3 Server Actions | **Verificar que sigue presente** (sin cambios) | Excepción declarada en FR-006: mantiene el panel al día ante futuras altas de cuentas; los movimientos no alteran los datos del panel. |
| Schemas Zod de `account`/`month` en `page.tsx` | **Eliminar con la reescritura** | El panel no lee parámetros; `?month=` residual se ignora por diseño (§3). |

**Rationale**: la red de dependencias actual hace la limpieza segura (grep verificado: `MovementList` y `AccountMonthSelector` solo se importan desde `src/app/page.tsx` y sus tests). Eliminar reduce mantenimiento y evita UI muerta que pudiera confundir; el resto de la app no cambia (FR-004: «el resto de la página permanece sin cambios funcionales»).

**Alternatives considered**: conservar los componentes jubilados «por si acaso» (código muerto, YAGNI); o reescribir también `AccountBalance` para exigir `subtitle` (churn en un componente cerrado de 011 sin cambio funcional).

---

## 6. Estrategia e2e: puerta de entrada nueva, aserciones intactas (FR-005, SC-005, constitución III)

**Decision**: tres frentes sobre la BD determinista compartida (`workers: 1`, orden alfabético — AGENTS.md):

### 6.1 Helper común de entrada por el panel

Cada spec adaptada sustituye su `selectAccount` por un helper `openAccount(page, accountName)`: `goto("/")` → clic en el enlace-tarjeta `{accountName}` → `expect(heading {accountName})`. Cada prueba cubre así el flujo US1 (panel → página de cuenta en un clic, SC-001) además de su flujo propio. El cambio de mes dentro de la cuenta usa el `MonthStepper` existente (combobox `aria-label="Mes visible"` y opciones `monthLabel`, idénticos a los que los helpers actuales ya usan).

### 6.2 Ajuste por spec (entrada y fila nueva; sin debilitar aserciones)

| Spec | Cambio | Notas |
|---|---|---|
| `registro-movimientos.spec.ts` (flujo crítico) | `selectAccount` → `openAccount`; aserciones de fila «Gasto»/«Ingreso» retiradas (la fila de 011 no las muestra) — el tipo sigue verificado por el signo e importe («−850,00»/«+1500,00», ya asertados) y «Compartido» → «Común» (badge de naturaleza de 011). | Balances absolutos de Cuenta común (−850,00) y Miembro A (1379,50) intactos: en la página de cuenta el balance «Acumulado hasta {mes actual}» coincide con el histórico (ninguna spec escribe movimientos futuros en esas cuentas). Formulario, toasts y caso inválido (E4) idénticos. |
| `edicion-movimientos.spec.ts` | `openAccount("Cuenta de Miembro B")` + `selectMonth` vía stepper (mismos nombres de opción). | Diálogos, cierre y conteos idénticos; el estado vacío tras eliminar el último (E3) ya es asertado por `pagina-cuenta` con la misma UI (`region` count 0). |
| `cierre-mensual.spec.ts` | `openAccount("Cuenta de Miembro B")` (mes actual); E2 sigue saltando a 2025 con el picker «Mes visible». | KPIs exactos intactos; mismo combo cuenta/mes (B · mes actual). |
| `resumen-global.spec.ts` | `openAccount` por cuenta + `selectMonth("Junio de 2026")` en cada una; el clic final «Resumen global» usa el **nav global** de la página de cuenta y conserva la aserción de URL `/summary?month=2026-06` (cubre la propagación de mes de US2-4). | Totales globales de junio 2026 intactos; mismos combos ocupados. |
| `cuenta-resultados-anual.spec.ts` | `openAccount("Cuenta de Miembro B")` + `selectMonth` enero/julio 2027; el clic «Cuenta de resultados» usa el nav global (`/annual?year=2027`). | Tabla anual y desglose intactos; E5 (2028 vacío) ya entra por URL directa. |
| `pagina-cuenta.spec.ts` | P1–P7 intactos (entran por URL directa). **P8 se retira**: verificaba la pasarela `/` congelada (FR-007 de 011), que esta feature sustituye; su cobertura pasa a `panel-cuentas.spec.ts`. | — |

### 6.3 Nueva `e2e/panel-cuentas.spec.ts` (solo lectura → sin restricciones de aislamiento)

- **N1**: `/` muestra un enlace-tarjeta por cuenta del seed con nombre y tipo exactos («Cuenta personal de Miembro A/B», «Cuenta común»), sin importes (sin «€»), sin combobox «Cuenta activa», sin botón «Registrar», sin regiones «Movimientos del mes»/«Cierre de» (FR-001, US1-1/1-3/1-4).
- **N2**: clic en la tarjeta de Miembro B → URL `/accounts/2` (sin `?month=`), h1 visible, stepper en el mes actual real (› deshabilitado como proxy, ya asertado en 011-P4).
- **N3**: nav global en `/` con los 3 enlaces y «Panel» activo (`aria-current="page"`).
- **N4**: `/?month=2025-01` residual → panel normal, sin error.
- **N5** (US2 completa, por atributos, sin escribir): en `/accounts/2?month=2026-03`, hrefs de Resumen global → `/summary?month=2026-03` y Cuenta de resultados → `/annual?year=2026`, «Panel» activo; en `/summary?month=2025-01`, «Cuenta de resultados» → `/annual?year=2025` y «Resumen global» activo; en `/annual?year=2028`, «Resumen global» → `/summary?month=2028-01` y «Cuenta de resultados» activo.

**Rationale**: la sustitución de `/` rompe la pasarela que usaban 5 specs (goto `/` + comboboxes); adaptarlas por la puerta nueva mantiene viva la verificación end-to-end del flujo crítico de registro (constitución III) y de paso ejercita el panel en cada entrada. La spec nueva es de lectura pura (navegaciones y atributos), por lo que su posición alfabética es irrelevante para el aislamiento; las specs adaptadas conservan sus combinaciones cuenta/mes (B·mes actual para cierre, B·julio-agosto 2026 edición, 2026-06 global, B·2027 anual, común+A·mes actual registro) — sin solapamientos nuevos. Los enlaces del nav se verifican además por unidad (RTL) y las navegaciones reales con mes quedan cubiertas en resumen/anual.

**Alternatives considered**: reescribir las specs desde cero (pérdida de aserciones acumuladas — prohibido por FR-005); entrar siempre por URL directa `/accounts/{id}` sin pasar por el panel (dejaría US1 sin cobertura e2e); panel spec con escrituras (innecesario: el panel no tiene flujo de escritura; lo «a valorar» de la spec se resuelve con esta spec de lectura).

---

## 7. Accesibilidad del estado activo y de la tarjeta (assumption, US2-3)

**Decision**:
- Enlace activo con `aria-current="page"` (semántica estándar de página actual) + refuerzo visual `font-medium text-foreground` frente al `text-muted-foreground` de los inactivos: distinguible por color **y** por peso, sin animaciones (assumption de la spec).
- `<nav aria-label="Navegación principal">` como landmark único por página; las tarjetas son `Link` con nombre accesible completo (nombre + tipo de la cuenta); la rejilla es una lista (`ul`/`li`) navegable por teclado en orden de tabulación natural.

**Rationale**: la spec deja «accesibilidad del estado activo a valorar en el plan»: `aria-current` es la señal asistiva canónica y además la que `panel-cuentas.spec.ts` usa como criterio (N3/N5) — verificable sin depender del color.

**Alternatives considered**: solo cambio de color (débil para lectores de pantalla y para los propios e2e); subrayado del activo (convención de pestañas, aquí no hay pestañas); `aria-selected` (reservado a roles de selección, no a enlaces de navegación).

---

## Resumen de decisiones (trazabilidad)

| Tema | Decisión | Dónde |
|---|---|---|
| Navegación global | `GlobalNav({ active, month? })` de servidor renderizado por las 4 páginas; navs locales eliminados | research §1 · ui-contract §2 |
| Contexto temporal | Prop `month?` con `currentMonth()` por defecto; `/annual` pasa `${year}-01` (paridad con su nav local) | research §2 · ui-contract §2.2 |
| Dinamismo del panel | `await connection()` en `/`; sin lectura de `searchParams`; query residual ignorada | research §3 · ui-contract §1.1 |
| Panel/tarjeta | `AccountCardGrid` server; rejilla `sm:2/lg:3`; Link completo a `/accounts/{id}` sin mes; nombre+tipo, sin datos financieros | research §4 · ui-contract §1 |
| Jubilaciones | `movement-list` y `account-month-selector` (+tests) eliminados; resto conservado; `revalidatePath("/")` verificado | research §5 |
| E2E | Helper `openAccount` por el panel; 6 specs adaptadas sin debilitar aserciones; nueva `panel-cuentas.spec.ts` de lectura | research §6 · quickstart |
| Accesibilidad | `aria-current="page"` + refuerzo tipográfico; nav landmark; tarjetas como lista de enlaces | research §7 · ui-contract §4 |
