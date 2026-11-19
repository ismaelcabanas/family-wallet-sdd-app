# Research: Etiquetas inactivas visibles en el listado de movimientos (034)

**Feature**: 034-diferenciar-tags-inactivas | **Fecha**: 2026-11-19

---

## Contexto

034 es una feature de **lectura pura**: hacer visible en la página de cuenta (`/accounts/{id}?month=…`) qué filas del listado mensual llevan una etiqueta desactivada, y mostrar esa etiqueta inactiva como valor actual en el diálogo de edición (hoy: Select vacío con placeholder). El objetivo del propietario es vaciar las etiquetas inactivas reasignando sus movimientos a activas (edicición 014 / retag masivo 029) para poder eliminarlas en la feature futura 030. Sin cambios de escritura, esquema, migraciones ni agregados (FR-003/FR-004).

Diagnóstico verificado en código: el chip de la fila se pinta igual activa o inactiva (`grouped-movement-list.tsx:176-182` — la fila solo conoce `{ id, name, slug }`); el Select de edición solo ofrece activas (`ListGroupedActiveTags`), de modo que `initialValues.tagId` inactivo no coincide con ningún `SelectItem` y Radix muestra el placeholder, mientras el `<input type="hidden" name="tagId">` conserva el id → al guardar sin cambiar, `resolveTagId` (`src/application/movement/movement-inputs.ts:37-54`) lanza `InactiveTagError` → «Una de las etiquetas seleccionadas ya no está disponible.» sobre el campo (`update-movement.action.ts:54-56`). La causa es invisible para el usuario.

---

## R1. Vía de llegada del estado a la fila: amend de `MovementTagDTO` con `status`

**Decisión**: extender `MovementTagDTO` (`src/application/movement/dto.ts:25-29`) con `status: TagStatus` (tipo de dominio existente, `src/domain/tag/TagStatus.ts`), y hacer que la lectura del mes lo materialice:

- `DrizzleMovementRepository.selectMonthRows()` (líneas 69-87): el `leftJoin(tags)` ya existe — se añade `tagStatus: tags.status` al SELECT (misma query, una columna más). Cubre `listByMonthAndAccount`, `listByMonth` y `listByYear` (las tres usan el mismo builder y el mismo mapper).
- `movement.mapper.ts`: `MovementJoinedRow` gana `tagStatus: string | null`; `hasTag` lo exige (paridad de `tagName`/`tagSlug`); `mapJoinedRowToMovementDTO` compone `tag: { id, name, slug, status: tagStatus as TagStatus }`.

Es un **amend consciente y documentado del congelamiento de 027** (FR-006 de aquella: «`MovementTagDTO` (filas de listado) sin cambios»). La spec de 034 deja la decisión abierta (asunción: «amend del DTO frente a composición en lectura, al estilo de 015… se decide y justifica en el plan»).

**Rationale**:
- FR-003 exige que el estado «viaje con la lectura del mes hasta la fila del movimiento»: el join ya vive en esa lectura — una columna más y el dato está exactamente donde se consume (chip de la fila y valor actual del formulario de edición), sin pasarelas.
- El congelamiento de 027 era una **garantía de alcance de aquella feature** («listados funcionalmente idénticos» durante la entrega de la jerarquía), no un contrato eterno: 034 existe precisamente para exponer ese estado en esas filas.
- 015 respetó el congelamiento con composición en memoria porque `categoryId` era una **relación derivada** (tag → categoría) consumida por un único agregado anual; amendar habría arrastrado el join a todas las lecturas de movimientos para un solo consumidor. Aquí `status` es un **atributo propio de la etiqueta** que se muestra justo donde `MovementTagDTO` se muestra: su sitio natural es el DTO.
- Coste real del amend: un campo en DTO + una columna en el SELECT + el mapper; TypeScript estricto señala todos los fixtures de tests que construyen `tag: { … }` (≈12 sitios en tests UI + tests de repositorio) — actualización mecánica.

**Alternativas consideradas**:
- **Composición en lectura estilo 015** (elegida por 015): la página leería `TagRepository.findAll()` → `Map<tagId, TagStatus>` → prop `inactiveTagIds: Set<number>` → `GroupedMovementList` → `EditMovementDialog` → `MovementForm`. Rechazada: añade una lectura completa de etiquetas por render (hoy `ListGroupedActiveTags` ya filtra activas y no sirve), encadena la señal por 4 niveles de props y obliga a reconciliar un `Set` contra `movement.tag.id` en cada consumidor — más moving parts que el amend para el mismo resultado (Simplicidad Primero, I).
- **DTO de presentación enriquecido en la página** (mapear `MovementDTO` → `MovementRowDTO` con `tagInactive: boolean` en el adaptador de página): rechazado por duplicar la forma del DTO y obligar a mantener dos tipos paralelos en la frontera server→client.

---

## R2. Tratamiento visual y accesible del chip inactivo

**Decisión** (confirma la conjetura de la spec, asunción 1): el chip de etiqueta inactiva de la fila usa **tratamiento desaturado con borde discontinuo** y marca textual accesible:

- Clases condicionales: activa = exactamente las de hoy (`rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground`); inactiva = `rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground` (sin fondo, texto apagado — la distinción no depende solo del color).
- `title="{nombre} (inactiva)"` sobre el `<span>` del chip (tooltip nativo + refuerzo).
- Sufijo accesible: `<span className="sr-only"> (inactiva)</span>` dentro del chip → el nombre accesible del chip pasa a ser «{nombre} (inactiva)».
- `data-inactive="true"` (solo en inactivas) como ancla estable para tests y e2e; las activas no reciben el atributo (ausencia verificable).

Aplica en todas las cuentas, cualquier mes y también con el modo selección activo (el chip se pinta en la misma celda de contenido, ajena al checkbox — escenario 4). Las protegidas («Aportación Común», «Ahorro») nunca pueden estar inactivas (004/033): sin caso posible, sin código especial.

**Rationale**: FR-001 pide tratamiento «claramente distinto» + marca textual accesible en nombre accesible y título; `text-muted-foreground` + `border-dashed` es el vocabulario visual ya usado por el repo para estados deshabilitados/apagados (Radix lo usa en ítems `disabled`), sin tocar tokens de tema ni añadir CSS.

**Alternativas consideradas**: sufijo «(inactiva)» **visible** en el chip — rechazado por ruido (el usuario busca el marcador con la vista, no lo lee fila a fila; la spec pide marca accesible, no texto visible); icono ✕/⚠ — rechazado por añadir semántica de error a un estado legítimo (histórico conservado).

---

## R3. Valor actual inactivo en el Select de edición

**Decisión**: `MovementFormFields` gana la prop opcional `currentInactiveTag?: { id: number; name: string } | null`. `EditMovementForm` la computa desde el DTO que ya tiene: `movement.tag !== null && movement.tag.status === "inactive" ? { id, name } : null` (el DTO llega con `status` gracias a R1 — la página, el listado y el diálogo no consultan nada por su cuenta, FR-003).

Render: cuando `currentInactiveTag != null && selectValue === String(currentInactiveTag.id)`, el `SelectContent` prependa un `SelectItem` **fuera de los grupos**, `disabled`, con texto «{nombre} (inactiva)» y `value=String(id)`, antes del ítem «Sin etiqueta». Presentado como valor actual, jamás elegible como destino (los destinos siguen siendo solo `tagGroups` activas filtradas de protegidas, línea 287-292 de `movement-form.tsx`).

Comportamientos que caen por construcción:
- **Apertura**: el valor controlado `selectedTagId` ya es el id inactivo (línea 133-135) → el trigger muestra «{nombre} (inactiva)» en lugar del placeholder (FR-002, escenario 2).
- **Guardar sin cambiar**: el hidden input conserva el id inactivo → `InactiveTagError` → error existente sobre el campo; con el error activo, el guard de 027 (`selectValue = state.values.tagId`, líneas 275-280) mantiene el trigger mostrando el ítem inactivo deshabilitado + `role="alert"` — el usuario ve el motivo en el propio formulario (escenario 5, sin tocar actions ni dominio).
- **Cambiar a activa**: `setSelectedTagId` cambia → el ítem inactivo deja de renderizarse (ya no es el valor actual) y desaparece como opción (escenario 3); al guardar, la vía de 014 funciona sin cambios.
- **Desactivación del ítem**: Radix lo excluye de navegación por teclado y de typeahead; no es clicable. Nada que auditar a mano.

**Rationale**: presentación pura del valor actual en la frontera (asunción 2 de la spec); no relaja `resolveTagId` ni convierte la inactiva en destino. Reutiliza el estado controlado existente y su guard de error — cero estado nuevo.

**Alternativas consideradas**: inyectar la inactiva en `tagGroups` (marcándola de algún modo) — rechazado: contamina la fuente de destinos de los tres consumidores del form (alta/edición/bulk) y obligaría a filtrarla en todas partes; `SelectItem` no deshabilitado con estilo apagado — rechazado: lo haría elegible (rompe FR-002 y la regla de dominio se convertiría en el único freno); mostrar un aviso estático en lugar del ítem — rechazado: el usuario no vería cuál era su etiqueta.

---

## R4. Alcance intacto por diseño (FR-003/FR-004)

**Decisión**: sin cambios en dominio (`Tag`, `TagStatus`, `resolveTagId`, errores), application (casos de uso, puertos), actions, esquema/migraciones/seed, `/tags`, `/summary`, `/annual`, importador (028) ni materializaciones. El amend de R1 es de presentación: los agregados que consumen `MovementDTO` ignoran el campo nuevo (lo llevan encima, no lo leen — el histórico de etiquetas inactivas sigue computando, escenario 7, paridad 015 con `findAll`).

**Rationale**: la spec congela el cálculo (SC-003) y las vías de reasignación (FR-004); el único consumidor nuevo del estado es la UI de página de cuenta.

---

## R5. e2e: combinación propia, etiqueta propia y colaterales

**Decisión**: nuevo `e2e/etiquetas-inactivas.spec.ts` — **cuenta 1 (Cuenta de Miembro A) × 2026-07 (Julio de 2026)**, serial dentro del fichero (convención AGENTS.md).

- Combinación verificada libre contra todos los specs existentes: cuenta 1 usa 2026-01 (jerarquia), 2026-05 (ahorro), 2026-10 (categorias-tags), mes en curso (ingresos-regulares, kpis-fijos) y 2024-01 (informe-anual). Evitados además: 2026-06 (resumen-global asserta `/summary?month=2026-06` global), 2027 (cuenta-resultados-anual), 2026-08/09 en cuenta 2 (edicion-movimientos, gestion-tags), 2026-02 (retag-masivo), 2026-03/04 (pagina-cuenta), 2027-03 cuenta 3 (importacion-excel).
- **Etiqueta propia creada inline** («Vacaciones», vía «+ Nueva etiqueta» del formulario — patrón `gestion-tags` G2): nunca se desactiva una etiqueta del seed, así ningún spec posterior (orden alfabético: `etiquetas-inactivas` corre entre `edicion-movimientos` y `gestion-tags`) encuentra opciones desaparecidas en sus Selects.
- Recorrido: 3 movimientos en 2026-07 (2 con la etiqueta propia inline + 1 con «Ocio» activa de contraste) → desactivar en `/tags` → chips diferenciados (`title`/`data-inactive`) y chip activo intacto → edición de una fila marcada: trigger «Vacaciones (inactiva)», ítem deshabilitado, guardar sin cambiar → error existente → reasignar a «Ocio» → chip normal → retag masivo (029) de la segunda fila marcada → sin marcadores en el mes. El estado residual (etiqueta «Vacaciones» inactiva sin movimientos en la genérica) es inerte para los specs posteriores (verificados: ninguno cuenta filas globales del catálogo ni de la genérica).

**Rationale**: constitución III (flujo crítico e2e) + convención de aislamiento (workers: 1, BD determinista compartida); la etiqueta propia elimina el único riesgo real de contaminación (desactivar una etiqueta compartida).

**Alternativas consideradas**: desactivar una etiqueta del seed usada solo en mi mes — frágil (el catálogo es global y el seed evoluciona); reactivar la etiqueta al final del spec — innecesario si la etiqueta es propia y queda vacía.

---

## R6. Mapa de tests (FR-005)

**Decisión** (co-localizados junto al SUT):

- **Repositorio**: `DrizzleMovementRepository.test.ts` ampliado — fila con etiqueta inactiva → `dto.tag.status === "inactive"`; activa → `"active"`; sin etiqueta → `tag === null` (paridad de las tres lecturas del builder compartido: mes+cuenta, mes, año).
- **Componentes (jsdom)**:
  - `grouped-movement-list.test.tsx`: chip inactivo con `title` «{nombre} (inactiva)», texto accesible «(inactiva)» y `data-inactive`; chip activo sin `data-inactive` y con las clases de hoy; marcador presente en modo selección con la fila seleccionable; fila protegida sin marcador.
  - `edit-movement-dialog.test.tsx` / `movement-form.test.tsx`: edición de movimiento con etiqueta inactiva → trigger muestra «{nombre} (inactiva)» y el ítem del dropdown está deshabilitado; destinos solo activas; estado de error con `tagId` inactivo mantiene el ítem visible + `role="alert"` (escenario 5).
- **e2e**: ver R5.
- **Fixtures afectados por el amend**: todo constructor de `MovementTagDTO` en tests (~12 sitios UI + mapper/repo) añade `status` — el typecheck los señala todos; actualización mecánica sin cambios de semántica (`status: "active"` por defecto).

**Rationale**: espejo del mapa de la familia (032/033 adaptado a feature de lectura); la regla de dominio y el mapeo de errores ya tienen cobertura (`update-movement.action.test.ts:196`, `movement-form.test.tsx:917-943`) y no cambian.

---

## Resumen de NEEDS CLARIFICATION (resueltos)

La Technical Context no arrastraba incógnitas de stack (feature de presentación sobre el monolito existente). Las dos decisiones que la spec dejaba al plan quedan resueltas: **R1** (amend del DTO con justificación frente a la alternativa 015) y **R2** (tratamiento visual definitivo del chip).
