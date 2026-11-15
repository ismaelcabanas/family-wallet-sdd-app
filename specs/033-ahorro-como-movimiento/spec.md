# Feature Specification: El ahorro mensual como movimiento editable

**Feature Branch**: `feature/033-ahorro-como-movimiento`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Necesito establecer el dato del ahorro de los meses anteriores al mes actual — tras haber importado gastos de otros meses, o para poder actualizar el dato de algún mes pasado. Actualmente el ahorro no se computa como un movimiento". Reencuadrado con el propietario (2026-11-15, sesión de diseño previa a specify): el ahorro pasa a comportarse **como un movimiento**, dual de la aportación común (032) — incluible y editable en cualquier momento.

**Fuente**: Petición del propietario (2026-11-15); continuación directa de la feature futura que 032 dejó apuntada («El ahorro de meses pasados sigue sin vía»). Diagnóstico verificado sobre el código: el ahorro vive hoy como **apartado informativo congelado** en `savings_allocation_months` (023), sin movimiento — el KPI «Ahorro del mes» lee esa fila (`GetMonthSavings`), la página descuenta el ahorro del «Saldo del mes» por composición (`closure.monthBalanceCents − savings.amountCents`), y `/summary` y `/annual` no lo conocen. No existe vía para fijar el ahorro de un mes pasado fuera de la ventana de la config (visitas nunca realizadas, meses anteriores a la activación, huecos inactivos), ni para corregir una cantidad ya congelada.

**Granularidad** (constitución II): una única user story pequeña con valor propio — el ahorro como movimiento que se incluye y edita en cualquier momento. El paso del materializador (023) a crear movimiento enlazado y el ajuste de las composiciones KPI son consecuencias del mismo cambio de modelo, no historias con valor independiente: sin ellas, unos meses tendrían ahorro-movimiento y otros no, y el modelo quedaría incoherente.

## Clarifications

### Session 2026-11-15

- Q: ¿El ahorro como movimiento (patrón 032) o como registro manual sin movimiento (upsert sobre la tabla registro)? → A: **Movimiento** (decisión del propietario): «el ahorro debería comportarse de igual manera [que la aportación común], como un movimiento que pueda incluir o editar en cualquier momento». Dual de 032: gasto de naturaleza propia con etiqueta protegida implícita + fila del registro enlazada en la misma transacción. Se asumen y aceptan sus consecuencias (ver FR-004).
- Q: ¿El ahorro computaría entonces como gasto en el cierre mensual, `/summary` y `/annual`, y reduciría el saldo? → A: **Aceptado** por el propietario (coherencia por construcción: listado, KPIs y agregados cuentan lo mismo).
- Q: ¿Y el doble descuento del «Saldo del mes» (hoy la composición ya resta el ahorro)? → A: **Composición condicional**: cuando el ahorro está respaldado por movimiento, el balance ya lo descuenta y la composición deja de restarlo; las filas huérfanas legacy (sin movimiento) siguen restándose como hoy. El DTO del KPI expone el respaldo.
- Q: ¿Migración/backfill de las filas ya congeladas (sin movimiento)? → A: **Sin backfill automático** (decisión del propietario): «las añadiría yo manualmente». La vía manual re-enlaza la fila huérfana existente al movimiento nuevo (paridad del re-enlace de 032).
- Q: ¿El materializador automático? → A: **Como la aportación común** (decisión del propietario): pasa a crear movimiento + fila enlazada en la misma transacción (paridad 019/021), con idempotencia por registro.
- Q: ¿Se exige config de ahorro? → A: **La config es un mero ancla de la fila** (la guarda «0 o 1» es `UNIQUE (config, mes)`): para la vía manual basta que la config **exista**, **sin exigir que esté activa** — así se cubren meses anteriores a la activación y huecos inactivos con el importe real. La guarda de «activa» sigue aplicando solo al materializador (paridad 023).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar, editar y borrar el ahorro de cualquier mes como un movimiento (Priority: P1)

Como único usuario de la aplicación, quiero que el ahorro mensual sea un movimiento real — añadirlo a mano en cualquier mes (también pasados, con el importe real que ocurrió), y editarlo o borrarlo como a cualquier otro movimiento — y que el ahorro de la config se materialice también como movimiento, para que listado, KPI «Ahorro del mes», «Saldo del mes» y los agregados cuenten lo mismo por construcción y mi histórico quede completo y corregible.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy el ahorro de un mes pasado no tiene vía de ajuste (registro congelado leído por el KPI, sin movimiento, sin edición) y los meses fuera de la ventana de la config no registran ahorro en absoluto.

**Independent Test**: Se puede probar importando/registrando un mes pasado de una cuenta personal con config de ahorro (aunque esté inactiva), añadiendo a mano un movimiento de tipo «Ahorro» (importe y fecha) y verificando: el movimiento aparece en el listado del mes, el KPI «Ahorro del mes» muestra exactamente ese importe, el «Saldo del mes» lo descuenta una sola vez, «Gasto personal» lo excluye, y `/summary` y `/annual` lo cuentan como gasto. Edición de importe → el KPI refleja el cambio; borrado → el mes queda a 0 y admite registrar otro.

**Acceptance Scenarios**:

1. **Given** un mes de una cuenta personal con config de ahorro existente (aunque inactiva o activada después de ese mes), sin fila en el registro, **When** creo un movimiento de tipo **«Ahorro»** (importe y fecha; naturaleza propia y etiqueta protegida implícitas), **Then** el movimiento se crea visible en el listado y, en la misma transacción, se escribe la fila de `savings_allocation_months` enlazada al movimiento (`movement_id`), de modo que el KPI «Ahorro del mes» muestra ese importe.
2. **Given** un mes con fila congelada huérfana (legacy de 023, sin movimiento), **When** registro el ahorro manual de ese mes, **Then** la fila existente se re-enlaza al movimiento nuevo (sin error de unicidad, sin segunda fila) y el KPI pasa a leer el movimiento enlazado.
3. **Given** un mes que ya tiene movimiento de ahorro (manual o del materializador), **When** intento guardar otro movimiento de tipo «Ahorro» en ese mes y cuenta, **Then** se produce un error con mensaje al usuario y el movimiento no se guarda (regla de unicidad, FR-001).
4. **Given** un mes dentro de la ventana de una config activa (p. ej. el mes en curso) sin registro, **When** visito la página de la cuenta, **Then** el materializador crea el movimiento de ahorro (porcentaje × ingreso regular) y su fila enlazada en la misma transacción (paridad 019/021); re-visitas y recargas no generan ni ajustan nada (idempotencia por registro).
5. **Given** un movimiento de ahorro existente, **When** lo edito, **Then** solo puedo cambiar importe, nota y fecha (identidad fija; tipo, naturaleza y etiqueta inmutables) y el KPI refleja el importe editado por construcción (lee el movimiento enlazado).
6. **Given** un movimiento de ahorro existente, **When** lo elimino, **Then** se eliminan movimiento y fila del registro en la misma transacción (el mes vuelve a 0) y puedo registrar un nuevo ahorro en ese mes (regla «0 o 1» reversible, FR-005).
7. **Given** un mes con ahorro (respaldado por movimiento o fila huérfana legacy), **When** consulto la página de la cuenta, **Then** «Saldo del mes» descuenta el ahorro exactamente una vez (si hay movimiento, ya lo descuenta el balance; si es huérfana, lo resta la composición) y «Gasto personal» lo excluye siempre.
8. **Given** varios meses con ahorro registrado, **When** consulto `/summary` y `/annual`, **Then** cuentan el ahorro como gasto y cuadran con listado y KPIs.
9. **Given** las configs (ingreso regular, aportación, ahorro), **When** uso la vía manual, **Then** ninguna config cambia — `activatedAtMonth`, porcentajes y estados intactos.

---

### Edge Cases

- **Mes en curso con config activa**: el registro manual está permitido también ahí (paridad 032); si ya existe fila (manual o materializada), el materializador la respeta — la coexistencia manual-primero en el mes en curso se concreta en el plan.
- **Borrado de ahorro en un mes dentro de la ventana activa**: el materializador puede volver a generarlo (porcentaje × ingreso) en una visita posterior, como ocurre con la aportación en 032 — matiz a confirmar en el plan (hoy 023 registra también meses pasados visitados dentro de ventana).
- **Sin config de ahorro**: el tipo «Ahorro» no se ofrece en el alta (no hay fila enlazable — la fila referencia la config por FK).
- **Cuenta común**: el tipo «Ahorro» no se ofrece (paridad 032).
- **Importe manual «equivocado»**: la app no valida contra porcentajes; corregir = editar el movimiento (el KPI lee el enlazado). Asumido por diseño (fuente: realidad histórica del propietario).
- **Fila huérfana con importe distinto del movimiento manual**: al re-enlazar, el KPI pasa a leer el movimiento; se asume que el movimiento manual es la realidad que el usuario declara para ese mes.
- **Edición con cambio de fecha a otro mes**: paridad 032 — la fila queda registrada para el mes original; matiz a confirmar en el plan.
- **Importador (028)**: sigue sin traer ahorro (paridad con 032: el usuario registra el ahorro a mano tras importar el resto).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (tipo de gasto «Ahorro» con etiqueta protegida implícita y regla de unicidad)**: El alta de movimiento MUST ofrecer un **tipo de gasto independiente «Ahorro»** (cuenta personal con config de ahorro existente, sin exigir activa): elegido el tipo, la naturaleza **propia** y la etiqueta protegida **«Ahorro»** (nueva, no seleccionable a mano en el flujo de gasto genérico) quedan implícitas — el usuario solo teclea importe (y fecha/nota); sin nuevo `MovementType` de dominio (concepto de frontera, paridad 032). El sistema MUST aplicar la regla de dominio **máximo 1 movimiento de ahorro por cuenta y mes** («0 o 1»), cualquiera que sea su origen: al guardar un segundo → error con mensaje al usuario y el movimiento no se guarda. La creación del primer movimiento de ahorro de un mes MUST escribir, en la misma transacción, la fila de `savings_allocation_months` enlazada al movimiento (`movement_id`); el importe lo teclea el usuario (realidad histórica, sin recálculo ni validación contra porcentajes).
- **FR-002 (re-enlace de filas huérfanas legacy, sin backfill)**: Un mes con fila en el registro pero **sin movimiento** (congelada por 023) MUST seguir admitiendo el registro manual: la fila existente se re-enlaza al movimiento nuevo (actualización del enlace cuando esté vacío), sin error de unicidad ni segunda fila. NO se realiza backfill automático de meses históricos: el propietario completa su histórico manualmente.
- **FR-003 (materializador crea movimiento)**: El materializador de 023 MUST pasar a crear el **movimiento de ahorro** (misma composición: gasto, naturaleza propia, etiqueta protegida «Ahorro», importe porcentaje × ingreso regular bruto) **y la fila enlazada en la misma transacción**, con idempotencia por registro (`UNIQUE (config, mes)` + inserción condicional) y las guardas de 023 intactas (config activa, ventana `activatedAtMonth ≤ mes ≤ mesEnCurso`, ingreso regular existente y activo). Paridad con 019/021.
- **FR-004 (KPIs y agregados coherentes)**: El KPI «Ahorro del mes» MUST seguir leyendo el registro, nunca recalculando en la UI: importe del **movimiento enlazado** cuando exista, si no la cantidad congelada de la fila (paridad `GetMonthNetContribution`). El DTO del KPI MUST exponer si el ahorro está respaldado por movimiento. «Saldo del mes» MUST descontar el ahorro **exactamente una vez** (composición condicional: respaldado → el balance ya lo descuenta; huérfano → la composición lo resta, como hoy). «Gasto personal» MUST excluir el ahorro siempre (paridad de la exclusión de la aportación, 024). `/summary`, `/annual` y el informe anual cuentan el ahorro como gasto por construcción, sin exclusiones.
- **FR-005 (edición identidad fija, borrado reversible)**: La edición de un movimiento de ahorro (manual o generado) MUST limitarse a **importe, nota y fecha** — tipo, naturaleza y etiqueta inmutables; convertirlo en gasto normal = borrar y crear. Borrar un movimiento de ahorro MUST eliminar también su fila del registro en la misma transacción (el mes vuelve a «sin ahorro» y admite registrar otro). Paridad de las reglas de 032.
- **FR-006 (config como ancla, materializador y congelados intactos)**: La vía manual solo MUST requerir **existencia** de la config de ahorro (no activa). El registro manual MUST NOT cambiar `activatedAtMonth` ni ningún otro campo de ninguna config, y MUST NOT reabrir, reajustar ni borrar meses ya registrados por el materializador (congelados).
- **FR-007 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad de los casos de uso (manual: movimiento + fila en la misma transacción, unicidad con error, re-enlace de huérfanas; materializador: movimiento + fila, idempotencia), action (Zod, ruta del tipo «Ahorro»), componente del formulario (tipo ofrecido con config existente, oculto en cuenta común o sin config; importe/naturaleza/etiqueta implícitos; error de unicidad con `role="alert"`), y un e2e del recorrido completo (alta manual en mes pasado → listado + KPI + composiciones correctas) en combinación cuenta/mes propia (convención de aislamiento e2e; constitución III).
- **FR-008 (documentación)**: Al completar la feature, el roadmap maestro MUST marcar la fila `033-ahorro-como-movimiento` como Completada; el ahorro como movimiento (segunda vía de escritura del registro + enlace blando + composición condicional) se registra como ADR y, si nace convención nueva, en AGENTS.md.

### Key Entities

Cambios en el papel de entidades existentes (con cambios de esquema acotados):

- **Etiqueta protegida «Ahorro»** (nueva): slug `ahorro`, protegida — no renombrable ni eliminable, no seleccionable a mano (paridad «Aportación Común» de 004/026); nace en migración y en el seed.
- **`savings_allocation_months` (registro de materialización)**: gana el **enlace blando `movement_id`** (sin FK, paridad de la migración `0005` de aportaciones) y una **segunda vía de escritura** — además del materializador, la creación manual de un movimiento de ahorro escribe/enlaza la fila; idempotencia por `UNIQUE (config, mes)`.
- **Movimiento de ahorro**: gasto de naturaleza propia con etiqueta protegida «Ahorro»; sin nuevo `MovementType` de dominio (concepto de la frontera UI, paridad 032).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Fijar o corregir el ahorro de cualquier mes (diálogo de alta habitual: tipo «Ahorro» + importe) toma menos de 30 segundos y no requiere pasos ocultos ni tocar configs.
- **SC-002**: El KPI «Ahorro del mes» muestra exactamente el importe registrado, al céntimo; listado, KPI, «Saldo del mes» (descuento único) y agregados (`/summary`, `/annual`) cuadran por construcción.
- **SC-003**: Cero duplicados: re-visitas y recargas no generan nada nuevo; los meses congelados por el materializador quedan intactos y las configs no cambian.
- **SC-004**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde tras la feature.

## Assumptions

- El importe manual es la **realidad histórica** del mes (fuente: memoria/Excel del propietario); la app no lo calcula ni valida contra porcentajes de la config.
- El materializador pasa a crear movimientos **desde el despliegue**; no se generan movimientos retroactivos automáticos (sin backfill — el propietario completa su histórico a mano vía FR-002).
- El nombre de la etiqueta protegida es «Ahorro» (slug `ahorro`), paridad de la etiqueta «Aportación Común».
- El resto de gastos e ingresos de esos meses ya está registrado (importado con 028 o a mano); esta feature añade/corrige el ahorro.
- Un solo usuario sin concurrencia real; aún así toda escritura re-valida en servidor (frontera de confianza).

## Out of Scope

- **Backfill automático** de meses históricos (el propietario los añade manualmente, FR-002).
- **Retro-activación de configs** y botón «generar meses pendientes» (descartados en el clarify de 032).
- **Extender el importador (028)** para traer filas de ahorro (paridad 032: registro manual tras importar).
- **Segundo movimiento de ahorro en un mes** («ahorro extraordinario»): bloqueado por la regla de unicidad; posible iteración futura si surge el caso real.
- Cualquier cambio en las configs o su ventana de activación; reabrir, reajustar o borrar meses congelados por el materializador.
