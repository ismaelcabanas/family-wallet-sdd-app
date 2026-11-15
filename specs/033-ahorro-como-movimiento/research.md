# Research: El ahorro mensual como movimiento editable (033)

**Feature**: 033-ahorro-como-movimiento | **Fecha**: 2026-11-15

---

## Contexto

033 convierte el ahorro (023: apartado informativo congelado en `savings_allocation_months`, sin movimiento) en un **movimiento real**, dual de la aportación común (032): gasto de naturaleza propia con etiqueta protegida implícita, fila del registro enlazada por `movement_id` en la misma transacción, regla «0 o 1» por cuenta y mes. Las decisiones de producto ya están fijadas en la spec (clarify 2026-11-15); esta investigación resuelve los extremos técnicos contra el código real.

---

## R1. Patrón 032 a clonar (fuente principal de diseño)

**Decisión**: 033 replica el patrón 032 símbolo a símbolo, con las tres desviaciones decididas en clarify: (a) la vía manual exige **existencia** de config, no «activa»; (b) **borrado uniforme** (movimiento + fila juntos, sin filas huérfanas por origen); (c) sin backfill automático — la vía manual re-enlaza filas huérfanas legacy.

**Rationale**: 032 ya resolvió los problemas duros de esta familia: upsert transaccional del registro (`ON CONFLICT (config, mes) DO UPDATE SET movement_id WHERE movement_id IS NULL RETURNING`), pre-check + guarda transaccional para la unicidad, identidad congelada en edición, action despachadora con Zod, radio de frontera con restauración ante el reset de Radix, y e2e con combinación cuenta/mes propia. Clonar minimiza el riesgo y la superficie de revisión.

**Hallazgos verificados en código**:

| Pieza 032 | Ubicación | Espejo 033 |
|---|---|---|
| Caso de uso manual | `src/application/common-contribution/RegisterManualContribution.ts` | `src/application/savings/RegisterManualSavings.ts` |
| Errores de dominio | `src/domain/common-contribution/CommonContributionErrors.ts` | ampliar `src/domain/savings/SavingsAllocationErrors.ts` (ya tiene `SharedAccountSavingsError` y `SavingsAllocationNotFoundError`; falta `SavingsAlreadyExistsError`) |
| Puerto específico | `CommonContributionRepository.registerManualContribution` | nuevo en `SavingsAllocationRepository` |
| Adaptador upsert | `DrizzleCommonContributionRepository.ts` L101-139 (tx: `coalesce(max(id),0)+1` → upsert fila → insert movimiento) | `DrizzleSavingsAllocationRepository.ts` |
| Materializador con movimiento | `registerMaterialization` (L63-99) + `MaterializeCommonContributions` | sustituye a `registerDeduction` (fila sin movimiento) |
| KPI lee el enlace | `GetMonthNetContribution` → `findMaterializedMovement` | `GetMonthSavings` gana `backedByMovement` |
| Edición identidad fija | `UpdateMovement` detecta por registro (`findMaterializedMonthByMovement`) | añadir detección de ahorro |
| Borrado movimiento+fila | `DeleteMovement` → `withdrawMaterializationForMovement` | añadir `withdrawDeductionForMovement` (uniforme) |
| Action despachadora | `create-movement.action.ts` (Zod `type` unión; rama `contribution`) | rama `savings` |
| Formulario | `movement-form.tsx` (`ContributionOption`, radio, listener `reset`) | prop paralela `savingsOption` + 4.º radio |
| e2e | `e2e/aportacion-manual.spec.ts` (M1-M7 con limpieza total) | `e2e/ahorro-movimiento.spec.ts` |

**Alternativas consideradas**: generalizar el par (aportación/ahorro) en un «special movement type» abstracto — rechazada por Simplicidad Primero (YAGNI): dos casos de uso paralelos legibles valen menos en abstracción pero más en auditabilidad; una generalización prematura tocaría 032 (ya entregada y probada) sin aportar valor.

---

## R2. Esquema y migración (nº 0009)

**Decisión**: una única migración `drizzle/0009_ahorro-movimiento.sql`:

1. `ALTER TABLE savings_allocation_months ADD COLUMN movement_id integer;` — enlace blando nullable **sin FK** (paridad de `0005_descuento-gastos-comunes.sql` para aportaciones; sin FK porque la fila es dueña del enlace y el borrado del movimiento es gestionado por el caso de uso, nunca por la BD).
2. Siembra de la etiqueta protegida con id fijo y categoría genérica (paridad `0004` + `0008`):

```sql
INSERT OR IGNORE INTO tags (id, name, slug, status, category_id)
VALUES (101, 'Ahorro', 'ahorro', 'active', (SELECT id FROM tag_categories WHERE slug = 'general'));
```

**Rationale**: id fijo 101 (el 100 es «Aportación Común» en `0004`) hace la siembra idempotente e invariante al orden; `category_id` NOT NULL desde 026 exige resolver la genérica por slug. `INSERT OR IGNORE` sobre `tags_slug_unique` (recreada en `0008`) protege re-ejecuciones.

- `src/infrastructure/db/schema/savings-allocations.ts`: `movementId: integer("movement_id")` en `savingsAllocationMonths`.
- `src/infrastructure/db/seed-data.ts`: `SEED_TAGS` += `{ name: "Ahorro", slug: "ahorro" }` (el seed ya siembra por slug con `onConflictDoNothing`, y desde 026 resuelve `category_id` de la genérica).
- `src/domain/tag/SystemTags.ts`: `SAVINGS_TAG_SLUG = "ahorro"` + añadir a `SYSTEM_TAG_SLUGS`. Con solo eso, **todas las protecciones existentes aplican automáticamente**: exclusión del Select «Etiqueta» (`movement-form.tsx`), exclusión de la selección masiva (029), fila protegida en `/tags` con menú reducido a «Mover a categoría…» (026), bloqueo de identidad en el diálogo de edición.

**Alternativas consideradas**: FK con `ON DELETE SET NULL` — rechazada porque rompería el invariante «borrado uniforme» (dejaba filas huérfanas por la espalda); id autoincremental en la siembra — rechazada por no ser idempotente de forma determinista.

---

## R3. Coherencia del `amount_cents` de la fila

**Decisión**: la fila del registro mantiene `amount_cents` como columna existente (NOT NULL) y las dos vías de escritura la dejan **coherente con el movimiento enlazado** en el momento de escribir: el upsert manual hace `SET movement_id = X, amount_cents = <importe del movimiento>` en la rama `DO UPDATE` (re-enlace de huérfana: el importe congelado legacy se sustituye por la realidad declarada por el usuario), y la materialización inserta fila con `amount_cents` = importe del movimiento generado.

**Rationale**: FR-002 + clarify «fila huérfana con importe distinto»: al re-enlazar, el movimiento manual es la realidad declarada; sincronizar la columna evita estados divergentes confusos en la BD (la única lectura del importe de la fila es el fallback de huérfanas, y el KPI prefiere siempre el movimiento). Coste cero: mismo `DO UPDATE`.

**Alternativas consideradas**: dejar `amount_cents` congelado tras el re-enlace — rechazada por dejar datos divergentes sin consumidor; eliminar la columna — fuera de alcance (migración destructiva innecesaria, las huérfanas no re-enlazadas siguen leyéndola).

---

## R4. Nota por defecto y del materializador

**Decisión**: `DEFAULT_NOTE = "Ahorro"` tanto para la vía manual (nota vacía) como para el movimiento del materializador.

**Rationale**: el patrón `Aportación común de {miembro}` nació de la heurística lazy de 021 (resolución de filas legacy por `note LIKE 'Aportación común de %'`). El ahorro **no necesita heurística**: nunca existieron movimientos de ahorro pre-033, así que no hay legacy que resolver. El listado vive dentro de la página de la cuenta (el miembro es implícito), y la etiqueta protegida «Ahorro» identifica la fila igual que el chip «Aportación Común». Además evita una dependencia extra (`AccountRepository`) en el materializador.

**Alternativas consideradas**: `Ahorro de {miembro}` (paridad estética con aportación) — rechazada porque la paridad aquí es con la heurística que ya no aplica; nota vacía — inválida, `Movement.create` exige nota.

---

## R5. Materializador: composición del movimiento en el caso de uso

**Decisión**: `MaterializeSavingsAllocations` pasa de 2 a 3 dependencias (`SavingsAllocationRepository`, `RegularIncomeRepository`, `TagRepository`) y de `registerDeduction(config, mes, amountCents)` a `registerMaterialization(config, mes, movement)` — el caso de uso resuelve la etiqueta por `SAVINGS_TAG_SLUG`, compone `Movement.create` (gasto, naturaleza propia, fecha `${month}-01`, nota «Ahorro») y el adaptador inserta fila (con `movement_id`) + movimiento en una sola tx, con `ON CONFLICT DO NOTHING RETURNING` como guarda de idempotencia. Las guardas de 023 quedan intactas (config activa, ventana `activatedAtMonth ≤ mes ≤ currentMonth`, ingreso regular existente y activo, `isDeducted` como corto-circuito, `amountCents ≥ 1`).

**Rationale**: paridad exacta con `MaterializeCommonContributions`/`registerMaterialization` (019/021): `Movement.create` es la única vía de validación/escritura (FR-006 de 028 aplicado como convención del repo), la idempotencia vive en el registro `UNIQUE (config, mes)`, y la tx única garantiza fila↔movimiento atómicos. `isDeducted` corto-circuita antes de componer: una fila huérfana legacy (023) sigue congelada para el materializador (solo la vía manual la re-enlaza, FR-002/FR-006).

**Alternativas consideradas**: mantener `registerDeduction` y enlazar después con un UPDATE separado — rechazada: dos escrituras no atómicas; componer el movimiento en el adaptador — rechazado: lógica de dominio fuera del caso de uso (VII).

---

## R6. KPI «Ahorro del mes» y composición condicional del saldo

**Decisión**:

- `GetMonthSavings` devuelve `MonthSavingsDTO = { configured, amountCents, backedByMovement }`: config existe → `findDeductedMovement(config, mes)`; si hay movimiento enlazado → importe del movimiento, `backedByMovement: true`; si no → `findDeductedAmount` (fila congelada/huérfana), `backedByMovement: false`. Sin config → `{configured: false, amountCents: 0, backedByMovement: false}`. **Sin heurística lazy** (no hay legacy con movimiento, ver R4).
- Página de cuenta (`page.tsx`), las **dos únicas restas de composición** quedan:
  - `personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents − savings.amountCents` (el ahorro es un gasto de naturaleza propia dentro del closure → se excluye siempre, paridad 024 con la aportación).
  - `netMonthBalanceCents = closure.monthBalanceCents − (savings.backedByMovement ? 0 : savings.amountCents)` (composición condicional: respaldado → el balance ya lo descuenta como movimiento; huérfano → lo resta la composición, como hoy).
- `AccountMonthKpis` no cambia de contrato visible (el DTO extendido fluye; la celda «Ahorro del mes» sigue mostrando `savings.amountCents` y el subtexto «Sin ahorro configurado» con `!configured`).

**Rationale**: FR-004 exige descuento único y UI sin cálculo (constitución VII); la composición vive en la página como en 024/025 (precedente documentado: «la página de cuenta compone las dos únicas restas»). `MonthlyClosure.fromMovements` no se toca: al ser un movimiento real, el closure lo cuenta en `expenseTotalCents`, `personalExpenseCents` y `monthBalanceCents` por construcción — exactamente la coherencia aceptada en clarify.

**Alternativas consideradas**: excluir la etiqueta «Ahorro» dentro del agregado del closure — rechazada: bifurcaría el dominio por una etiqueta y rompería `/summary` y `/annual` (que cuentan el ahorro como gasto, FR-004); calcular el saldo neto en un caso de uso nuevo — rechazado por ahora innecesaria (la resta condicional es composición de lecturas, no lógica de negocio nueva).

---

## R7. Formulario: cuarto radio y estado bloqueado

**Decisión**: `MovementFormType = MovementType | "contribution" | "savings"` (frontera). `movement-form.tsx` añade la prop `savingsOption?: "off" | "available" | "locked"` (reutiliza el tipo tri-estado; `contributionOption` y `savingsOption` son mutuamente excluyentes en modo `locked` — un movimiento es aportación o ahorro, nunca ambos):

- Radio «Ahorro» (4.º) solo si `savingsOption !== "off"`; `value="savings"`.
- `savingsOption === "locked"` (edición de un ahorro) → `<input type="hidden" name="type" value="savings">` + `RadioGroup disabled` (paridad del bloqueo de aportación).
- `initialType`, la sincronización de estado de error y el listener `reset` (restauración del RadioGroup de Radix, SC-004/032) amplían su unión a `"savings"`.
- Con `chosenType === "savings"`: naturaleza y etiqueta implícitas — el fieldset de naturaleza solo se renderiza para `expense`, y el bloque «Etiqueta» no se renderiza para `contribution` ni `savings`.
- `movementFormSchema.superRefine`: rama `savings` espejo de `contribution` — `nature` ausente, `tagId` nulo, nota **opcional** (el caso de uso aplica «Ahorro» si llega vacía).
- Disponibilidad: `CreateMovementDialog` gana `savingsAvailable?: boolean`; la página pasa `savingsAvailable={savings.configured}` — **existencia de config, activa o no** (clarify: la config es un mero ancla de la fila). `GetMonthSavings` ya está en el `Promise.all` de la página: cero lecturas nuevas.
- `GroupedMovementList` arrastra la prop hasta el diálogo (paridad de `contributionAvailable`).

**Rationale**: FR-001; la exclusión del Select «Etiqueta» es automática vía `isProtectedTagSlug` (R2). La detección en el diálogo de edición es por slug en cliente (`movement.tag.slug === SAVINGS_TAG_SLUG` → `savingsOption="locked"`), paridad 032; la del servidor es por registro (`findDeductedMonthByMovement`), la única autoritativa.

**Alternativas consideradas**: un único prop `specialOptions` — rechazada por YAGNI y por mantener el diff de 032 intacto; ofrecer «Ahorro» también en cuenta común — prohibido por spec (edge case «Cuenta común»).

---

## R8. Edición y borrado uniformes

**Decisión**:

- `UpdateMovement` (L38-59 hoy): añade `SavingsAllocationRepository`; `isSavingsMovement = findDeductedMonthByMovement(id) !== null` → congela `type`/`nature`/`tagId` a los del existente (un movimiento no puede ser aportación y ahorro a la vez: las filas de ambos registros tienen `UNIQUE (config, mes)` y enlaces exclusivos). `update-movement.action.ts` mapea `type === "savings"` → `"expense"` + `nature: null` + `tagId: null` (espejo de la rama `contribution`).
- `DeleteMovement`: añade `SavingsAllocationRepository`; tras el intento de aportación, `withdrawDeductionForMovement(id)` — tx única que borra movimiento **y** fila donde `movement_id = id`; si ninguna de las dos retiradas aplica → borrado ordinario. **Uniforme para origen manual y materializado** (decisión del propietario; diferencia deliberada con 032/021): dentro de la ventana de una config activa, el materializador puede regenerarlo en una visita posterior porque la fila ya no existe (guarda por registro reabierta).

**Rationale**: FR-005. La detección por registro (no por slug) es la autoritativa e impide que un gasto manual con la etiqueta —imposible de crear por UI, pero defendible en servidor— congèle identidad por accidente; paridad exacta con 032.

**Alternativas consideridas**: borrado por origen (manual borra fila, materializado la congela — paridad 032) — explícitamente descartada por el propietario en clarify (borrado uniforme).

---

## R9. e2e: combinación propia y colaterales

**Decisión**:

- Nuevo `e2e/ahorro-movimiento.spec.ts`: cuenta **1** (Cuenta de Miembro A) × mes **2026-05** para la vía manual en mes pasado (combinación libre — verificada contra la tabla de combinaciones de todos los specs existentes) + mes en curso para el materializador, serial dentro del fichero, con **limpieza total al final** (borrar movimientos de ahorro e ingreso regular generados, desactivar config de ahorro e ingreso) al estilo M7 de 032. Ojo: «ahorro-movimiento» corre **primero** alfabéticamente (`ah` < `ap`), así que la limpieza restauradora es obligatoria para no contaminar `ingresos-regulares` y `kpis-fijos-cuenta` (cuenta 1, mes en curso).
- **Actualizar** `e2e/porcentaje-ahorro.spec.ts` (023) al nuevo mundo: A2 pasa de «sin movimiento nuevo» a «fila visible con chip Ahorro (−300,00), listado +1», y el saldo neto esperado pasa a `grossCents` tal cual (la fila ya descuenta; numéricamente idéntico al `gross − 30 000` de antes); A6 (limpieza) debe además borrar el movimiento de ahorro (el KPI congelado sigue leyendo 300,00 mientras la fila exista) para dejar la cuenta 2 como hoy.
- Escenarios del spec 033: alta manual en 2026-05 (KPI exacto, saldo con descuento único, gasto personal excluyente, `/summary` contándolo como gasto), re-enlace de huérfana (creando una con el materializador antiguo no es posible en e2e — se cubre en tests de repositorio; el e2e cubre unicidad, edición de importe, borrado reversible y materializador idempotente).

**Rationale**: constitución III (flujo crítico e2e) + convención de aislamiento e2e de AGENTS.md (workers: 1, orden alfabético, BD determinista compartida).

**Alternativas consideradas**: cuenta 2 × 2026-05 (la de 032) — ocupada por `aportacion-manual.spec.ts`; 2026-06 — evitado: `resumen-global.spec.ts` asserta `/summary?month=2026-06` global.

---

## R10. Cobertura de tests (FR-007)

**Decisión** (co-localizados junto al SUT, paridad 032):

- **Dominio**: sin cambios de entidad — solo `SavingsAllocationErrors` ampliado (sin test propio; los errores se prueban en los casos de uso).
- **Aplicación**: `RegisterManualSavings.test.ts` (stubs: movimiento+fila juntos, cuenta común → error, config inexistente → error, **config inactiva → OK**, unicidad pre-check y carrera perdida, nota por defecto, naturaleza/etiqueta implícitas), `MaterializeSavingsAllocations.test.ts` ampliado (movimiento+fila en la misma llamada, idempotencia por registro, guardas intactas), `GetMonthSavings.test.ts` ampliado (`backedByMovement` en sus tres lecturas), `UpdateMovement`/`DeleteMovement` ampliados (identidad congelada, borrado uniforme movimiento+fila).
- **Infraestructura**: `DrizzleSavingsAllocationRepository.test.ts` ampliado contra libsql `:memory:` con migraciones reales (`registerManualSavings` inserta/enlaza, re-enlaza huérfana sincronizando `amount_cents`, unicidad → `null`; `registerMaterialization` fila+movimiento atómicos e idempotente; `withdrawDeductionForMovement` borra ambos; la migración sembró la etiqueta «Ahorro»).
- **Actions**: `create-movement.action.test.ts` (rama `savings`: Zod rutúa, éxito «Ahorro registrado» + `revalidatePath("/", "layout")`, error de unicidad → `_form` con `role="alert"`), `update-movement.action.test.ts` (mapeo `savings` → expense/implícitos).
- **Componentes (jsdom)**: `movement-form.test.tsx` (radio ofrecido con `savingsAvailable` y oculto sin él o en cuenta común; envío `type=savings` sin naturaleza/etiqueta; edición bloqueada con radios disabled y sin Select de etiqueta; restauración del radio tras error — familia SC-004), `account-month-kpis.test.tsx` sin cambios de contrato.
- **e2e**: ver R9.

**Rationale**: espejo del mapa de tests de 032, que la suite ya valida como suficiente para la familia.

---

## R11. Documentación (FR-008)

**Decisión**: ADR 0025 («El ahorro como movimiento: segunda vía de escritura del registro, enlace blando y composición condicional del saldo», relacionado con 0016/0017/0021-análogos de ahorro — 0022/0024); actualización del bloque de convenciones de AGENTS.md (el apartado 023 pasa a referir al ahorro-movimiento; nuevo bloque 033 con las diferencias deliberadas: config como ancla sin exigir activa, borrado uniforme, composición condicional `backedByMovement`); fila `033-ahorro-como-movimiento` del roadmap maestro marcada Completada al cierre.

**Rationale**: constitución (DoD: documentación en el mismo cambio) y FR-008.

---

## Resumen de NEEDS CLARIFICATION (resueltas)

La spec no dejaba extremos técnicos abiertos («matiz a confirmar en el plan»: edición con cambio de fecha a otro mes). **Resolución**: paridad 032 — la fila queda registrada para el mes original (`findDeductedMonthByMovement` no depende de la fecha del movimiento); cambiar la fecha a otro mes **no** crea ni mueve la fila del registro: el KPI del mes original sigue leyendo el movimiento enlazado. Si el usuario mueve el ahorro a otro mes quiere corregir el mes → borrar y re-registrar en el mes correcto (borrado uniforme reversible). Se documenta en data-model y ADR.
