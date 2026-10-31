# Research — KPI de gasto personal del mes en cuentas personales (024)

**Feature**: `024-kpi-gasto-personal` | **Fecha**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

Investigación verificada contra el código real (fuentes citadas por fichero). Toda decisión sigue el formato **Decisión / Rationale / Alternativas**.

---

## §1. Fuente del importe: composición sobre datos ya leídos por la página (FR-002, FR-004)

**Decisión**: el KPI «Gasto personal» = `closure.personalExpenseCents − netContribution.amountCents`, compuesto **una única vez en la página de cuenta** (`page.tsx`) y pasado como prop `personalExpenseCents` (número) a `AccountMonthKpis`. Sin caso de uso, puerto, método de repositorio ni cambio de dominio nuevos.

**Rationale** (verificado en código):

- `MonthlyClosure.fromMovements` ya calcula `personalExpenseTotal` = Σ gastos con `nature = "personal"` del mes (`src/domain/movement/MonthlyClosure.ts:70-72`), y `GetMonthlyClosure` ya lo expone como `personalExpenseCents` (`src/application/movement/GetMonthlyClosure.ts:30`) — la página **ya lo lee hoy** en su `Promise.all` (`src/app/accounts/[accountId]/page.tsx:93`).
- El movimiento de aportación de 019 se materializa con `type: "expense"` y `nature: "personal"` (`src/application/common-contribution/MaterializeCommonContributions.ts:70-78`), por lo que **está dentro** de `personalExpenseCents`. `GetMonthNetContribution` ya devuelve el importe exacto de ese movimiento enlazado (`findMaterializedMovement`; `src/application/common-contribution/GetMonthNetContribution.ts:25-26`) — también **ya leído hoy** por la página (línea 94-99). La resta elimina exactamente la aportación; ambos operandos salen de los mismos movimientos que alimentan listado y cierre → **coherencia por construcción**, cero recálculo paralelo (FR-004).
- Es el precedente congelado de 022/023 para el saldo neto: «la página de cuenta compone una única resta `netMonthBalanceCents = closure.monthBalanceCents − savings.amountCents`» (AGENTS.md, convención 022 amendada por 023; `page.tsx:123`). El componente KPI es presentacional puro: solo formatea (constitución VII).

**Casos verificados de la resta** (todos consistentes):

| Estado del mes | `personalExpenseCents` | `netContribution.amountCents` | KPI resultante |
|---|---|---|---|
| Aportación materializada por importe X | incluye X | X | Σ gastos propios − X ✓ (exclusión exacta) |
| Aportación retirada por neto 0 (021: movimiento **y** fila borrados) | no la incluye | 0 | Σ gastos propios ✓ |
| Movimiento de aportación borrado por el usuario (fila sin movimiento → no-op definitivo) | no lo incluye | 0 | Σ gastos propios ✓ |
| Sin config de aportación / mes fuera de ventana / mes futuro | no la incluye | 0 | Σ gastos propios ✓ |
| Config existente pero aportación 0,00 (p. ej. gastos ≥ bruto retirada previa) | no la incluye | 0 | Σ gastos propios ✓ |
| Ahorro deducido (023) | no lo incluye (no es movimiento) | — | sin doble conteo ✓ (esc. 7) |
| Ingresos (manuales o regulares 018) | nunca entran en `personalExpenseTotal` (`MonthlyClosure.ts:62-65`) | — | nunca computan ✓ (edge «Ingresos») |

**Invariante documentada**: la composición es exacta mientras el movimiento de aportación conserve la `nature: "personal"` con la que el materializador lo crea (el re-sync de 021 la preserva: `MaterializeCommonContributions.ts:124`). La edición manual por el usuario de la naturaleza de ese movimiento del sistema queda fuera de la composición congelada — misma clase de interferencia que 021 ya trata como definitiva (borrado del usuario). No se añade código defensivo (YAGNI, principio I).

**Alternativas rechazadas**:

1. **Nuevo puerto `MovementRepository.sumPersonalExpenseCents(accountId, month)` con `NOT IN` sobre el movimiento enlazado** — recálculo paralelo del mismo agregado que ya produce `MonthlyClosure` (viola FR-004 «sin recálculos paralelos»), duplica la semántica de exclusión en SQL y añade una query por render. Rechazada.
2. **Nuevo caso de uso `GetMonthPersonalExpense`** que internamente re-leyese cierre + aportación — envuelve una resta en una clase y duplica lecturas ya realizadas en el mismo `Promise.all`. Sin valor frente al precedente de composición de página de 022/023. Rechazada (YAGNI).
3. **Calcular en el componente** a partir de `closure` + `netContribution` — viola «la UI jamás recalcula ni resta» (convención 022, constitución VII). Rechazada.

## §2. Layout de 4 métricas: `grid-cols-2 sm:grid-cols-4` (FR-001; punto abierto del roadmap)

**Decisión**: el `dl` del bloque pasa de `grid grid-cols-3 gap-3` a **`grid grid-cols-2 gap-3 sm:grid-cols-4`**, con orden congelado Aportación común · Gasto personal · Ahorro del mes · Saldo del mes (móvil 2×2: fila 1 = Aportación + Gasto personal; fila 2 = Ahorro + Saldo).

**Rationale**: en móvil (~375 px) una fila de 4 columnas da ~80 px por celda: la etiqueta «Aportación común» (16 caracteres, `text-xs`) y los importes `text-xl tabular-nums` (p. ej. «−1.234,56 €») desbordarían o romperían en varias líneas, igual que los subtextos «Sin aportación configurada». 2×2 en móvil conserva la legibilidad de los literales congelados; ≥`sm` se mantiene una fila de 4 como en escritorio hoy. La **visibilidad continua** (SC-001, 022 sticky) no depende del número de filas: la región sigue `sticky top-0 z-20` y visible en todo el desplazamiento; en móvil la barra fija es más alta (~2 filas) pero sigue cabiendo junto al listado. Resuelve el punto «Queda para el plan el layout de 4 métricas» (nota del roadmap, 2026-10-30).

**Alternativas rechazadas**: `grid-cols-4` fijo con texto reducido en móvil (`text-base sm:text-xl`) — rompe la paridad visual de importes con el cierre y añade una variante tipográfica solo para esta tarjeta; scroll horizontal — nunca usado en la app y rompe la lectura de un vistazo (razón de ser de la feature).

## §3. Presentación del valor: magnitud, sin estados, sin subtexto (FR-002; edges)

**Decisión**: el valor se pinta con `formatAmountCents(personalExpenseCents)` (EUR, 2 decimales, sin signo, sin `text-red-600`), **siempre presente** en cuentas personales; mes sin gastos computables → **0,00 €**. No existe literal «Sin configurar» ni variante de estado: no hay configuración detrás (lectura pura).

**Rationale**: paridad con la celda «Aportación común» configurada (magnitud `formatAmountCents`); el rojo queda reservado al «Saldo del mes» negativo (convención del cierre). La spec lo congela: «sin estado tipo "sin configurar"» (edge «Mes sin gastos computables») y el rojo solo es señal de saldo (022 §3).

## §4. Dónde se prueba la composición (FR-008; constitución III)

**Decisión**: la resta vive en `page.tsx` y se verifica en **e2e** (el flujo completo con importes exactos por naturaleza); los tests de componente (`account-month-kpis.test.tsx`) cubren orden congelado de 4 métricas, importe formateado, 0,00 sin subtexto y clases del grid. No hay tests unitarios de `page.tsx` en el repo (022/023 probaron `netMonthBalanceCents` igual: componente + e2e, p. ej. `porcentaje-ahorro.spec.ts` A2 «saldo neto = bruto − 300»).

**Rationale**: consistencia con la suite existente (no se introduce una nueva capa de testeo de páginas RSC para una resta); SC-002/SC-005 exigen coherencia con listado y cierre, que solo es observable end-to-end.

## §5. Aislamiento e2e: Cuenta de Miembro B + mes en curso, fichero `kpi-gasto-personal.spec.ts` (FR-008; constitución III)

**Decisión**: e2e propio en `e2e/kpi-gasto-personal.spec.ts` sobre **`/accounts/2` (Cuenta de Miembro B) + mes en curso**, con **barrido defensivo inicial** (borrar «Hipoteca» si existe, patrón D1/A1) y **limpieza total UI-driven final que restaura el estado de entrada** (borrar movimientos creados incluida la aportación materializada y el ingreso regular materializado, desactivar aportación e ingreso regular, y **restaurar «Hipoteca»** shared 850,00 — espejo de D11 en `descuento-gastos-comunes.spec.ts`).

**Rationale** (matriz de ocupación verificada, `workers: 1` + orden alfabético sobre `e2e.sqlite` compartida):

- Posición alfabética del fichero nuevo: entre `ingresos-regulares.spec.ts` y `kpis-fijos-cuenta.spec.ts`. Estado de **entrada** verificado: tras `descuento-gastos-comunes.spec.ts` D11, la cuenta 2 queda con «Hipoteca» (shared 850,00), configs de aportación e ingreso **desactivadas** y sin movimientos de sistema.
- Estado de **salida** requerido por los vecinos posteriores: `porcentaje-ahorro.spec.ts` A1 tolera aportación activa (la desactiva) pero hace barrido defensivo de «Hipoteca», exige ítem «Ahorro» en `Sin configurar|Desactivado|Requiere ingreso regular` y toma `movementsBeforeSavings` como línea base; `kpis-fijos-cuenta.spec.ts` no toca la cuenta 2; `registro-movimientos.spec.ts` aserta balance absoluto (de ahí la restauración de «Hipoteca», que D11 ya restauró por la misma razón). Restaurar el estado de entrada (espejo D11) cumple a todos.
- **Por qué no la cuenta 1** (usada por `ingresos-regulares` e `kpis-fijos-cuenta`, ambas anteriores al fichero nuevo): `kpis-fijos-cuenta.spec.ts` K0 (que correría **después**) exige literalmente «Sin aportación configurada» en la cuenta 1 → exige que **no exista** fila de config de aportación; la UI no permite borrar configs (solo desactivar), y 024 necesita aportación materializada para probar la exclusión FR-002 → contaminaría K0 irremediablemente. Cuenta 1 descartada.
- La exclusión de la aportación (FR-002) exige aportación materializada, y esta solo se genera para meses dentro de la ventana `activatedAtMonth ≤ mes ≤ currentMonth` (019/021): **un mes pasado fijo (estilo `panel-cuentas` 2026-03) no puede tener aportación** vía UI → tampoco vale. Cuenta 2 + mes en curso es la única combinación viable.

**Alternativas rechazadas**: cuenta 1 + mes en curso (rompe K0, ver arriba); cuenta 2 + mes pasado fijo (sin aportación materializable, no prueba la exclusión); amendar `kpis-fijos-cuenta.spec.ts` para tolerar config en cuenta 1 (modificar specs existentes por razón de estado rompe la convención de aislamiento y FR-006 del espíritu «intactos»).

## §6. Superficie de cambio y no-cambios (FR-005, FR-006, FR-007)

**Decisión**: ficheros tocados exactamente: `src/app/accounts/[accountId]/page.tsx` (+1 prop compuesta), `src/infrastructure/primary/ui/account-month-kpis.tsx` (grid + celda), `src/infrastructure/primary/ui/account-month-kpis.test.tsx` (casos FR-008), `e2e/kpi-gasto-personal.spec.ts` (nuevo) y documentación (AGENTS.md 3→4 métricas, roadmap fila 024, diagramas vivos). **Cero** cambios en dominio, aplicación, puertos, repositorios, esquema/migraciones, actions, formularios, agregados, cuenta común, cierre, resumen, anual y balance.

**Rationale**: la feature es una agregación de lectura pura (spec, «Key Entities»: no hay entidades nuevas). Ninguna puerta nueva de dependencia; el orden de la página (3 awaits secuenciales de materialización + `Promise.all`) queda intacto (FR-005).

**Alternativas rechazadas**: refactor oportunista del bloque KPI a subcomponentes por celda — sin necesidad (una celda más del mismo `dl`); extender `MonthlyClosureDTO` con un campo «personal neto» — movería lógica de composición de la aportación (módulo `common-contribution`) al módulo `movement`, acoplando agregados sin necesidad.

## §7. Matriz de tests por capa (FR-008; SC-005)

| Capa | Fichero | Casos |
|---|---|---|
| Componente (jsdom) | `account-month-kpis.test.tsx` (MODIFICADO) | (a) orden congelado de 4 métricas; (b) importe exacto formateado (`20055` → «200,55 €», sin signo); (c) mes sin gastos computables → 0,00 € **sin** subtexto (nunca «Sin configurar»); (d) grid `grid-cols-2` + `sm:grid-cols-4` y región sticky intacta; (e) actualización de tests existentes de orden/grid (3→4). |
| E2E (Playwright, serial en fichero) | `kpi-gasto-personal.spec.ts` (NUEVO) | G1 barrido defensivo + configs (ingreso 2.000,00 + aportación 25 %); G2 gastos de distinta naturaleza (personales 120,55 + 80,00, común 60,00) → KPI **200,55** con aportación neta **440,00** y saldo mes **+1.299,45** (exclusión exacta, sin dobles conteos); G3 tanda de 12 gastos personales de 10,00 → KPI 320,55 al alta (FR-007) y región KPIs en viewport al bajar al fondo (SC-001); G4 ‹ mes anterior → KPI 0,00 con etiqueta del mes consultado (SC-004) y › vuelve a 320,55; G5 ingreso manual no computa (KPI estable); G6 cuenta común sin bloque KPIs (esc. 6); G7 limpieza total con restauración de «Hipoteca» y KPI final 0,00. |

Importes congelados del happy path (verificados): aportación bruta 500,00 − gastos comunes 60,00 = neta **440,00**; Σ gastos = 60,00 + 200,55 + 440,00 = 700,55; saldo bruto = 2.000,00 − 700,55 = **+1.299,45** (sin ahorro configurado, neto = bruto).

## §8. Documentación y ADR (FR-009)

**Decisión**: sin ADR nuevo. La feature es consecuencia directa de los contratos 022/023 y de la composición de página ya registrada; la convención del bloque KPIs en AGENTS.md se amendará (3 → 4 métricas, grid `grid-cols-2 sm:grid-cols-4`) y los diagramas vivos de `docs/architecture/diagrams/` se extenderán con la celda nueva al implementar. Roadmap: fila 024 → Completada al cerrar.

**Rationale**: no hay decisión arquitectónica nueva (ni patrón ni estructuración): la composition formula `personalExpenseCents = closure.personalExpenseCents − netContribution.amountCents` es la misma figura ya documentada para el saldo neto (023 §4). Alternativa (ADR «KPI de lectura compuesta») rechazada: duplicaría el registro existente.

---

**NEEDS CLARIFICATION**: ninguno — todos los puntos del Technical Context y de la spec quedan resueltos contra código en §1–§8.
