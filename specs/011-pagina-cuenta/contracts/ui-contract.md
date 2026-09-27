# Contrato de UI: Página de Cuenta

**Feature**: `011-pagina-cuenta` | **Ruta**: `/accounts/{accountId}?month=YYYY-MM` (`src/app/accounts/[accountId]/page.tsx`, server) | **Componentes**: `MonthStepper`, `GroupedMovementList` (client) + `AccountBalance`, `MonthlyClosurePanel`, `MovementForm` (server, reutilizados)

Página propia por cuenta sobre la funcionalidad de 002/003/005; `/` queda intacta como pasarela (FR-007). La extensión del balance (`asOf`) se detalla en [data-model §2](../data-model.md); la agrupación en [data-model §1.2](../data-model.md).

---

## 1. Ruta, resolución y estados de error (FR-001, SC-001)

### 1.1 Parámetros

| Parámetro | Regla | Comportamiento |
|---|---|---|
| `accountId` (path) | `/^\d+$/` + cuenta existente | Inválido o inexistente → **404** (`notFound()`): nunca muestra otra cuenta |
| `month` (query) | `/^\d{4}-(0[1-9]|1[0-2])$/` | Ausente o inválido → **mes actual** (mismo fallback que `/`) |

- URL estable y bookmarkable: refrescar/navegar meses no cambia de página (`router.replace`).
- URL directa a mes futuro o anterior al primer movimiento: **válida** (estado vacío + balance heredado; edge cases de la spec).

### 1.2 Estructura de la página (orden vertical)

```text
┌──────────────────────────────────────────────────────────┐
│ Family Wallet                          Resumen global ·  │  ← nav existente (enlaces a /summary y /annual,
│                                          Cuenta de      │     con el mes/año del contexto)
│                                          resultados     │
│ Cuenta de Miembro B                                      │  ← h1: nombre de la cuenta
│ Cuenta personal de Miembro B                             │  ← subtítulo (texto pequeño, memberName/«Cuenta común»)
├──────────────────────────────────────────────────────────┤
│ ‹  [ Abril de 2026 ▾ ]  ›                                │  ← MonthStepper (§4)
├──────────────────────────────────────────────────────────┤
│ Balance de Cuenta de Miembro B                           │  ← AccountBalance (reutilizado, §2.4)
│ 1.920,00 €                                               │
│ Acumulado hasta Abril de 2026                            │  ← único cambio de texto del componente
├──────────────────────────────────────────────────────────┤
│ [Formulario de registro embebido (002, sin cambios)]     │  ← MovementForm (FR-008)
├──────────────────────────────────────────────────────────┤
│ [Panel de cierre mensual (005, sin cambios funcionales)] │  ← MonthlyClosurePanel
├──────────────────────────────────────────────────────────┤
│ Movimientos del mes                                      │  ← GroupedMovementList (§2)
│                                                          │
│ 5 de abril de 2026                                       │  ← grupo de fecha (<time>)
│ [Alimentación]                −85,00 €                   │  ← fila (§2.2)
│   Mercadona · compra semanal              Común          │
│                                                          │
│ 2 de abril de 2026                                       │
│ [Ocio] [Sin Clasificar]        +50,00 €                  │
│   Devolución                                    (sin     │
│                                                 badge)   │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Selector de cuenta

La página de cuenta **no tiene selector de cuenta**: la identidad es la URL. El cambio de cuenta se hace desde `/` (pasarela) o navegando a la URL de otra cuenta — el selector desaparece definitivamente en `012-panel-cuentas`. El selector de cuenta **del diálogo de edición** (mover movimiento entre cuentas, 003) se conserva dentro del diálogo, alimentado por `AccountDTO[]`.

---

## 2. Listado agrupado por fecha — `GroupedMovementList` (FR-002, FR-003, FR-004)

### 2.1 Agrupación y orden

- Un grupo por **fecha del movimiento** (campo `date`), el más reciente arriba; dentro de cada día, el último registrado primero (`id DESC`).
- Cabecera de grupo: `<h3><time dateTime="YYYY-MM-DD">5 de abril de 2026</time></h3>` (`formatDate` existente: día, mes largo, año).
- **Sin subtotal de gastos por día** (decisión del propietario 2026-09-27).
- Movimiento editado y cambiado de mes desaparece del grupo y aparece en su nuevo mes (recálculo de 003).

### 2.2 Fila (rediseño UX)

| Zona | Contenido | Reglas |
|---|---|---|
| Identificador | Tags en píldoras (`rounded-full bg-secondary`) | Elemento prominente de la fila; «Sin Clasificar» se pinta como cualquier otra tag; movimientos con varias tags muestran todas |
| Nota (debajo, texto pequeño `text-muted-foreground`) | `{concepto}` + `" · " + {descripción}` si existe | P. ej. «Mercadona · compra semanal»; interina hasta `014-formulario-nota-tags` |
| Importe (derecha) | `formatSignedAmountCents` → `−85,00 €` / `+1.920,00 €` | `tabular-nums` (FR-010); rojo (`text-red-600`) si gasto, verde (`text-emerald-600`) si ingreso |
| Distintivo de naturaleza | «Personal» / «Común» | **Solo gastos**, sutil (píldora pequeña `text-muted-foreground`); los ingresos no lo muestran |
| Acciones | Botones ✏️ «Editar {concepto}» / 🗑️ «Eliminar {concepto}» | Abren los diálogos de 003 |

- **Sin texto «Gasto»/«Ingreso»**: el tipo se comunica por color **y signo** (+/−) — doble señal accesible (research §6).
- Cada fila conserva `data-testid="movement-item"` y es `listitem` dentro de su grupo (`ul` por grupo), bajo una sección `aria-labelledby="movement-list-title"` «Movimientos del mes» (rol `region` usado por los e2e).

### 2.3 Diálogos y estado vacío (convención del repo, FR-004)

- `EditMovementDialog`/`DeleteMovementDialog` montados **a nivel del componente listado** (estado del cliente con el DTO capturado), nunca dentro de la fila.
- **Estado vacío** (`EmptyState`: «Aún no hay movimientos en este mes.») renderizado **dentro del propio `GroupedMovementList`**, nunca como swap condicional en la página (AGENTS.md; tras eliminar el último movimiento visible, el toast y el cierre del diálogo deben llegar).
- Tras confirmar edición/eliminación: `revalidatePath("/accounts/[accountId]", "page")` recalcula listado, cierre y balance en la propia vista.

### 2.4 Balance (FR-006)

- Componente `AccountBalance` reutilizado con un único texto nuevo: subtítulo **«Acumulado hasta {Mes de YYYY}»** (p. ej. «Acumulado hasta Abril de 2026», `monthYearLabel`) en lugar de «Histórico completo de la cuenta (ingresos − gastos)» — el componente acepta el subtítulo como prop; `/` pasa el texto histórico actual (FR-007).
- Valor: `getBalance(accountId, monthEndIsoDate(month))` — solo movimientos con fecha ≤ último día del mes consultado, coherente con el cierre del panel.
- Mes anterior al primer movimiento: balance 0,00 € heredado (cierre de 005 con ceros).

---

## 3. Textos exactos (FR-010)

| Elemento | Texto/Formato |
|---|---|
| h1 | `{Nombre de la cuenta}` (p. ej. «Cuenta de Miembro B») |
| Subtítulo | «Cuenta personal de {miembro}» / «Cuenta común» |
| Nav | «Resumen global» → `/summary?month={month}` · «Cuenta de resultados» → `/annual?year={año}` (existentes) |
| Título del listado | «Movimientos del mes» |
| Cabecera de grupo | `{D} de {mes largo} de {YYYY}` («5 de abril de 2026») |
| Naturaleza | «Personal» / «Común» |
| Nota de fila | `{concepto}` o `{concepto} · {descripción}` |
| Importe | `−{importe} €` / `+{importe} €` (`Intl es-ES`, 2 decimales, U+2212, `tabular-nums`) |
| Balance | label «Balance de {cuenta}» + subtítulo «Acumulado hasta {Mes de YYYY}» |
| Vacío | «Aún no hay movimientos en este mes.» + «Registra el primero con el formulario superior.» (EmptyState existente) |
| 404 | Página 404 por defecto de Next (`notFound()`); sin UI personalizada en esta fase |

## 4. Selector de mes — `MonthStepper` (FR-005)

- **‹** («Mes anterior»): siempre activo; navega a `/accounts/{id}?month={shiftMonth(month, -1)}`.
- **›** («Mes siguiente»): navega a `shiftMonth(month, +1)`; **`disabled` cuando `month >= currentMonth()`** (mes actual real → nunca futuro desde la UI; también deshabilitado si se llegó por URL a un mes futuro — desde él solo se retrocede).
- **Picker**: `Select` con `aria-label="Mes visible"`, opciones `buildMonthWindow(month, 24)` etiquetadas con `monthLabel` («Abril de 2026») — salto directo a un mes arbitrario, incluidos futuros (misma regla que `/` actual: URL directa válida).
- Navegación con `router.replace` + `startTransition` (feedback `opacity-60` en `isPending`), preservando `accountId`; la cuenta nunca cambia al navegar meses.

## 5. Accesibilidad y responsive

- Sección del listado como `region` con `aria-labelledby`; grupos con `h3` + `<time dateTime>`; botones de acción con `aria-label` descriptivo («Editar Mercadona»).
- Doble señal para el tipo (color + signo +/−); naturaleza como texto legible (no solo color).
- `tabular-nums` en todos los importes; foco visible en botones/select (componentes shadcn existentes).
- Escritorio primero (assumption): columna única `max-w-4xl` como `/`; en móvil la fila se apila (tags arriba, nota, importe) sin scroll horizontal; usable sin optimización específica.

## 6. Fuera de este contrato

Landing `/` con tarjetas y nav global (`012`); CTA en diálogo (`013`); nota única y chips (`014`); subtotales diarios y paginación (out of scope de la spec); UI 404 personalizada; dark mode.
