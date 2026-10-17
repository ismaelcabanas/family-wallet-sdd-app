# Contrato de UI: Gestión del catálogo de etiquetas

**Feature**: `004-gestion-tags` | **Componentes**: `src/app/tags/page.tsx` (server) + `src/infrastructure/primary/ui/tag-catalog.tsx` (client; lista + menús) + diálogos `rename-tag-dialog.tsx`, `merge-tags-dialog.tsx`, `deactivate-tag-dialog.tsx` + `global-nav.tsx` (enlace nuevo) | **Actions**: `renameTag`, `mergeTags`, `deactivateTag` (`useActionState`) y `reactivateTag` (directa + `useTransition`)

Congela los literales y comportamientos de la vista de administración (FR-001) y sus operaciones (FR-002–FR-008). Los formularios de movimiento, los Select de etiqueta y las vistas de desglose **no cambian**; solo reflejan el estado resultante (FR-009).

---

## 1. Acceso y layout de la vista (FR-001, escenario 5)

- **Enlace «Etiquetas»** en la navegación global (`aria-label="Navegación principal"`), 4.º destino, sin contexto temporal (`href="/tags"`); en `/tags` lleva `aria-current="page"`.
- Página `/tags`: título `h1` **«Etiquetas»** + región `aria-label="Catálogo de etiquetas"`.
- Lista (`ul` > `li` `role="listitem"`, una fila por etiqueta) ordenada **activas primero, luego inactivas**, cada bloque alfabético. Cada fila:

```text
┌ Catálogo de etiquetas ────────────────────────────────────────────┐
│ Hogar            [Activa]                        ⋮ Acciones       │
│ Sin Clasificar   [Activa]                        ⋮ Acciones       │
│ Luz (apagada)    [Inactiva]                       ⋮ Reactivar     │
│ Aportación Común [Activa]                         🔒 Sistema       │
└───────────────────────────────────────────────────────────────────┘
```

- Chip de estado: **«Activa»** / **«Inactiva»** (visible siempre, FR-001).
- **Fila protegida** («Aportación Común»): distintivo **«Sistema»** y **sin menú** de acciones (FR-007: «no se ofrecen»); el resto de filas ofrecen menú ⋮.

## 2. Menú por fila (⋮ «Acciones de {nombre}», FR-001)

| Estado de la etiqueta | Ítems del menú |
|---|---|
| Activa (no protegida) | **Renombrar…** · **Fusionar en otra…** · **Desactivar…** |
| Inactiva | **Reactivar** (acción inmediata, sin diálogo — FR-008 no la exige; es reversible y no toca movimientos) |
| Protegida | (sin menú) |

- Trigger: botón ⋮ con `aria-label="Acciones de {nombre}"` (≥ 44 px), menú DropdownMenu en portal.
- **Doble envío**: mientras una operación está en vuelo, el trigger y los controles del diálogo quedan deshabilitados (edge).

## 3. Diálogos (montados a nivel del listado, DTO capturado en estado — convención de fila)

### 3.1 Renombrar (FR-002, escenarios 1 y 6)

- `Dialog` título **«Renombrar etiqueta»**: input **«Nombre»** (`defaultValue` = nombre actual), botones `[Cancelar] [Guardar]` (primario). En error, el nombre tecleado **permanece editable** en el campo (SC-004).
- Éxito: toast **«Etiqueta renombrada»**, diálogo cerrado, fila con el nombre nuevo (sin recarga manual).
- Errores (`role="alert"` bajo el input): vacío → «El nombre de la etiqueta es obligatorio.»; duplicado → «Ya existe una etiqueta con el nombre "{nombre}".»; protegida (no ofrecida por el menú, defensa en action) → «La etiqueta "{nombre}" pertenece al sistema y no puede modificarse.»

### 3.2 Fusionar en otra… (FR-003, FR-008, escenario 2)

- `Dialog` título **«Fusionar etiqueta»**, texto fijo con la absorbida: **«Los movimientos con la etiqueta "{absorbida}" pasarán a la etiqueta que elijas. "{absorbida}" desaparecerá del catálogo.»**
- Select **«Etiqueta resultante»**: todas las etiquetas **excepto** la propia absorbida y las **protegidas**; las inactivas aparecen con sufijo «(inactiva)» (edge fusión hacia inactiva — permitida y visible).
- Botones `[Cancelar] [Fusionar]` (destructivo). Sin destino elegido, «Fusionar» deshabilitado.
- Confirmación integrada: el propio texto de consecuencia + botón destructivo constituyen la confirmación explícita (FR-008); al pulsar, botón **«Fusionando…»** y controles deshabilitados (edge doble envío).
- Éxito: toast **«Etiquetas fusionadas»**, diálogo cerrado, la absorbida desaparece de la lista.

### 3.3 Desactivar… (FR-004, FR-008, escenario 3)

- `AlertDialog` título **«Desactivar etiqueta»**, texto: **«"{nombre}" dejará de ofrecerse para nuevos movimientos. Los movimientos existentes la conservarán y seguirán computando en los desgloses.»**
- Botones `[Cancelar] [Desactivar]` (destructivo). En vuelo: deshabilitados.
- Éxito: toast **«Etiqueta desactivada»**, la fila pasa a «Inactiva» y su menú queda en «Reactivar».

### 3.4 Reactivar (FR-005, escenario 4, edge colisión)

- Ítem de menú directo (action + `useTransition`, familia ADR 0015): sin diálogo ni formulario — la etiqueta ya existe; el resultado es un mensaje, no un estado de formulario.
- Éxito: toast **«Etiqueta reactivada»**, fila «Activa» (nombre e histórico intactos).
- Error (colisión «Luz» inactiva vs «LUZ» activa): toast de error **«Ya existe una etiqueta con el nombre "{nombre}".»** — resolver la colisión (renombrando una de las dos) queda en manos del usuario.

## 4. Disponibilidad inmediata y vistas derivadas (FR-009, SC-002/SC-003, edge desgloses)

- Toda acción de catálogo ejecuta `revalidatePath("/", "layout")`: los Select de alta/edición (solo activas) y los desgloses (joins en vivo) muestran el estado resultante **en los usos siguientes**, sin pasos manuales.
- Renombrar/fusionar **no cambian ningún total**: cierres, `/summary` y `/annual` reflejan únicamente el cambio de dimensión etiqueta (nuevo nombre o suma bajo la resultante).
- Edge «etiqueta desactivada seleccionada en un formulario abierto»: sin cambio UI; la validación vigente del envío (`resolveTagId`) sigue decidiendo (los envíos en vuelo pueden guardarse con ella).
- La página `/tags` tras cada operación muestra la lista resultante (la revalidación refresca el server render).

## 5. Contratos de las Server Actions (frontera)

```ts
renameTag(prev: TagActionState, formData: FormData): Promise<TagActionState>   // tagId, name (Zod trim min 1)
mergeTags(prev: TagActionState, formData: FormData): Promise<TagActionState>   // absorbedId, targetId
deactivateTag(prev: TagActionState, formData: FormData): Promise<TagActionState> // tagId
reactivateTag(tagId: number): Promise<{ ok: true } | { ok: false; message: string }>

type TagActionState =
  | { status: "idle" }
  | { status: "success"; message: string }   // «Etiqueta renombrada» | «Etiquetas fusionadas…» | «Etiqueta desactivada»
  | { status: "error"; message: string };    // mensajes de dominio exactos (§3)
```

- Éxito → `revalidatePath("/", "layout")` antes de devolver el estado. Nunca lanzan al cliente; los `DomainError` conocidos se mapean a su mensaje exacto, el resto a un genérico («No se ha podido completar la operación. Inténtalo de nuevo.»).

## 6. Accesibilidad

- Trigger ⋮ con nombre accesible («Acciones de {nombre}»); menú en portal con navegación por flechas (Radix).
- Diálogos con foco inicial en el primer control (input «Nombre» / Select destino); errores `role="alert"` asociados por `aria-describedby`; cierre por Escape/Cancelar sin efectos.
- El chip de estado es texto (no solo color); la fila protegida comunica «Sistema» textualmente.
- Tras éxito, el foco vuelve al listado (fila afectada) y el toast es `role="status"`.

## 7. Fuera de alcance

Creación de etiquetas desde /tags (017), asignación de etiquetas a movimientos desde el catálogo, borrado físico independiente, grupos de agregación (015), cambios en formularios/desgloses, exportación, optimización móvil, dark mode.
