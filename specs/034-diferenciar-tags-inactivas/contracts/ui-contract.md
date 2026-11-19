# UI Contract: Etiquetas inactivas visibles en el listado de movimientos

**Feature**: `034-diferenciar-tags-inactivas` | 2026-11-19

**Componentes**: `src/infrastructure/primary/ui/grouped-movement-list.tsx` (client; **MODIFICADO**: chip diferenciado) + `src/infrastructure/primary/ui/edit-movement-dialog.tsx` (client; **MODIFICADO**: computa etiqueta inactiva actual) + `src/infrastructure/primary/ui/movement-form.tsx` (client; **MODIFICADO**: prop `currentInactiveTag` + ítem disabled) | **Actions**: sin cambios.

**Fuente de datos**: sin lecturas nuevas. El estado viaja dentro de `MovementDTO.tag.status` (amend de `MovementTagDTO`, data-model) servido por la lectura del mes existente (`ListMovements` → `selectMonthRows` con `tags.status` en el SELECT compartido). La UI no consulta, no recalcula ni deduce nada (FR-003).

---

## §1 `GroupedMovementList` — chip de etiqueta con estado

### §1.1 Chip activo (exactamente como hoy — FR-001)

```tsx
<span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
  {movement.tag.name}
</span>
```

Sin `title` nuevo, sin `data-inactive`, sin marca: pixel-idéntico al chip de 025/029.

### §1.2 Chip inactivo (tratamiento diferenciado + marca accesible)

Cuando `movement.tag.status === "inactive"`:

```tsx
<span
  className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
  title="{nombre} (inactiva)"
  data-inactive="true"
>
  {movement.tag.name}
  <span className="sr-only"> (inactiva)</span>
</span>
```

- **Nombre accesible** del chip: «{nombre} (inactiva)» (sufijo `sr-only`); **título**: tooltip nativo igual. La distinción no depende solo del color (borde discontinuo + texto apagado).
- `data-inactive="true"` solo existe en chips inactivos — ancla estable para tests/e2e (ausencia verificable en activos).
- Aplica en **todas las cuentas, cualquier mes consultado y con el modo selección activo** (el chip vive en la celda de contenido, ajena al checkbox; las filas con inactiva siguen siendo seleccionables, marcador incluido — escenario 4).
- Movimiento sin etiqueta: sin chip, sin cambios (edge case).
- Etiquetas protegidas: nunca inactivables (004/033) → sin marcador por construcción (escenario 8).

### §1.3 No-contratos del listado

Agrupación por fecha, nota, badge de naturaleza, importe firmado, ✏️/🗑️, estado vacío, modo selección completo (barra, checkboxes, exclusiones, `BulkRetagDialog`) — intactos (025/029).

## §2 `EditMovementDialog` — detección de la inactiva actual

- `EditMovementForm` computa, sin lecturas extra, desde el DTO capturado en estado del listado (convención «diálogos por fila»):
  `currentInactiveTag = movement.tag !== null && movement.tag.status === "inactive" ? { id: movement.tag.id, name: movement.tag.name } : null`
- Se pasa a `MovementFormFields` como prop nueva **opcional** (`currentInactiveTag?: { id: number; name: string } | null`, default `null`): el alta (014) y el retag masivo (029) no la aportan — cero cambios para ellos.

## §3 `MovementFormFields` — valor actual inactivo en el Select «Etiqueta»

- **Render**: si `currentInactiveTag != null && selectValue === String(currentInactiveTag.id)`, el `SelectContent` renderiza como **primer ítem** (antes de «Sin etiqueta» y de los grupos):

  ```tsx
  <SelectItem value={String(currentInactiveTag.id)} disabled>
    {currentInactiveTag.name} (inactiva)
  </SelectItem>
  ```

  Ítem plano fuera de `SelectGroup` (no pertenece a ninguna categoría de destinos), `disabled` (Radix lo excluye de puntero, teclado y typeahead).
- **Apertura** (escenario 2): el valor controlado inicial ya es el id inactivo → el trigger muestra «{nombre} (inactiva)» en lugar del placeholder vacío actual.
- **Error al guardar sin cambiar** (escenario 5): el hidden input `name="tagId"` conserva el id → error existente «Una de las etiquetas seleccionadas ya no está disponible.» sobre el campo (`role="alert"`, `aria-describedby`); con el error activo, el guard 027 (`selectValue = state.values.tagId`) mantiene el ítem inactivo deshabilitado como valor mostrado — el usuario ve el motivo en el formulario.
- **Cambio a activa** (escenario 3): al elegir un destino, `selectedTagId` cambia → el ítem inactivo deja de renderizarse (no es destino); guardar usa la vía de 014 sin cambios.
- **Destinos**: solo `tagGroups` activas filtradas de protegidas (027) — la inactiva jamás elegible (FR-002); «Sin etiqueta» solo para ingresos, como hoy.
- **Modos ocultos** (`contribution`/`savings`): el bloque «Etiqueta» no se renderiza — `currentInactiveTag` es irrelevante (las protegidas nunca son inactivas).

## §4 Lectura del mes (contrato interno de datos)

| Aspecto | Contrato |
|---|---|
| DTO | `MovementTagDTO = { id, name, slug, status: TagStatus }` (amend documentado; `MovementDTO` intacto en forma) |
| Origen | `DrizzleMovementRepository.selectMonthRows()` añade `tagStatus: tags.status` al SELECT con `leftJoin` existente; `mapJoinedRowToMovementDTO` compone `tag.status` (exige `tagStatus` no nulo para `hasTag`) |
| Cobertura | `listByMonthAndAccount` (página de cuenta), `listByMonth`, `listByYear` — mismas firmas |
| Consumidores | solo la UI de página de cuenta (chip + edición); agregados reciben el campo y lo ignoran (FR-003) |

## §5 Literales congelados (es)

«(inactiva)» (sufijo — en `title` «{nombre} (inactiva)», nombre accesible del chip y texto del ítem del Select), «Selecciona etiqueta» (placeholder, sin cambios), «Una de las etiquetas seleccionadas ya no está disponible.» (error existente, sin cambios).

## §6 Cobertura de tests UI (resumen — detalle en tasks)

- `grouped-movement-list`: chip inactivo con `title`/`data-inactive`/texto accesible «(inactiva)»; chip activo sin `data-inactive` y con clases de hoy; marcador visible en modo selección con fila seleccionable; protegida sin marcador.
- `edit-movement-dialog` / `movement-form`: trigger «{nombre} (inactiva)» al abrir; ítem disabled primero y fuera de grupos; destinos solo activas; error de guardar sin cambiar mantiene ítem + `role="alert"`.
- `DrizzleMovementRepository`: `tag.status` servido en las tres lecturas (inactiva/activa/sin etiqueta).
- e2e `etiquetas-inactivas.spec.ts`: recorrido completo (§ quickstart E1-E5).

## §7 No-contratos (no cambian)

`movement-form.schema.ts` y actions (alta/edición/retag/borrado), `CreateMovementDialog`, `BulkRetagDialog`, `DeleteMovementDialog`, `MonthStepper`, `AccountMonthKpis`, `/tags` completo (004/026/027), `/summary`, `/annual`, `/reports/*`, importador (028), materializaciones — reflejan el estado por sus joins vivos sin cambios de contrato.
