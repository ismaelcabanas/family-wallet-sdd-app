# Research — Descuento de gastos comunes en la aportación mensual (021)

**Feature**: `021-descuento-gastos-comunes` | **Fecha**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

Esta feature modifica el cálculo de 019 (aportación porcentual): el importe pasa de bruto fijo a **neto de los gastos de naturaleza común del mes en la cuenta personal del miembro**, y el movimiento del **mes en curso** se mantiene sincronizado con la regla al consultar la cuenta. Cada decisión de abajo se toma reutilizando la maquinaria ya verificada de 018/019 (ADR 0016/0017); las citas de código están verificadas contra el árbol actual de `feature/021-descuento-gastos-comunes`.

---

## §1 — Cálculo del importe neto: fórmula y ubicación (FR-001, FR-004; escenarios 2–4; edges «Suelo cero», «Céntimos»)

**Estado actual (verificado)**:

- El bruto se calcula hoy en `MaterializeCommonContributions` L45: `config.percentage.appliedToCents(income.amount.amountCents)` — `floor((cents×bp + 5 000)/10 000)` half-up entero en el VO `ContributionPercentage` (`src/domain/common-contribution/ContributionPercentage.ts` L26-28).
- `Money` (`src/domain/movement/Money.ts`) tiene `fromCents` (> 0), `fromCentsOrZero`, `add`, `subtract`, `equals`; ninguna operación de porcentaje ni de suelo.
- La suma de gastos comunes no existe como consulta: `MovementRepository` (`src/application/movement/MovementRepository.ts`) solo expone `create/listByMonthAndAccount/listByMonth/listByYear/findById/update/delete`; sin filtro por naturaleza ni agregados SQL.

**Decisión**:

1. Nueva operación **del VO** `ContributionPercentage`:

   ```text
   netAppliedToCents(incomeCents, sharedExpenseCents) =
     max(0, appliedToCents(incomeCents) − sharedExpenseCents)
   ```

   Enteros puros, extensión natural de `appliedToCents` (ADR 0007/0017). El redondeo half-up aplica solo a la parte porcentual; la sustracción de céntimos exactos no introduce redondeo (assumption de la spec).
2. La suma de gastos comunes viaja en un método nuevo del puerto de movimientos:

   ```ts
   MovementRepository.sumSharedExpenseCents(accountId: AccountId, month: string): Promise<number>
   ```

   `SELECT coalesce(sum(amount_cents), 0) FROM movements WHERE account_id = ? AND type = 'expense' AND nature = 'shared' AND date ≥ {month}-01 AND date < {mesSiguiente}-01` — un único SUM indexado por `(account_id, date)` (edge «Rendimiento»: no degrada la apertura del mes). El alcance (cuenta del miembro, gastos, naturaleza común, mes de la **fecha**) queda sellado en la SQL y testeado a nivel de repositorio; el caso de uso no filtra listados en memoria.
3. Casos congelados de la tabla del VO (tests): 25 % × 200 000 − 12 000 = 38 000 (380,00 €); − 12 055 = 37 945 (379,45 €, céntimos exactos); − 50 000 = 0; − 62 000 = 0 (nunca negativo, sin arrastre).

**Rationale**: la fórmula es una regla de cálculo del agregado aportación; ubicarla junto a `appliedToCents` mantiene el dominio puro y testeable por tabla, y evita repartir aritmética entre el caso de uso y el adaptador. El SUM en el puerto evita cargar el listado completo del mes para calcular un descuento (la página ya carga el listado después, en el `Promise.all`).

**Alternativas consideradas**:

- *Calcular en el caso de uso con `Money.subtract`*: rechazado; `Money.fromCentsOrZero` permitiría negativos y la regla (bruto − gastos con suelo) es de dominio, no de orquestación.
- *Filtrar `listByMonthAndAccount` en memoria*: rechazado; duplica el criterio de alcance fuera de la SQL, acopla el descuento al DTO con tag y empeora el rendimiento.
- *Servicio de dominio aparte*: rechazado; una sola operación nueva no justifica un colaborador más (YAGNI, constitución I).

## §2 — Dónde vive la sincronización del mes en curso: re-sincronización en lectura (FR-002; escenarios 2, 5, 11, 13; Assumptions)

**Estado actual (verificado)**:

- El único disparador de materialización es la página de cuenta (`src/app/accounts/[accountId]/page.tsx` L64-75: `MaterializeRegularIncomes` y después `MaterializeCommonContributions`, antes del `Promise.all`). Agregados y `/summary`/`/annual` nunca materializan (ADR 0016/0017; decisión del propietario 2026-10-12).
- Las actions de movimiento (`create/update/delete-movement.action.ts`) terminan con `revalidatePath("/accounts/[accountId]", "page")` → el siguiente render de la página de cuenta re-ejecuta `ensureForAccountAndMonth`, que hoy hace no-op si el mes está registrado (`isMaterialized`, L36-38).
- Ninguno de los tres casos de uso de CRUD de movimiento conoce la aportación; `DeleteMovement` solo recibe `movementId`.

**Decisión**:

1. La sincronización vive **dentro de `MaterializeCommonContributions.ensureForAccountAndMonth`**, en la rama que hoy hace early-return: si el mes está registrado **y es el mes en curso**, se **re-sincroniza** (recalcular neto y ajustar el movimiento generado) en vez de volver. Si el mes registrado no es el en curso, sigue siendo no-op (congelado, FR-003).
2. No se añaden hooks a `CreateMovement`/`UpdateMovement`/`DeleteMovement`: el ajuste ocurre al consultar la cuenta (mismo disparador que 019, assumption de la spec), las actions ya revalidan la página de cuenta y el re-cálculo completo por consulta es idempotente por construcción (compara el neto con el importe vigente antes de escribir).

**Rationale**: mantiene un único punto de verdad temporal (la lectura de la página de cuenta), no propaga la regla a tres casos de uso que no la necesitan y conserva el disparador único del ADR 0016/0017. La revalidación existente de las actions garantiza que el flujo «registrar gasto → ver aportación ajustada» ocurre en el mismo render (SC-001: 0 pasos manuales).

**Alternativas consideradas**:

- *Recalcular dentro de las actions de movimiento*: rechazado; duplica el disparador, obliga a `DeleteMovement` a conocer cuenta/mes (hoy solo `movementId`) y a resolver «¿la mutación afecta a alguna aportación?» en cada escritura.
- *Recrear el movimiento (borrar + insertar) en cada re-sincronización*: rechazado; cambia el id y el orden del listado (`date desc, id desc`) y genera escrituras innecesarias; basta con actualizar el importe.
- *Materializar también en `/summary` y `/annual` para frescura*: rechazado; rompería la decisión del propietario (ADR 0016/0017) y añadiría escrituras en vistas de agregación.

## §3 — Identificar el movimiento generado: enlace blando `movement_id` en el registro de meses (FR-002/FR-006; escenarios 5, 10; edge «Edición manual»)

**Estado actual (verificado)**:

- El registro `common_contribution_months` **no guarda** la id del movimiento generado (ADR 0016/0017: `movements` sin marca de origen; la fila solo marca «mes ya generado»).
- El movimiento generado se identifica hoy solo heurísticamente: gasto, naturaleza `personal`, fecha `{month}-01`, etiqueta slug `aportacion-comun`, nota `Aportación común de {miembro}`. `MovementDTO.tag.slug` está disponible en los joins, pero ni el puerto ni el repo tienen consulta por tag.
- La spec contempla explícitamente «eliminar la aportación (definitiva) y registrar un gasto manual» (edge «Edición manual del movimiento de aportación»): un gasto manual con la misma etiqueta/día 1/naturaleza propia es un escenario real que una búsqueda heurística pura secuestraría (le sobrescribiría el importe o lo borraría con neto 0), violando FR-006.

**Decisión**:

1. **Columna nueva** `common_contribution_months.movement_id INTEGER` (sin FK, enlace blando) vía migración `0005_descuento-gastos-comunes.sql` (`ALTER TABLE … ADD COLUMN`). Sin FK a propósito: el borrado del movimiento por el usuario **no debe** chocar con ninguna restricción, y la fila debe sobrevivirle (borrado definitivo = fila presente sin movimiento).
2. `registerMaterialization` (tx del adaptador Drizzle) calcula la id del movimiento (`coalesce(max(id),0)+1`) **antes** de insertar la fila del registro y la persiste en `movement_id`; la firma del puerto no cambia (`Promise<boolean>`).
3. **Resolución perezosa para filas legacy** (NULL): nuevo método del puerto `findMaterializedMovement(contributionId, month) → Movement | null` que, si `movement_id` es NULL, resuelve por heurística acotada —misma cuenta que la config, `date = {month}-01`, `type = 'expense'`, `nature = 'personal', etiqueta slug `aportacion-comun`, nota con prefijo `Aportación común de `, `ORDER BY id LIMIT 1`— y persiste la id resuelta (auto-sanado). Si no hay coincidencia (p. ej. el usuario ya borró el movimiento antes de desplegar 021), devuelve `null` y el mes queda congelado.
4. El caso de uso usa el enlace, nunca la heurística: si `findMaterializedMovement` devuelve `null` con fila presente ⇒ borrado del usuario ⇒ no-op definitivo (FR-006).

**Rationale**: la fila del registro es la única fuente de verdad de «mes generado» (ADR 0016/0017); convertirla también en dueña del enlace al movimiento generado evita cualquier ambigüedad con movimientos manuales del usuario, sin tocar `movements` (que sigue sin columna de origen). La resolución perezosa es testeable de principio a fin contra libsql `:memory:` (a diferencia de un backfill SQL en la migración, que correría sobre BD vacía en tests y quedaría sin cobertura — ver §7).

**Alternativas consideradas**:

- *Búsqueda heurística en cada re-sincronización (sin columna)*: rechazada; secuestra gastos manuales «clon» tras un borrado definitivo (escenario explícito de la spec).
- *Backfill SQL en la migración 0005*: rechazado como vía principal; imposible de cubrir en tests (`createTestDb` migra una BD vacía: el UPDATE nunca se ejercita) y un fallo silencioso dejaría el mes en curso sin ajuste. Se mantiene como excepción consciente al patrón «migración de datos» de `0002`/`0004`, documentada aquí y en el ADR 0019.
- *Columna `generated_by` en `movements`*: rechazada; ADR 0016/0017 la descartaron expresamente (YAGNI; la idempotencia vive en el registro).
- *FK `ON DELETE SET NULL`*: rechazada; añade una restricción whose comportamiento depende del pragma `foreign_keys` del runtime (libSQL/Turso) y duplica lo que ya resuelve el enlace blando + el tratamiento de NULL.

## §4 — Neto cero: retirada de la aportación por la regla vs. borrado definitivo del usuario (FR-002/FR-004/FR-006; escenarios 4, 10)

**Estado actual (verificado)**: `Money.fromCents` rechaza ≤ 0 (no existe movimiento de 0,00 €); el registro de meses es append-only: la fila sobrevive al borrado del movimiento y bloquea la regeneración para siempre (semántica 019).

**Decisión**:

1. **Generación** (mes no registrado): si el neto < 1 céntimo → no-op **sin registrar el mes** (misma guard que el bruto < 1 de 019). Consecuencia deseada: si los gastos comunes bajan después, la aportación aparece en la siguiente consulta (la ventana de generación sigue abierta).
2. **Re-sincronización** (mes en curso registrado, movimiento presente): si el neto pasa a 0 → **retirada**: nueva operación del puerto `withdrawMaterialization(contributionId, month)` que en **una tx** borra el movimiento enlazado y **la fila del registro**. La desaparición de la fila reabre la generación: si los gastos vuelven a bajar, la aportación reaparece con el neto vigente (FR-002: el mes en curso está sincronizado con la regla en ambos sentidos).
3. **Borrado del usuario** (vía fila ⋮ → Eliminar): no toca la fila del registro ⇒ `findMaterializedMaterialization`… (`findMaterializedMovement`) devuelve `null` ⇒ no-op definitivo, aunque el neto cambie (FR-006, escenario 10). La distinción retirada/borrado no necesita flag alguno: la retirada elimina fila+movimiento; el borrado del usuario elimina solo el movimiento.

**Rationale**: FR-004 exige que un mes con neto 0 «carezca de movimiento de aportación» y FR-002 exige que el mes en curso refleje altas **y eliminaciones** de gastos comunes; solo la retirada con borrado de fila consigue ambos sin estados intermedios (ni movimientos de 0,00 € —prohibidos por `Money`— ni flags «retirado»).

**Alternativas consideradas**:

- *Mantener la fila y el importe a 0*: imposible (`Money` > 0) y conceptualmente erróneo (un gasto de 0,00 € en el listado).
- *Mantener la fila con flag `withdrawn`*: rechazado; añade un tercer estado al registro que duplica exactamente la semántica de «fila ausente» (la generación ya está guardada por `isMaterialized`).
- *Eliminar solo el movimiento y dejar la fila*: rechazado; la aportación no reaparecería al bajar los gastos (violación de FR-002 en el sentido eliminaciones→altas).

## §5 — Meses cerrados congelados y desactivación a mitad de mes (FR-003/FR-007; escenarios 6, 12, 13; clarify 2026-10-18)

**Estado actual (verificado)**: las guardas de `ensureForAccountAndMonth` (config activa → ventana `activatedAtMonth ≤ month ≤ currentMonth` → `!isMaterialized` → ingreso activo → bruto ≥ 1) viven en `MaterializeCommonContributions.ts` L27-48; `deactivate()` conserva `activatedAtMonth` y no toca el registro.

**Decisión** (orden nuevo de guardas, ver data-model §1.2.1):

1. La guarda de config activa **se evalúa solo en la rama de generación**. La rama de re-sincronización (mes registrado + mes en curso) se ejecuta **aunque la config esté desactivada** (clarify 2026-10-18: la desactivación detiene la generación futura, no congela el importe del mes en curso; FR-007).
2. Congelado simple: mes registrado y `month !== currentMonth` → return inmediato (FR-003). Los meses aún no materializados dentro de la ventana se materializan **ya netos** (FR-003: la rama de generación usa el neto desde el primer instante — escenario 7).
3. En re-sincronización, si el ingreso regular falta o está inactivo → **no-op conservando el último importe**: sin base no hay bruto que descontar (decisión análoga a la de 019 para la generación; la alternativa de usar el importe vigente como base especula con un porcentaje sobre una base desconocida).

**Rationale**: la spec distingue explícitamente generación (condiciones de 019 intactas, FR-007) de importe (regla nueva); partir la guarda de `active` entre ramas es la traducción literal de esa distinción. El congelado por comparación `month !== currentMonth` es estable (lexicográfico `YYYY-MM`) y no requiere persistir nada al cambiar de mes.

**Alternativas consideradas**:

- *Aplicar la guarda de config activa también a la re-sincronización*: rechazada; contradice el clarify del propietario (escenario 13).
- *Congelar el mes al cerrarse con un job/migración*: rechazado; serverless sin cron (Out of Scope) y la comparación con `currentMonth` ya lo resuelve en lectura.
- *Re-sincronizar con la base del último cálculo cacheado*: rechazado; introduce estado derivado persistido (anti-ADR 0009) y complejidad extra para un caso (ingreso desactivado a mitad de mes) que la spec no exige ajustar.

## §6 — Vistas, agregados y frescura de lectura (FR-008; edge «Rendimiento»)

**Estado actual (verificado)**: cierre mensual (`GetMonthlyClosure`), resumen global (`GetGlobalMonthlySummary`), cuenta anual (`GetAnnualIncomeStatement`) y `getBalance` componen desde los movimientos sin materializar ni ajustar nada; solo la página de cuenta dispara los dos materializadores.

**Decisión**: cero cambios en esas vistas y en sus casos de uso. Consecuencia documentada y aceptada: `/summary` y `/annual` pueden mostrar el importe de la aportación **anterior al último ajuste** hasta que se visite la página de la cuenta (la action que muta el gasto revalida la página de la cuenta, no los agregados). FR-008 exige exactamente eso: computan «leyendo los movimientos como hoy».

**Rationale**: mantener la decisión del propietario 2026-10-12 (ADR 0016/0017) y el Out of Scope de la spec («Cambios en las reglas de cierre mensual, cuadre, resumen global o cuenta de resultados anual»).

**Alternativas consideradas**: *revalidar `/summary` y `/annual` desde las actions de movimiento para frescura total*: rechazada; no elimina la ventana de carrera (otro tab puede consultar antes) y añade revalidaciones en cascada fuera del alcance.

## §7 — Migración 0005 y filas legacy (constitución V)

**Estado actual (verificado)**: `drizzle/` contiene 5 migraciones (journal `meta/_journal.json`, últimas `0003_absurd_ronan` generada y `0004_aportacion-comun` manual con dato); el patrón de alteración manual existe (`0002`).

**Decisión**: `0005_descuento-gastos-comunes.sql` contiene una única sentencia DDL sin datos:

```sql
ALTER TABLE common_contribution_months ADD COLUMN movement_id integer;
```

más su entrada en `meta/_journal.json`. Las filas existentes quedan a `NULL` y se resuelven perezosamente en la primera re-sincronización (§3). El esquema Drizzle (`schema/common-contributions.ts`) añade `movementId: integer("movement_id")` sin `references`.

**Rationale**: la única evolución estructural necesaria es una columna opcional; todo lo demás es comportamiento. Evitar el backfill SQL mantiene la migración trivialmente verificable y ejercita el mismo camino en dev, tests y producción (la resolución perezosa corre una vez por fila legacy).

**Alternativas consideradas**: *migración con UPDATE de backfill*: rechazada por testabilidad (§3); *recrear la tabla con FK*: rechazada, innecesaria en SQLite para añadir una columna.

## §8 — Tests y aislamiento e2e (FR-010; constitución III; convención AGENTS.md)

**Estado actual (verificado)**:

- Ocupación e2e (orden alfabético sobre `e2e.sqlite` compartida, `workers: 1`): `aportacion-comun` (cuenta 2 + mes en curso, con limpieza) → `cierre-mensual` (**cuenta 2 + mes en curso**: registra «Aportación» ingreso 1 920, «Hipoteca» gasto compartido 850, «Gasolina» personal 60) → `creacion-tags` (cuenta 2) → `cuenta-resultados-anual` (cuenta 2, meses 2027 fijos) → **`descuento-gastos-comunes`** → `edicion-movimientos` (cuenta 2, julio/agosto 2026 fijos) → `gestion-tags` (cuenta 2) → `ingresos-regulares` (**cuenta 1 + mes en curso**: aserta «Sin configurar» en el menú de A) → `pagina-cuenta` (cuenta 2, meses fijos; P4/P7 visitan el mes en curso sin asertir contenido) → `panel-cuentas` (sin contenido) → `registro-movimientos` (cuentas común y A) → `resumen-global` (2026-06/2025-01).
- La ventana de 019 obliga al mes en curso: la activación siempre arranca en el mes en curso (reactivar resetea `activatedAtMonth`), así que un mes pasado no puede materializarse por primera vez en e2e (019 research §8).

**Decisión**:

1. **Combinación: Cuenta de Miembro B (`/accounts/2`) + mes en curso real**, fichero `e2e/descuento-gastos-comunes.spec.ts`, serial. Es la única combinación viable: la cuenta 1 está descartada porque `ingresos-regulares` (posterior) aserta el estado «Sin configurar» de sus menús —cualquier config que 021 deje en A lo rompería— y la cuenta común no admite aportación (FR-005).
2. **Barrido inicial determinista**: la spec corre después de `cierre-mensual`, que deja un gasto compartido («Hipoteca», 850,00) en el mes en curso de B. El primer paso lo **elimina** (si existe) para partir de descuento 0; la **limpieza final lo re-registra** (850,00, compartido, etiqueta Hipoteca) y desactiva aportación e ingreso regular, dejando B en el estado exacto en que la encontró (patrón de limpieza de 019 A6, reforzado). Los movimientos no compartidos de `cierre-mensual` (ingreso 1 920, «Gasolina» 60) no intervienen en el cálculo y no se tocan.
3. Flujo: D1 configurar (ingreso 2 000 + 25 %) → aportación −500,00 única; D2 registrar gasto compartido 120,55 → −379,45 (céntimos exactos); D3 idempotencia (recargas + `/summary` + `/annual` → 1 ítem, mismo importe); D4 segundo gasto 80 → −299,45 (suma); D5 editar 120,55→150 → −270; D6 eliminar el de 80 → −350; D7 gasto 400 (total ≥ bruto) → **desaparece** (suelo cero); D8 eliminar el de 400 → **reaparece** a −350 (retirada → regeneración); D9 gasto personal + ingreso no cambian nada; D10 borrar la aportación → no reaparece aunque cambie el neto (definitivo); D11 limpieza (§8.2).
4. **Matriz unitaria**: dominio (tabla del VO neto: descuento parcial, céntimos, suelo 0, excedente); aplicación sobre dobles in-memory (`MaterializeCommonContributions`: generación neta directa, neto 0 sin registrar, re-sincronización por alta/edición/eliminación con dobles del SUM, idempotencia sin escritura si el importe no cambia, retirada con neto 0 y regeneración posterior, borrado del usuario (fila sin movimiento) congelado aunque cambie el neto, mes cerrado registrado congelado, config desactivada re-sincroniza el mes en curso pero no genera, ingreso ausente en re-sincronización → conserva importe, alcance solo cuenta/mes del SUM delegado al repo); repositorios contra libsql `:memory:` (`sumSharedExpenseCents`: solo gastos `shared` de la cuenta y el mes —excluye personales, ingresos, otras cuentas, otros meses—; `registerMaterialization` persiste `movement_id`; `findMaterializedMovement` con enlace directo, con resolución perezosa de legacy (heurística + persistencia) y `null` tras borrado; `withdrawMaterialization` borra movimiento+fila en tx e idempotente).

**Rationale**: la convención de aislamiento exige combinación propia; al compartir obligadamente cuenta 2 + mes en curso con `cierre-mensual` (previo) y `pagina-cuenta`/`gestion-tags` (posteriores, sin asertos de contenido en ese mes), el barrido inicial + la restauración final hacen los asertos de 021 independientes del contenido previo y devuelven la BD intacta a los specs posteriores.

**Alternativas consideradas**:

- *Cuenta 1 + mes en curso*: rechazada; imposible de limpiar (no existe «desconfigurar», solo desactivar, y `ingresos-regulares` aserta «Sin configurar» en A).
- *Mes pasado dentro de la ventana*: imposible; la activación arranca en el mes en curso (FR-007 de 019).
- *Depender de los importes de `cierre-mensual` sin barrido*: rechazado; acopla los asertos de 021 a los datos de otra spec (frágil ante su evolución).

## §9 — Documentación viva, ADR y roadmap (FR-009; DoD constitución)

**Decisión**:

1. **ADR 0019** (`0019-aportacion-neta-gastos-comunes.md`): registra la modificación del cálculo de 019 —neto = bruto − gastos comunes del mes con suelo 0 (extensión de ADR 0007/0017)—, la re-sincronización en lectura del mes en curso (rctime único disparador; meses cerrados congelados), el enlace blando `movement_id` con resolución perezosa (frente a backfill SQL, por testabilidad) y la semántica retirada-frente-a-borrado (fila del registro como discriminante).
2. Diagrama vivo `docs/architecture/diagrams/aportacion-comun-secuencia.md` extendido con la variante de re-sincronización (base: el de este plan); `domain-model.md` solo si procede (no hay entidades nuevas).
3. **AGENTS.md**: la convención «Materialización perezosa» gana la nota de 021 (la aportación del mes en curso se re-sincroniza en la misma lectura; retirada con neto 0; borrado del usuario definitivo por la fila del registro).
4. **Roadmap** (`specs/001-family-wallet/spec.md`): fila `021-descuento-gastos-comunes` (Completada al cerrar) y nota datada 2026-10 amendando el cálculo de 019.

**Rationale**: la constitución (DoD §3) y FR-009 exigen ADR + documentación en el mismo cambio.

**Alternativas consideradas**: *ampliar el ADR 0017*: rechazada; 0017 está cerrado y esta feature cambia una decisión suya (importe bruto fijo, inmutabilidad de lo generado) — merece contexto y registro propios que citen la modificación.

---

## Resumen de decisiones

| Tema | Decisión | Alternativa rechazada |
|------|----------|----------------------|
| Cálculo neto (§1) | `ContributionPercentage.netAppliedToCents` (max(0, bruto − gastos)) + `MovementRepository.sumSharedExpenseCents` SQL | Aritmética en el caso de uso; filtrado en memoria; servicio de dominio |
| Sincronización (§2) | Re-sincronización en lectura dentro de `ensureForAccountAndMonth` (mes registrado + en curso); sin hooks en CRUD | Hooks en actions/use cases; recrear movimiento; materializar en agregados |
| Identificación (§3) | `movement_id` blando en el registro + resolución perezosa con heurística acotada (nota/tag/día-1/propia) | Heurística pura; backfill SQL; columna en `movements`; FK SET NULL |
| Neto cero (§4) | Generación: no-op sin registrar; re-sincronización: retirada (borrar movimiento + fila en tx) → reaparece si bajan los gastos | Movimiento a 0; flag `withdrawn`; dejar solo la fila |
| Congelado/desactivación (§5) | `month !== currentMonth` → congelado; re-sincronización ignora `config.active` (clarify); ingreso ausente → conserva importe | Guarda de activa global; job de cierre; base cacheada |
| Vistas (§6) | Intactas; `/summary`-`/annual` pueden ir un ajuste por detrás hasta visitar la cuenta | Revalidar agregados |
| Migración (§7) | `0005` = solo `ALTER TABLE … ADD COLUMN movement_id` | Backfill SQL en migración |
| Tests/e2e (§8) | Cuenta 2 + mes en curso; barrido inicial de «Hipoteca» y restauración final; matriz dominio/aplicación/repo | Cuenta 1 (imposible limpiar); mes pasado (imposible materializar) |
| Docs (§9) | ADR 0019 + diagrama extendido + AGENTS.md + roadmap | Ampliar ADR 0017 |
