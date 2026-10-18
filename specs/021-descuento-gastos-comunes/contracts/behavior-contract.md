# Behavior Contract — Descuento de gastos comunes en la aportación mensual (021)

**Feature**: `021-descuento-gastos-comunes` | **Componentes**: `MaterializeCommonContributions` + puertos `CommonContributionRepository`/`MovementRepository` (MODIFICADOS), adaptadores Drizzle (MODIFICADOS), migración `0005` (NUEVA) | **Retirado**: nada | **Intactos**: toda la UI, actions, formularios, vistas y casos de uso de configuración (019/018), CRUD de movimientos (003/013/014), cierres y agregados (005–012).

La feature **no expone interfaces nuevas** al usuario ni a otros sistemas: no hay pantallas, endpoints ni acciones nuevas. Este contrato congela el **comportamiento observable** que sí cambia —el importe del movimiento de aportación y su ciclo de vida por consulta— y declara explícitamente lo que no cambia (extiende [019 ui-contract §4](../019-aportacion-comun/contracts/ui-contract.md)).

---

## 1. El movimiento de aportación: importe neto (FR-001, FR-004; escenarios 1–4)

- Al materializarse por primera vez, la aportación muestra **bruto − Σ gastos de naturaleza común del mes en la cuenta personal del miembro**, con **suelo 0**: nunca negativo, nunca 0,00 € (si nete cero, el mes carece de movimiento).
- Presentación **intacta** respecto de 019 (ui-contract §4): nota «Aportación común de {miembro}», etiqueta «Aportación Común», día 1, firma −importe, editable y eliminable como cualquier movimiento.
- El excedente de gastos comunes sobre el bruto **no** descuenta meses siguientes ni se acumula.

## 2. Sincronización del mes en curso (FR-002; escenarios 2, 5, 11, 13; SC-001/SC-002)

- Tras **cualquier** alta, edición o eliminación de un gasto común del mes en curso, la **siguiente consulta de la página de la cuenta** muestra la aportación con el importe neto vigente, en un único movimiento, sin duplicados. El ajuste nunca requiere acción manual.
- Consultas repetidas (5+) sin cambios: exactamente 1 aportación con el mismo importe (sin escrituras).
- Con la aportación **desactivada a mitad de mes**, el movimiento ya generado del mes en curso **sigue ajustándose** mientras exista (la desactivación detiene la generación futura, no congela el mes en curso).
- Desaparece/reaparece por la regla: gastos ≥ bruto ⇒ sin movimiento; si los gastos bajan ⇒ la aportación reaparece con el neto vigente.

## 3. Congelado y borrado (FR-003/FR-006; escenarios 6, 10, 12)

- Meses cerrados (anteriores al en curso): su aportación es inmutable ante cualquier mutación posterior de gastos comunes.
- Eliminar la aportación desde la fila (⋮ → Eliminar) sigue siendo **definitivo**: no reaparece aunque el neto cambie o vuelva a ser ≥ bruto.
- Cambios de porcentaje/ingreso regular en pleno mes: el mes en curso recalcula en la siguiente consulta; los cerrados conservan su importe.

## 4. Alcance (FR-005; escenarios 8, 9)

- Solo descuentan gastos de naturaleza común de la **propia cuenta personal**; gastos propios, ingresos, movimientos de la cuenta común o de otros miembros: sin efecto.
- La ventana de generación de 019 no se amplía: meses anteriores a la activación o futuros siguen sin aportación.

## 5. Vistas y agregados (FR-008)

- Cierre mensual, resumen global y cuenta anual computan la aportación neta **leyendo los movimientos como hoy**: reglas, literales y presentación intactas. (`/summary` y `/annual` pueden mostrar el importe previo al último ajuste hasta que se visite la página de la cuenta: decisión ADR 0016/0017 intacta.)

## 6. Puertos y persistencia (contrato interno congelado)

```ts
CommonContributionRepository (extiende 019):
  findMaterializedMovement(contributionId, month): Promise<Movement | null>
  withdrawMaterialization(contributionId, month): Promise<boolean>

MovementRepository (extiende existente):
  sumSharedExpenseCents(accountId, month): Promise<number>

common_contribution_months.gana: movement_id integer NULL (enlace blando, sin FK)
Migración: drizzle/0005_descuento-gastos-comunes.sql (solo ALTER TABLE; sin datos)
```

- `registerMaterialization` persiste `movement_id` en la misma tx que el movimiento (firma pública invariante: `Promise<boolean>`).
- Filas legacy (`movement_id` NULL) se resuelven perezosamente por heurística acotada (cuenta + día 1 + gasto + naturaleza propia + slug `aportacion-comun` + prefijo de nota) y persisten el enlace; sin coincidencia ⇒ mes congelado.

## 7. Selectores estables para tests

| Elemento | Selector |
|----------|----------|
| Aportación (e2e/unit UI) | `getByRole("listitem").filter({ hasText: "Aportación común de Miembro B" })` (nota; igual que 019) |
| Importe de la aportación | `toContainText("−379,45")` etc. sobre el ítem anterior |
| Ausencia (neto 0 / borrado) | `toHaveCount(0)` sobre el filtro anterior |

## 8. Fuera de alcance (this contract)

Contrapartida automática en la cuenta común, arrastre de excedentes o «deuda común», recálculo retroactivo, cambios en cierres/resumen/anual, cambios en formularios o diálogos de movimiento, badges de origen, información del cálculo en el diálogo de configuración, notificaciones y generación por calendario.
