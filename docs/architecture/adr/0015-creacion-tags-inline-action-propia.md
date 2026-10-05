# 15. Creación de etiquetas inline con Server Action propia

- **Fecha**: 2026-10-05
- **Estado**: Aceptado (reducción de la fila 004 decidida por el propietario, 2026-10-04)

## Contexto y problema

La feature 017 añade la vía de creación de tags que faltaba: hasta ahora el catálogo solo se poblaba por seed. Desde 014 la etiqueta es obligatoria en gastos, por lo que una etiqueta ausente obligaba a salir del flujo de registro. Había que decidir (1) el mecanismo de creación, (2) dónde vive la derivación de slug y la resolución de duplicados/colisiones, y (3) cómo hacer la etiqueta nueva inmediatamente disponible sin depender del refresco del servidor. Research en `specs/017-creacion-tags-formulario/research.md`.

## Opciones consideradas

1. **Crear la tag dentro de `createMovement`/`updateMovement`** (campo `newTagName`): viola FR-004 (persistencia y selección previas al envío), complica el contrato de las actions existentes con una rama `tagId` XOR `newTagName` y deja la tag indisponible en la captura siguiente sin guardar movimiento.
2. **Route Handler REST (`POST /api/tags`)**: duplica frontera y validación sin consumidor externo; el adaptador inbound del proyecto son las Server Actions (ADR 0008).
3. **Optimistic UI** (tag solo en cliente, persistir con el movimiento): rompe el edge «etiqueta creada y movimiento cancelado» (persistencia inmediata) y un id temporal rompería la FK real.
4. **Combobox editable tipo Command**: nueva dependencia de componentes sin justificar y rehace la interacción del Select validada por 6 specs e2e.
5. **`useActionState` con `<form>` hermano/anidado**: formularios anidados son HTML inválido; el hermano rompe la semántica de submit (Enter podría enviar el movimiento).

## Decisión

- **Server Action propia `createTag(name)` + caso de uso `CreateTag`** (aplicación): la creación es inmediata e independiente del envío del movimiento; devuelve `CreateTagResult` (`{ ok: true; tag } | { ok: false; message }`), nunca lanza al cliente. En éxito ejecuta **`revalidatePath("/", "layout")`** (la action no conoce la página origen y el catálogo es global).
- **`deriveTagSlug(name)` es función pura del dominio** (`src/domain/tag/TagSlug.ts`): trim + minúsculas, NFD + strip de diacríticos, no-alfanuméricos → guion, colapso y recorte. Reproduce la convención manual del seed (test contra los 12 `SEED_TAGS`). **La resolución de colisiones (`{slug}-2`, `-3`, … vía `findBySlug`) vive en `CreateTag`**: la función de dominio se mantiene pura; orquestar contra el catálogo real es aplicación.
- **Duplicados case-insensitive vía `TagRepository.findByName`**, espejo exacto del índice `tags_name_nocase_uq ON lower(name)` (SQL `lower()` ASCII: «Luz»≡«LUZ» colisionan, «Alimentación»≢«Alimentacion» no), ignora el estado (una inactiva también bloquea). `DuplicateTagNameError` (definido en 002, nunca lanzado) pasa a usarse con su mensaje ya congelado. El índice queda como red de seguridad ante carreras: `DrizzleTagRepository.save` traduce la violación del constraint a `DuplicateTagNameError`.
- **Captación inline junto al Select** («+ Nueva etiqueta» en `movement-form.tsx`): llamada directa a la action dentro de `useTransition` (sin form ni `useActionState`); Enter interceptado (`preventDefault`) para no enviar el movimiento; Escape cancela la captación sin cerrar el diálogo (flag `data-tag-creation-input` + `onEscapeKeyDown` en `DialogContent`). Al éxito: toast «Etiqueta creada», `selectedTagId = tag.id` y `onTagCreated(tag)`.
- **Disponibilidad inmediata: `extraTags` a nivel de diálogo** (`create-movement-dialog.tsx`, `edit-movement-dialog.tsx`), padre del remonte `key={savedCount}` de la tanda — mismo patrón de estado que `savedCount`/`carry` (014); merge `[...tags, ...extraTags]` ordenado por nombre.

## Consecuencias

- **Positivas**: FR-001–FR-006 cubiertos con una sola apertura de diálogo (SC-001); la tanda de 014 intacta; cero migraciones, cero dependencias nuevas; la semántica de unicidad visible al usuario es exactamente la de BD (espejo), con el mensaje nacido en el dominio.
- **Negativas / trade-offs**: `revalidatePath("/", "layout")` invalida el árbol completo (coste irrelevante: 1 usuario, 3 cuentas); la captación inline es una **excepción documentada** al patrón «toda action con `useActionState`»: aquí la action devuelve un resultado tipo consulta y el estado (nombre, error) vive en el propio componente.
- Las actions de movimiento no cambian: la etiqueta nueva llega al envío como un `tagId` ya persistido. `grouped-movement-list.tsx` y `page.tsx` intactos.
