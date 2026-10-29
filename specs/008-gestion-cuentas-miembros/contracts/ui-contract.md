# Contrato de UI: Gestión de cuentas y miembros — renombrado

**Feature**: `008-gestion-cuentas-miembros` | **Componentes**: `account-card-grid.tsx` (MODIFICADO), `rename-member-dialog.tsx` (NUEVO), `rename-account-dialog.tsx` (NUEVO), `rename-member.action.ts` / `rename-account.action.ts` (NUEVAS) | **Intactos**: diálogos de config 018/019/023, página de cuenta, `/summary`, `/annual`, materializadores

Congela literales y comportamientos de la superficie de gestión (FR-003). Los diálogos replican el patrón de [004 rename-tag-dialog](../../004-gestion-tags/contracts/ui-contract.md) (input controlado, `role="alert"`, `aria-describedby`); todo lo no mencionado queda como en los contratos previos que esta extiende (012 tarjetas, 020 menú ⋮).

---

## 1. Menú ⋮ de la tarjeta personal (FR-001, escenarios 1, 2, 4, 5)

```text
┌─ ⋮ Configuración de Cuenta de Isma ───────────┐
│  Renombrar miembro                            │   ← NUEVO: primer ítem, sin sufijo de estado
│  Ingreso regular                     Activa   │   ← 020/018 intactos
│  Aportación                             25 %   │   ← (estado según config; intactos)
│  Ahorro                                Activo  │   ← 023 intacto
└───────────────────────────────────────────────┘
```

- El ítem **«Renombrar miembro»** es el **primero** del menú (identidad antes que configuración), sin texto de estado alineado a derecha.
- Seleccionarlo cierra el menú y abre **`RenameMemberDialog`** con el nombre actual del miembro precargado. El nombre accesible del ítem es exactamente «Renombrar miembro».
- El resto de ítems (estado, guardas «Requiere ingreso regular», diálogos) queda **intacto** de 020/018/019/023.
- Origen de los datos: el DTO de la tarjeta (`account.memberId` oculto, `account.memberName` precarga). La etiqueta de tipo de la tarjeta («Cuenta personal de {miembro}») sigue intacta.

## 2. Menú ⋮ de la tarjeta común (FR-002, escenario 3)

```text
┌─ ⋮ Configuración de Cuenta común ─────────────┐
│  Renombrar cuenta                             │   ← único ítem
└───────────────────────────────────────────────┘
```

- La tarjeta de la cuenta común **gana trigger ⋮** (mismo patrón stretched-link + `z-10` de 020: clic en ⋮ nunca navega, el resto de la tarjeta sí), esquina superior derecha, ≥ 44 px, con nombre accesible **`Configuración de {nombre de la cuenta}`** (p. ej. «Configuración de Cuenta común»).
- Único ítem: **«Renombrar cuenta»**; lo abre el diálogo §4 con el nombre almacenado precargado. **No hay** ítems de ingreso regular/aportación/ahorro en la común (siguen sin aplicar).
- En respuesta a FR-004: en tarjetas personales **no existe** el ítem «Renombrar cuenta» — solo «Renombrar miembro» (el nombre de la personal cambia al renombrar el miembro).

## 3. Diálogo «Renombrar miembro» (FR-001/FR-006, escenarios 1, 2, 4, 5)

- Título: **«Renombrar miembro»** · Label: **«Nombre del miembro»** · Input de texto **controlado** (`useState`, patrón 004) precargado con el nombre vigente.
- Hidden: `<input type="hidden" name="memberId" value={memberId} />`.
- Botones: **«Cancelar»** (`type="button"`, cierra sin guardar) y **«Guardar»** (submit, `disabled={isPending}`).
- Envío: `useActionState(renameMember, { status: "idle" })` con FormData `{ memberId, name }`.
- Éxito: toast **«Miembro renombrado»**, cierre del diálogo; `revalidatePath("/", "layout")` refresca panel, páginas de cuenta y agregados **sin recarga manual** (SC-001). La tarjeta pasa a mostrar el derivado «Cuenta de {nuevo nombre}».
- Errores (`role="alert"` + `aria-describedby` en el input, diálogo abierto, **valor tecleado conservado**):

| Caso | Mensaje exacto |
|---|---|
| Vacío o solo espacios | «El nombre del miembro es obligatorio.» |
| Duplicado nocase (p. ej. «ISMA» con «Isma») | `Ya existe un miembro con el nombre "ISMA".` |
| Miembro ya no existe | «El miembro seleccionado no existe.» |
| Error inesperado | «No se ha podido renombrar el miembro.» |

## 4. Diálogo «Renombrar cuenta» (FR-002/FR-006, escenarios 3, 4, 5)

- Título: **«Renombrar cuenta»** · Label: **«Nombre de la cuenta»** · Input controlado precargado con el nombre almacenado de la común.
- Hidden: `<input type="hidden" name="accountId" value={accountId} />`.
- Botones «Cancelar»/«Guardar», envío `useActionState(renameAccount, { status: "idle" })` con FormData `{ accountId, name }`.
- Éxito: toast **«Cuenta renombrada»**, cierre, revalidación de layout (SC-001); la tarjeta y la página de la común muestran el nuevo nombre.
- Errores (mismos patrones que §3):

| Caso | Mensaje exacto |
|---|---|
| Vacío o solo espacios | «El nombre de la cuenta es obligatorio.» |
| Duplicado nocase con nombre almacenado | `Ya existe una cuenta con el nombre "{nombre}".` |
| Cuenta ya no existe | «La cuenta seleccionada no existe.» |
| Error inesperado | «No se ha podido renombrar la cuenta.» |

## 5. Propagación visible tras renombrar (FR-001/FR-002/FR-004, escenarios 1–3, SC-002)

| Vista | Qué muestra tras renombrar el miembro a «Isma» | Tras renombrar la común a «Cuenta conjunta» |
|---|---|---|
| Panel `/` — tarjeta | Título «Cuenta de Isma» (derivado); subtítulo «Cuenta personal de Isma» | Título «Cuenta conjunta»; subtítulo «Cuenta común» |
| Página de cuenta | `<h1>` «Cuenta de Isma»; balance «Balance de Cuenta de Isma» | `<h1>` «Cuenta conjunta» |
| `/summary` — desglose por miembro | Fila «Isma» con los mismos importes | Fila «Cuenta común» invariable (la fila común **no** usa el nombre almacenado) |
| `/annual` — ingresos por miembro | Fila «Isma» con los mismos importes | — |
| Notas de movimientos ya materializados | **Intactas** (congelan el nombre del momento; nada se reescribe) | — |

Ningún importe, balance, cierre, tag, config o `activatedAtMonth` cambia en ningún caso (FR-005, SC-002).

## 6. Selectores estables para tests

| Elemento | Selector |
|---|---|
| Trigger ⋮ (personal/común) | `getByRole("button", { name: "Configuración de {nombre mostrado}" })` |
| Ítem renombrar miembro | `getByRole("menuitem", { name: "Renombrar miembro" })` |
| Ítem renombrar cuenta | `getByRole("menuitem", { name: "Renombrar cuenta" })` |
| Diálogo miembro | `getByRole("dialog", { name: "Renombrar miembro" })` con label «Nombre del miembro» |
| Diálogo cuenta | `getByRole("dialog", { name: "Renombrar cuenta" })` con label «Nombre de la cuenta» |
| Alerta de error | `getByRole("alert")` dentro del diálogo abierto |
| Toast éxito | «Miembro renombrado» / «Cuenta renombrada» |

## 7. Accesibilidad y operabilidad por teclado (FR-006)

- Menús con roles `menu`/`menuitem` (Radix): Enter/Espacio abre, flechas navegan, Escape cierra y devuelve el foco al trigger; el contenido en portal no anida interactivos (patrón 020 intacto).
- El clic en ⋮ **nunca navega** (edge «Renombrado desde el panel no navega»); el resto de la tarjeta sí (stretched-link intacto).
- Diálogos: foco inicial en el input, Escape/«Cancelar» cierran sin guardar, error anunciado con `role="alert"` asociado al campo.

## 8. Fuera de alcance

Altas/borrado de miembros y cuentas, cambio de tipo o de miembro atribuido, renombrado independiente de cuenta personal, edición del derivado en la tarjeta, masivos, balances en tarjeta, rediseño del panel (spec Out of Scope).
