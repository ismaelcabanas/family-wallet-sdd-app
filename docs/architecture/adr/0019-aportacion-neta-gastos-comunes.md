# 19. Aportación neta de gastos comunes: re-sincronización en lectura del mes en curso y enlace blando

- **Fecha**: 2026-10-19
- **Estado**: Aceptado (feature 021, `specs/021-descuento-gastos-comunes/`)
- **Relacionados**: [ADR 0007](./0007-dinero-centimos-enteros.md) (aritmética monetaria entera), [ADR 0016](./0016-materializacion-perezosa-ingresos-regulares.md) (disparador único), [ADR 0017](./0017-aportacion-comun-porcentaje-materializacion.md) (aportación porcentual que esta decisión modifica)

## Contexto y problema

La aportación de 019 es un importe **bruto** fijo (porcentaje half-up sobre el ingreso regular) que ignora los gastos de naturaleza común pagados directamente desde la cuenta personal: el miembro aporta dos veces el mismo dinero y debe editar a mano el movimiento generado para cuadrar. La feature 021 exige que el importe pase a **neto** (bruto − Σ gastos comunes del mes con suelo 0) y que el **mes en curso** se mantenga sincronizado con la regla al consultar la cuenta, sin duplicados y sin ampliar el disparador único (ADR 0016/0017). Tres problemas nuevos: (1) dónde vive el cálculo neto, (2) cómo identificar el movimiento generado sin marcar `movements` ni secuestrar gastos manuales «clon», y (3) cómo distinguir la **retirada** por regla (neto 0) del **borrado definitivo** del usuario (FR-006 de 019). Research en `specs/021-descuento-gastos-comunes/research.md`.

## Opciones consideradas

1. **Aritmética en el caso de uso con `Money.subtract`**: `Money.fromCentsOrZero` permitiría negativos y la regla (bruto − gastos con suelo) es de dominio, no de orquestación.
2. **Filtrar `listByMonthAndAccount` en memoria**: duplica el criterio de alcance fuera de la SQL y empeora la apertura del mes.
3. **Hooks en el CRUD de movimientos** (`Create`/`Update`/`DeleteMovement`): triplica el disparador, obliga a `DeleteMovement` a conocer cuenta/mes y duplica la revalidación que ya hacen las actions.
4. **Búsqueda heurística pura en cada re-sincronización** (tag + día 1 + nota): secuestra un gasto manual «clon» registrado tras un borrado definitivo (escenario explícito de la spec).
5. **Backfill SQL en la migración**: imposible de cubrir en tests (`createTestDb` migra una BD vacía; el UPDATE nunca se ejercita) y un fallo silencioso dejaría el mes sin ajuste.
6. **FK `ON DELETE SET NULL`**: comportamiento dependiente del pragma `foreign_keys` del runtime (libSQL/Turso) y duplica el enlace blando.
7. **Flag `withdrawn` en el registro**: tercer estado que duplica la semántica de «fila ausente».

## Decisión

- **Cálculo neto en el VO**: `ContributionPercentage.netAppliedToCents(incomeCents, sharedExpenseCents) = max(0, appliedToCents(incomeCents) − sharedExpenseCents)` — enteros puros; el redondeo half-up sigue viviendo solo en `appliedToCents` (extensión ADR 0007/0017). La suma de gastos comunes viaja en `MovementRepository.sumSharedExpenseCents(accountId, month)`: un `SUM` SQL sellado (`account_id` + `type='expense'` + `nature='shared'` + rango `[mes-01, mesSiguiente-01)`) servido por `idx_movements_account_date`; el caso de uso no filtra listados en memoria.
- **Re-sincronización en lectura** dentro de `MaterializeCommonContributions.ensureForAccountAndMonth` (guardas congeladas en data-model §1.2.1): si el mes está registrado **y es el mes en curso**, se recalcula el neto y se ajusta el movimiento con `movements.update(Movement.recreate(...))` (id, fecha y orden del listado intactos); sin escritura si el importe no cambia (idempotente). Mes registrado ≠ mes en curso → congelado (FR-003). La guarda `config.active` se evalúa **solo en la rama de generación** (clarify 2026-10-18: desactivar detiene la generación futura, no congela el mes en curso). Ingreso regular ausente/inactivo en re-sincronización → conserva el último importe (sin base no hay bruto que descontar).
- **Enlace blando `movement_id`** en `common_contribution_months` (migración `0005`, `ALTER TABLE` sin FK ni datos): identifica el movimiento generado sin tocar `movements` (ADR 0016/0017 la descartaron como columna de origen). `registerMaterialization` lo persiste en la misma tx que el movimiento; **filas legacy (NULL) se resuelven perezosamente** por heurística acotada (misma cuenta, `{mes}-01`, gasto propio, slug `aportacion-comun`, prefijo de nota «Aportación común de », `ORDER BY id LIMIT 1`) con persistencia del enlace (auto-sanado); sin coincidencia → `null` → mes congelado. El caso de uso usa solo el enlace, nunca la heurística.
- **Retirada ≠ borrado**, discriminado por la fila del registro: neto 0 en re-sincronización ⇒ `withdrawMaterialization` (tx: `DELETE` movimiento + `DELETE` fila; la generación queda reabierta y la aportación reaparece si los gastos bajan). Borrado del usuario (⋮ → Eliminar) ⇒ deja la fila huérfana ⇒ `findMaterializedMovement` → `null` ⇒ no-op **definitivo** aunque cambie el neto (FR-006). Generación con neto 0 ⇒ no-op **sin registrar el mes** (mismo guard que el bruto < 1 de 019).
- **Sin cambios en el adaptador inbound**: la página de cuenta solo inyecta `movementRepository` (tercer parámetro del materializador); UI, actions, cierres, `/summary` y `/annual` intactos (pueden ir un ajuste por detrás hasta visitar la cuenta — ADR 0016/0017).

## Consecuencias

- **Positivas**: un único punto de verdad temporal (la lectura de la página de cuenta); el ajuste ocurre en el mismo render que la revalidación de las actions de movimiento (0 pasos manuales); la heurística corre una sola vez por fila legacy y queda sellada en el repositorio, testeada contra libsql `:memory:` con migraciones reales; retirada y borrado se distinguen sin flags ni estados extra.
- **Negativas / trade-offs**: excepción consciente al patrón «backfill en migración» de `0002`/`0004` (resolución perezosa por testabilidad, documentada aquí); el registro de meses pasa de marcador a dueño del enlace y gana una operación de escritura adicional (`withdrawMaterialization`); `/summary` y `/annual` leen el importe vigente sin garantía de frescura hasta visitar la cuenta (aceptado por el propietario, ADR 0016/0017).
- La edición manual del movimiento generado del mes en curso se sustituye por el importe neto en la siguiente consulta; la vía para fijar un importe distinto sigue siendo eliminar la aportación (definitiva) y registrar un gasto manual.
