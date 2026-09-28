# Research: Página de Cuenta

**Feature**: `011-pagina-cuenta` | **Fecha**: 2026-09-27

Investigación de Phase 0 para resolver las incógnitas del Technical Context del [plan.md](./plan.md). Sin incógnitas tecnológicas nuevas (stack fijado por 002–009 y la constitución): las decisiones son de **enrutado y política 404, corte de fecha del balance, agrupación por fecha como presentación, selector ‹ ›, revalidación de la ruta nueva en las Server Actions y aislamiento e2e**. Cada sección documenta: decisión, racional y alternativas consideradas.

---

## 1. Ruta, resolución de cuenta y política 404 (FR-001, SC-001)

**Decision**: ruta dinámica **`src/app/accounts/[accountId]/page.tsx`** servida en **`/accounts/{accountId}?month=YYYY-MM`**, server component async fino con el patrón ADR 0008 de validación de parámetros:

- `params: Promise<{ accountId: string }>` y `searchParams: Promise<{ month?: ... }>` — en Next 16 ambos son promesas y se resuelven con `await` (verificado en `node_modules/next/dist/docs/.../page.md`).
- **`accountId`**: Zod `/^\d+$/` → `Number`. La cuenta se resuelve contra `ListAccounts().execute()` (ya necesario para el selector de cuentas del diálogo de edición): `accounts.find((a) => a.id === parsed)`. Si el parámetro no parsea **o** la cuenta no existe → **`notFound()`** (404 explícito, clarificación 2026-09-27). `notFound()` lanza `NEXT_HTTP_ERROR_FALLBACK;404` desde el render path y añade `noindex` (docs de Next 16 verificadas) — exactamente la semántica pedida: una URL inválida nunca degrada a otra cuenta.
- **`month`**: mismo esquema Zod que `/` (`/^\d{4}-(0[1-9]|1[0-2])$/`) con fallback a `currentMonth()` si es inválido o ausente (misma regla que `/` hoy).

**Rationale**:
- La spec delega la validación de la ruta concreta al plan (FR-001): `[accountId]` es la convención App Router para segmento dinámico; `page.tsx` es el único directorio que Next rutea y ya aloja `/summary` y `/annual` — el patrón de adaptador inbound fino está asentado (ADR 0002/0008).
- Resolver la cuenta desde `ListAccounts` en lugar de `AccountRepository.findById` evita una query extra: la página necesita `AccountDTO[]` de todos modos (subtítulo con `memberName`, selector de cuenta del diálogo de edición de 003) — una sola fuente, mismo patrón que `src/app/page.tsx`.
- Diferencia deliberada con `/`: allí un `account` inválido hace fallback a la primera cuenta personal (comportamiento conservado, FR-007); aquí la URL es identidad del recurso → 404.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| `/accounts?id=` con query param en vez de segmento | URL menos bookmarkable y semánticamente pobre para un recurso «cuenta»; el segmento dinámico es la convención App Router para identificadores de recurso. |
| `findById` + query separada de cuentas | Doble lectura para los mismos datos; `findById` devuelve la entidad de dominio sin `memberName` (está en el DTO con join). |
| Fallback a otra cuenta ante id inválido | Prohibido por clarificación 2026-09-27 (bookmark caducado mostraría otra cuenta en silencio). |

---

## 2. Balance acumulado a fin de mes: extensión del puerto `getBalance(id, asOf?)` (FR-006)

**Decision**: ampliar el puerto **`AccountRepository`** (capa de aplicación) con un parámetro opcional:

```text
getBalance(id: AccountId, asOf?: string): Promise<number>
// asOf: fecha ISO 'YYYY-MM-DD' INCLUSIVE; undefined = histórico total (comportamiento actual)
```

- `DrizzleAccountRepository.getBalance` añade `lte(movements.date, asOf)` a la cláusula `where` existente cuando `asOf` está presente; la agregación SQL (sum con signo por tipo) no cambia.
- La página calcula el corte con un helper puro nuevo en `format.ts`: **`monthEndIsoDate(month: string): string`** (p. ej. `2026-04` → `2026-04-30`; febrero bisiesto correcto por construcción con `Date(year, month, 0)`), y llama `getBalance(AccountId(id), monthEndIsoDate(month))`.
- `/` sigue llamando `getBalance(id)` sin corte: histórico total intacto (FR-007).

**Rationale**:
- La clarificación 2026-09-27 fija el requisito (acumulado hasta el mes consultado, coherente con el cierre) y la propia spec sugiere esta firma (`p. ej. getBalance(accountId, asOf?)`). El parámetro opcional mantiene binaria la compatibilidad: los implementadores actuales (Drizzle y dobles de tests) siguen cumpliendo el contrato sin cambios forzosos, y TypeScript acepta una implementación que ignore el segundo parámetro.
- El corte por **fecha exacta** (fin de mes) en lugar de por mes es más primitivo y no añade una semántica nueva de calendario al puerto: la derivación de «último día del mes» es un cálculo de presentación que vive en el adaptador (`format.ts`), junto a `currentMonth`/`buildMonthWindow` que la página de `/` ya usa server-side. El dominio no se entera (FR-009).
- Rendimiento: la query ya filtra por `accountId`; el índice existente `(account_id, date)` cubre `eq(accountId) + lte(date)` — sin migraciones ni índice nuevo (FR-009).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Método nuevo `getBalanceThroughMonth(accountId, month)` | Duplica la query solo para cambiar el rango; la semántica de mes exigiría al adaptador derivar el fin de mes (lógica de calendario en el adaptador de salida, peor que un parámetro fecha explícito). |
| Calcular el acumulado en dominio/aplicación sumando `listByMonthAndAccount` | Exigiría cargar **toda la historia** de la cuenta (N meses → N queries o un método `listAll` nuevo) para sumar lo que una única query agregada ya responde; contradice el patrón ADR 0009 (balance derivado calculado por el repositorio). |
| Caso de uso nuevo `GetAccountBalance` | Envoltorio sin reglas: la página de `/` ya llama `accountRepository.getBalance` directamente (adaptador fino orquesta lecturas simples); no hay lógica de aplicación que proteger. |

---

## 3. Agrupación por fecha y rediseño de fila: componente nuevo `GroupedMovementList` (FR-002, FR-003, FR-004)

**Decision**: componente cliente nuevo **`grouped-movement-list.tsx`** (`GroupedMovementList`) para la página de cuenta. Recibe los mismos props que `MovementList` (`movements`, `accounts`, `tags`, `currentAccountId`, `currentMonth`) y:

- **Agrupa en presentación**: un `reduce` sobre el orden que ya devuelve `ListMovements` (`date DESC, id DESC`) produce los grupos de fecha en orden de aparición (más reciente primero) preservando el orden interno (último registrado primero). Sin nueva query, sin lógica de dominio (FR-002/FR-009).
- **Fila rediseñada**: tags en píldoras como elemento prominente arriba; la nota en texto pequeño debajo — `concepto` y, si existe `description`, `" · " + descripción` (p. ej. «Mercadona · compra semanal», escenario 3); importe a la derecha con `formatSignedAmountCents` y color semántico (`text-red-600` gasto / `text-emerald-600` ingreso, clases ya usadas); distintivo sutil de naturaleza **solo en gastos**: «Personal» / «Común». Sin texto «Gasto/Ingreso» (edge case de la spec).
- **Cabecera de grupo**: `<h3><time dateTime={date}>{formatDate(date)}</time></h3>` («5 de abril de 2026») — `<time>` semántico exigido por la assumption de la spec, formato existente `formatDate` (día, mes largo, año).
- **Diálogos y vacío según convención** (FR-004): `EditMovementDialog`/`DeleteMovementDialog` montados a nivel del componente listado con el DTO en estado del cliente; `EmptyState` renderizado dentro del propio componente (nunca swap en la página). Botones «Editar {concepto}»/«Eliminar {concepto}» y `data-testid="movement-item"` conservados.

`movement-list.tsx` (el listado plano de `/`) **no se toca**: FR-007 conserva `/` intacta hasta `012-panel-cuentas`.

**Rationale**:
- La agrupación es presentación pura sobre datos ya ordenados: constitu­ción VII permite expresamente «la UI agrupa y formatea»; hacerlo en el componente evita tocar aplicación/dominio (FR-009).
- Componente nuevo en lugar de rediseñar el compartido: rediseñar `movement-list.tsx` cambiaría la presentación de `/` (FR-007 pide comportamiento intacto y SC-004 exige los e2e existentes en verde **sin tocarlos** — `registro-movimientos.spec.ts` afirma textos de fila que el rediseño elimina, p. ej. «Gasto»/«Ingreso»). La duplicación es acotada (el cableado de diálogos, ~30 líneas) y **temporal**: `012-panel-cuentas` sustituye `/` y jubila el listado plano.
- El distintivo usa «Común»/«Personal» (rediseño UX de la spec) frente al «Compartido» actual del listado plano: contratos en [contracts/ui-contract.md](./contracts/ui-contract.md).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Rediseñar `movement-list.tsx` compartido para ambas páginas | Rompe aserciones de los e2e de `/` (SC-004 exigiría reescribir specs de features cerradas) y amplía el alcance de 011 a la pasarela que la spec deja congelada. |
| Agrupar en un caso de uso / DTO `MovementDateGroupDTO` | Nueva forma de aplicación para un criterio de presentación que cambia con el rediseño; la agrupación no es regla de negocio (FR-002 la llama explícitamente «presentación»). |
| Subtotales por día | Rechazado por el propietario (edge case de la spec, 2026-09-27). |

---

## 4. Selector de mes ‹ › + salto directo: `MonthStepper` (FR-005)

**Decision**: componente cliente nuevo **`month-stepper.tsx`** (`MonthStepper({ accountId, month })`), espejo de los selectores existentes (`month-selector.tsx` de 006, `account-month-selector.tsx` de 002):

- **‹** (`aria-label="Mes anterior"`) siempre activo; **›** (`aria-label="Mes siguiente"`) con `disabled={month >= currentMonth()}` (comparación léxica `YYYY-MM` válida): nunca se navega al futuro desde la UI, incluida una URL directa a un mes futuro (de ahí `>=` y no `===`).
- **Picker** de salto directo: `Select` shadcn con `aria-label="Mes visible"`, opciones `buildMonthWindow(month, 24)` **truncadas en el mes actual real** (p. ej. `buildMonthWindow(month, 24).filter((m) => m <= currentMonth())`) con `monthLabel`: el tope de futuro aplica a todos los controles de la UI (clarificación 2026-09-28); una URL directa a un mes futuro sigue resolviendo (vacío + balance heredado, › deshabilitado desde él).
- Navegación: `router.replace(\`/accounts/${accountId}?month=${next}\`)` dentro de `startTransition` (mismo patrón y feedback `isPending` de los selectores existentes): la URL cambia (bookmarkable, SC-001) sin cambiar de vista.
- Helper puro nuevo `shiftMonth(month, delta)` en `format.ts` para mes anterior/siguiente (cruce de año incluido), testeado junto a `monthEndIsoDate`.

**Rationale**:
- La spec exige los tres affordances (‹, › acotado y picker) en la misma página manteniendo la cuenta: un único componente con `accountId` en props los cubre sin estado compartido.
- `replace` (no `push`): cada mes no apila historial de navegación, igual que los selectores actuales — la «página» es la cuenta, el mes es un estado de la URL.
- `>=` para deshabilitar › cubre también el mes futuro alcanzado por URL directa (edge case): desde él solo se puede ir hacia atrás.

**Alternatives considered**:

| Opción | Contras |
|---|---|
| Solo picker (sin ‹ ›) | La US exige la navegación ‹ › explícitamente («selector ‹ mes/año ›»). |
| `push` en vez de `replace` | Apila cada mes en el historial del navegador; inconsistentes con los selectores de 002/006. |
| Componente compartido parametrizado por «builder de URL» | Abstracción prematura (I): `MonthSelector` (006) y este difieren en el acotado de futuro y en el prop `accountId`; se unificará si 012/013 lo piden. |

---

## 5. Revalidación de la ruta nueva en las Server Actions (FR-004, FR-005, SC-004)

**Decision**: las tres acciones (`create-movement`, `update-movement`, `delete-movement`) añaden junto al `revalidatePath("/")` existente:

```ts
revalidatePath("/accounts/[accountId]", "page");
```

Patrón de ruta dinámica + `type: "page"` (documentado en Next 16): invalida **todas** las páginas que casan con el patrón, sin conocer el id concreto. Los tests de las acciones amplían sus aserciones para esperar ambas llamadas.

**Rationale**:
- Desde la página de cuenta, editar/eliminar/registrar debe recalcular listado, cierre y balance **en esa misma vista** (escenario 5); sin revalidar la ruta, el `router.replace` del stepper o el re-render devolverían datos cacheados.
- El patrón dinámico evita que la acción tenga que resolver el `accountId` afectado: `update` puede mover un movimiento de cuenta (el id final difiere del contexto), `delete` no recibe cuenta — la invalidación por patrón es correcta y suficiente a escala familiar.
- `type: "page"` es obligatorio cuando el path contiene un segmento dinámico (docs de Next 16).

**Alternatives considered**:

| Opción | Contras |
|---|---|
| `revalidatePath` literal con el id (p. ej. `/accounts/2`) | Exige resolver la cuenta afectada en `update`/`delete` (queries extra o devolver el id desde el caso de uso) para ganar nada a escala familiar. |
| `revalidatePath("/", "layout")` desde la raíz | Invalida todo el árbol de rutas: escopeta en lugar de cirugía; el patrón de `/accounts/[accountId]` ya existe como convención soportada. |
| `router.refresh()` en el cliente tras el toast | Acopla los componentes a la invalidación y deja la URL recargable con datos obsoletos. |

---

## 6. Accesibilidad del color y semántica de la fila (FR-003, edge case de la spec)

**Decision**: el tipo (gasto/ingreso) se comunica con **dos señales**: color (rojo/verde, clases existentes) **y signo** (`−` U+2212 / `+` de `formatSignedAmountCents`) — el signo es la alternativa no cromática. La naturaleza usa texto («Personal»/«Común») con contraste `text-muted-foreground` sobre fondo `secondary`, y las cabeceras de grupo usan `<time dateTime>` con formato largo en español. Importes con `tabular-nums` (FR-010) y todo el texto de UI en español.

**Rationale**:
- La spec deja «accesibilidad del color a valorar en el plan»: el signo ya presente en el importe resuelve el caso de contraste de color/daltonismo sin añadir texto redundante que el rediseño elimina deliberadamente («Gasto/Ingreso»).
- `text-red-600`/`text-emerald-600` son los colores semánticos ya aceptados en el listado actual y en el balance (convención reutilizada, assumption de la spec).

**Alternatives considered**: icono adicional por tipo (ruido visual frente a las señales existentes); `aria-label` por fila duplicando el signo (ya visible); patrón de rayado para daltónicos (excesivo para texto, no aplica).

---

## 7. Estrategia de tests y aislamiento e2e (constitución III, SC-004)

**Decision**: cinco niveles con los patrones del repo:

1. **Helpers** (`format.test.ts`, ampliación): `monthEndIsoDate` (mes de 30/31, febrero bisiesto, diciembre) y `shiftMonth` (cruce de año en ambas direcciones, borde enero/diciembre).
2. **Persistencia** (`DrizzleRepositories.test.ts`, ampliación): `getBalance` con `asOf` contra libsql `:memory:` — corte inclusive (movimiento fechado exactamente el `asOf` computa), movimientos posteriores excluidos, sin `asOf` = histórico total (regresión).
3. **UI jsdom + RTL**: `grouped-movement-list.test.tsx` (agrupación y orden de grupos/filas, nota concatenada con « · », badge de naturaleza solo en gastos, colores por tipo, diálogos al nivel del listado, estado vacío interno — Server Actions mockeadas con `vi.mock`, patrón de `movement-list.test.tsx`) y `month-stepper.test.tsx` (‹ navega al mes anterior en la URL de la cuenta, › deshabilitado en el mes actual y en meses futuros, picker salta al mes elegido sin ofrecer meses futuros).
4. **Acciones** (ampliación): aserciones de `revalidatePath` esperando `("/")` **y** `("/accounts/[accountId]", "page")` en los caminos de éxito (§5).
5. **E2E** (`e2e/pagina-cuenta.spec.ts`, nueva): fichero nuevo, serie dentro del fichero (convención del repo). **Aislamiento**: opera sobre **Cuenta de Miembro B en abril 2026** (`2026-04`), combinación propia:
   - `registro-movimientos.spec.ts` afirma **balances históricos absolutos** de Cuenta común (−850,00) y de Miembro A (1379,50) → esta spec **no escribe** en esas cuentas (ningún mes).
   - Meses/combos ocupados por el resto: B mes actual real (cierre), B julio/agosto 2026 (edición), 2026-06 todas las cuentas (resumen global), 2025-01 global vacío (resumen), B 2027 (anual). Abril 2026 en B queda libre y **anterior** a todos los meses con datos de otras specs, lo que hace deterministas los balances con corte `asOf` de marzo/abril 2026.
   - Cobertura: registro vía formulario embebido en la página, agrupación (dos fechas + dos movimientos el mismo día → orden interno por registro), rediseño de fila, edición y eliminación con recálculo en la propia página, ‹ a marzo 2026 (vacío + balance heredado 0,00 €), › activo desde abril, › deshabilitado en el mes actual real, URL directa a mes futuro (válida, vacía), 404 de `/accounts/999` y `/accounts/abc`, `month` inválido → fallback a mes actual, `/` sin cambios (cubierta por sus specs existentes, intactas).

**Rationale**: el e2e cubre el flujo nuevo de punta a punta (navegación de meses + agrupación + 404) con cifras exactas donde son deterministas (balances con corte en abril/marzo 2026) y aserciones estructurales donde no (mes futuro, que incluiría datos de specs previas dependiendo de la fecha real de ejecución). El resto de niveles protege las reglas más barato (corte inclusive del `asOf`, bordes de calendario, deshabilitado de ›).

**Alternatives considered**: e2e sobre Cuenta común (contaminaría el balance histórico absoluto que `registro-movimientos` afirma); e2e en el mes actual real (colisiona con `cierre-mensual` en B y con la fecha del runner); no añadir e2e (la spec lo deja «a valorar»: la navegación de meses con URL y el 404 son comportamiento de ruta nuevo con riesgo de regresión propio — constitución III lo ampara como flujo de usuario).

---

## Resumen de decisiones (trazabilidad)

| Tema | Decisión | Dónde |
|---|---|---|
| Ruta y 404 | `/accounts/[accountId]?month=`; id inválido/inexistente → `notFound()`; mes inválido → mes actual | research §1 · ui-contract §1 |
| Balance acumulado | Puerto `AccountRepository.getBalance(id, asOf?)` (fecha inclusive) + helper `monthEndIsoDate` | research §2 · data-model §2 |
| Listado | `GroupedMovementList` nuevo (agrupación en presentación, fila rediseñada, diálogos de 003, vacío interno); `movement-list.tsx` intacto para `/` | research §3 · ui-contract §2–3 |
| Selector de mes | `MonthStepper` (‹ › + picker; › deshabilitado en mes ≥ actual; `router.replace` preservando cuenta) + `shiftMonth` | research §4 · ui-contract §4 |
| Revalidación | `revalidatePath("/accounts/[accountId]", "page")` añadido a las 3 acciones | research §5 |
| Accesibilidad color | Signo +/− como señal no cromática; naturaleza como texto | research §6 · ui-contract §3 |
| Tests / e2e | 5 niveles; e2e nuevo en B · abril 2026 (aislamiento verificado) | research §7 · quickstart |
