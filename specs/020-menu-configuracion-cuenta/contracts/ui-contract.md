# Contrato de UI: Menú de configuración en las tarjetas de cuenta

**Feature**: `020-menu-configuracion-cuenta` | **Componentes**: `account-card-grid.tsx` (MODIFICADO → client), `regular-income-config-dialog.tsx` (NUEVO, extraído), `components/ui/dropdown-menu.tsx` (NUEVO, shadcn), `src/app/page.tsx` (MODIFICADO), `src/app/accounts/[accountId]/page.tsx` (MODIFICADO: sin panel) | **Retirado**: `regular-income-panel.tsx` | **Intactos**: Server Action `configureRegularIncome`, dominio, aplicación, repositorio, BD, `/summary`, `/annual`

Congela literales y comportamientos de la feature. El diálogo de configuración es **exactamente** el de [018 ui-contract §3–§5](../../018-ingresos-regulares/contracts/ui-contract.md) (campos, defaults, validaciones con mensajes exactos, intents `save`/`deactivate`, toasts, revalidación): no se redefinen aquí, solo su punto de montaje. Todo lo no mencionado queda como en 018 y en los contratos previos que esta extiende.

---

## 1. El menú ⋮ en la tarjeta (FR-001, escenarios 1, 4, 5; edges clic, dos cuentas, móvil)

- **Solo cuentas personales** muestran el botón ⋮ (icono vertical de tres puntos, sin texto visible), esquina superior derecha de la tarjeta, objetivo táctil ≥ 44 px, con nombre accesible único: **`Configuración de {nombre de la cuenta}`** (p. ej. «Configuración de Cuenta de Miembro A»).
- **La cuenta común no tiene menú**: ni trigger ni ítems (FR-001).
- El menú (Radix DropdownMenu, portal) abre con clic, Enter y Espacio; el trigger con el menú abierto **lo cierra** (toggle); Escape, clic fuera y pérdida de foco cierran sin navegar ni abrir diálogo (escenario 8). El contenido se reposiciona para no salirse del viewport (edge móvil).
- El índice del menú por tarjeta es **independiente**: abrir el de una cuenta no afecta al de la otra (edge «dos cuentas personales»).
- **La tarjeta sigue siendo lanzador** (FR-003): pulsar cualquier punto de la tarjeta fuera del ⋮ navega a `/accounts/{id}`. El ⋮ nunca navega (patrón stretched-link: el botón no está dentro del `<a>`). Los 3 enlaces conservan su nombre accesible `{nombre}\n{etiqueta de tipo}`.

## 2. Ítem «Ingreso regular» y su estado (FR-001, escenarios 1–3, 7)

```text
┌─ ⋮ Configuración de Cuenta de Miembro A ─────┐
│  Ingreso regular                    Activa   │   ← estado atenuado, alineado a la derecha
└──────────────────────────────────────────────┘
```

- Único ítem del menú: **«Ingreso regular»**, con el estado en el propio ítem como texto atenuado. Literales congelados: **«Sin configurar»** (sin config) · **«Activa»** (config activa) · **«Desactivada»** (config inactiva). El nombre accesible del ítem contiene etiqueta y estado (p. ej. «Ingreso regular Activa»).
- Seleccionar el ítem: cierra el menú y **abre el diálogo de configuración de 018** — vacío si «Sin configurar» (importe vacío, día `1`, nota vacía con placeholder «Ingreso regular de {miembro}»), precargado con los valores si hay config (escenarios 2–3, edge «config inactiva»: precargado con la opción de reactivar editando y guardando).

## 3. Diálogo (FR-002) — reutilizado íntegro de 018

- Mismos campos, defaults, validaciones y **mensajes exactos** ([018 §4](../../018-ingresos-regulares/contracts/ui-contract.md)), botones submit `name="intent"`: **«Guardar»** (`save`) y, con config activa, **«Desactivar»** (`deactivate`); «Cancelar» cierra sin guardar; `isPending` deshabilita y muestra «Guardando…».
- Éxito: toasts **«Ingreso regular guardado»** / **«Ingreso regular desactivado»**, cierre del diálogo; `revalidatePath("/", "layout")` refresca `/` (estado del ítem al reabrir el menú, SC-002) y las vistas en caché; la materialización del mes en curso sigue disparándose solo al abrir la página de la cuenta (ADR 0016, FR-004).
- Error de validación: diálogo abierto, errores `role="alert"` por campo y **valores conservados**; el menú lanzador ya está cerrado (edge).
- La **desactivación directa del panel desaparece** con el panel: la única vía es el botón «Desactivar» del diálogo (escenario 3 de la spec).

## 4. Panel de cuentas (`/`) y página de cuenta (FR-004)

- `/`: tarjetas con nombre, etiqueta de tipo y — solo personales — el ⋮. **Sin badges ni indicadores de configuración en la tarjeta** (decisión del propietario): el estado vive solo dentro del menú. Siguen sin pintarse importes (`€`), combobox de cuenta ni región de movimientos (e2e N1 enmendado).
- Página de cuenta personal: **solo movimientos, cierre y balance**; el panel «Ingreso regular» (y su `data-testid="regular-income-panel"`) desaparecen de todas las cuentas y meses; la materialización del mes consultado no cambia (FR-004).

## 5. Seletores estables para tests

| Elemento | Selector |
|---|---|
| Trigger del menú de una cuenta | `getByRole("button", { name: "Configuración de Cuenta de Miembro A" })` |
| Ítem del menú | `getByRole("menuitem", { name: /Ingreso regular/ })` (+ literal de estado) |
| Diálogo | `getByRole("dialog", { name: "Ingreso regular" })` con labels «Importe (€)», «Día del mes», «Nota» |
| Panel retirado | `getByTestId("regular-income-panel")` → **ausente** (assert negativo en e2e) |
| Enlaces de tarjeta | `getByRole("link", { name: /{nombre}\s*{etiqueta}/ })` — intactos |

## 6. Accesibilidad

- Menú con roles `menu`/`menuitem` (Radix), operable por teclado completo (abrir Enter/Espacio, navegar flechas, cerrar Escape) y retorno de foco al trigger al cerrar.
- Trigger real `<button>` con `aria-label`; nunca dentro del enlace de la tarjeta (HTML válido, research §2).
- El estado del ítem es texto (visible y en el nombre accesible), no solo color.

## 7. Fuera de alcance

Nuevas opciones de menú (la aportación % de 019 añadirá la suya), badges en la tarjeta, cambios en dominio/aplicación/action/BD/materialización, rediseño de tarjetas, página de ajustes global, dark mode.
