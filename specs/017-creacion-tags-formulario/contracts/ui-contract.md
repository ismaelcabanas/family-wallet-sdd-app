# Contrato de UI: Creación de etiquetas desde el formulario de movimiento

**Feature**: `017-creacion-tags-formulario` | **Componentes**: `movement-form.tsx` (bloque «+ Nueva etiqueta»), `create-movement-dialog.tsx` y `edit-movement-dialog.tsx` (estado `extraTags`) | **Integración**: `createTag` (Server Action nueva); `grouped-movement-list.tsx` y `page.tsx` intactos

Congela los literales y comportamientos de la feature. Extiende el contrato de [014](../../014-formulario-nota-tags/contracts/ui-contract.md); todo lo no mencionado aquí queda como en 014 (tanda continua, botonera, errores de movimiento, foco tras remonte).

---

## 1. Acceso y captación inline junto al Select (FR-001, FR-006)

```text
┌─ Nuevo movimiento ────────────── Guardados: 1 ─┐
│  Fecha [2026-10-04]        Importe (€) [ 85,00]│
│  Nota [Tienda de mascotas                  ]   │
│  Tipo: (•) Gasto  ( ) Ingreso                  │
│  Naturaleza del gasto: (•) Personal            │
│  Etiqueta [ Selecciona etiqueta            ▼]   │
│            + Nueva etiqueta                     │
└─────────────────────────────────────────────────┘
                        │ pulsa «+ Nueva etiqueta»
                        ▼
│  Etiqueta ─ (Select sustituido por la captación)│
│  Nombre de la etiqueta [Mascotas        ]       │
│    ⚠ El nombre de la etiqueta es obligatorio.   │ ← solo si vacío (o duplicado: «Ya existe…»)
│            [ Cancelar ] [ Crear ]               │
```

- **«+ Nueva etiqueta»**: botón discreto junto al Label «Etiqueta» (texto, estilo link/ghost), presente **en alta y en edición** (FR-006). Abre la captación inline **dentro del propio formulario**: el Select se sustituye por el bloque de captación; nada más cambia y el diálogo permanece abierto.
- **Captación**: campo **«Nombre de la etiqueta»** (único dato pedido, FR-002) + botonera `[Cancelar] [Crear]` («Crear» primario). Placeholder sugerido: «Mascotas».
- **Cancelar** (o Escape en el input): vuelve al Select **exactamente como estaba** (selección previa restaurada, error previo del campo Etiqueta limpio); no se crea nada (escenario 3).
- **Enter** en el input de nombre dispara «Crear» (interceptado: **no** envía el formulario del movimiento). El botón «Crear» es `type="button"`; la acción se llama directamente (`useTransition`), sin `<form>` anidado.
- Mientras el **movimiento** se está guardando (`isPending` de su action), «+ Nueva etiqueta» y la captación entera quedan deshabilitados.

## 2. Estados de la creación (FR-002, FR-003, edge doble envío)

| Situación | Comportamiento exacto |
|---|---|
| «Crear» con nombre válido | Tag persistida activa (slug derivado, invisible); toast **«Etiqueta creada»**; captación colapsada; el Select muestra la **nueva etiqueta seleccionada**; el resto de campos del formulario **no cambia** (fecha, importe, nota, tipo, naturaleza); el movimiento **no** se guarda y el diálogo permanece abierto (FR-004) |
| «Crear» con nombre vacío / solo espacios | Error `role="alert"` bajo el input: **«El nombre de la etiqueta es obligatorio.»**; nombre (vacío) permanece; nada se crea (escenario 6) |
| «Crear» con duplicado ignorando mayúsculas («luz» existiendo «Luz», activa o inactiva) | Error `role="alert"`: **«Ya existe una etiqueta con el nombre "luz".»**; el nombre tecleado **permanece en el campo** para corregirlo; resto del formulario intacto (escenario 2) |
| Creación en curso | «Crear» muestra **«Creando…»** y Cancelar deshabilitado; doble envío imposible (edge) |
| Cancelar la captación | Ver §1; sin efectos sobre el formulario |
| Nombre con espacios al inicio/fin | Se recortan antes de validar/guardar; la etiqueta se crea con el nombre limpio (edge) |
| Cambio Gasto↔Ingreso con la captación abierta | La captación **continúa abierta e íntegra**; los demás campos conservan sus valores; el requisito de etiqueta se evalúa al enviar según el tipo vigente (edge) |
| Etiqueta creada y movimiento cancelado después | La etiqueta **permanece** en el catálogo (edge; también si se cierra el diálogo a mitad de tanda) |

Mensajes congelados: «El nombre de la etiqueta es obligatorio.», «Ya existe una etiqueta con el nombre "{nombre}".» (del error de dominio), «Etiqueta creada» (toast), «Creando…».

## 3. Tanda continua intacta (FR-005, SC-004)

- Tras crear una etiqueta en cualquier captura de la tanda, el ciclo de 014 sigue idéntico: «Guardar y seguir» remonta el formulario (`key={savedCount}`) con nota/importe/etiqueta vacíos, fecha/tipo/naturaleza pegados, foco en Nota.
- La etiqueta creada **queda disponible en el Select de todas las capturas siguientes de la misma tanda** (estado `extraTags` del diálogo, que sobrevive al remonte) y seleccionable en cualquiera de ellas (escenario 4).
- Tras cerrar el diálogo (o la tanda), volver a abrir «Nuevo movimiento» en la misma página montada muestra la etiqueta creada en el Select (revalidación del layout por la action; SC-004).

## 4. Diálogo de edición (FR-006)

- Mismo patrón completo del §1–§2: «+ Nueva etiqueta» junto al Select, captación inline, errores y conservación de datos.
- Crear una etiqueta, tenerla seleccionada y **«Guardar cambios»** actualiza el movimiento con la etiqueta recién creada; el diálogo **se cierra** como hoy con su toast («Movimiento actualizado» + sufijo de mes si aplica) (escenario 5).

## 5. Contrato de la Server Action `createTag` (frontera)

```ts
// Entrada: el nombre tecleado (string)
createTag(name: string): Promise<CreateTagResult>

export type CreateTagResult =
  | { ok: true; tag: TagDTO }        // { id, name, slug } — persistida, activa
  | { ok: false; message: string };  // «El nombre de la etiqueta es obligatorio.»
                                      // | «Ya existe una etiqueta con el nombre "{nombre}".»
                                      // | error inesperado (genérico)
```

- Validación Zod en frontera: `z.string().trim().min(1)` (IV). Reglas de negocio (duplicado, slug, estado) en `CreateTag`/dominio — ver [data-model.md §3](../data-model.md).
- Éxito → `revalidatePath("/", "layout")` y devolución de la `TagDTO`; **no** revalida vistas de movimientos (nada cambió en ellas).
- `createMovement`/`updateMovement` **sin cambios**: la etiqueta nueva llega como un `tagId` más del FormData (validación e interacción intactas de 014).

## 6. Flujo de datos de la nueva tag en el cliente

```text
createTag ok → MovementFormFields: selectedTagId = tag.id
             → onTagCreated(tag) → Dialog: extraTags = [...extraTags, tag]   // sobrevive al remonte
             → Select del diálogo renderiza [...tags(prop), ...extraTags] ordenado por nombre
             → revalidatePath("/", "layout") refresca las props del servidor en el próximo render RSC
```

## 7. Accesibilidad

- «+ Nueva etiqueta» es un botón real con nombre accesible; abre la captación y el foco pasa al input «Nombre de la etiqueta».
- Errores de la captación: `role="alert"` bajo el input, asociados por `aria-describedby`.
- Tras éxito: captación colapsa, la etiqueta queda seleccionada en el combobox «Etiqueta» y el foco vuelve al Select (o al primer campo vacío del formulario en tanda, según el flujo vigente de 014).
- La captación no abre foco-trap nuevo (no hay diálogo anidado); Escape en el input cancela la captación, no el diálogo (el diálogo conserva su Escape de Radix cuando el foco no está en el input).

## 8. Fuera de alcance

Renombrar/fusionar/desactivar/reactivar etiquetas, página de administración del catálogo, autocompletado, creación en masa, cambios en el Select de etiqueta más allá de lo descrito, cambios en desgloses/cierres, optimización móvil, dark mode.
