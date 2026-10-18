# Feature Specification: Descuento de gastos comunes en la aportación mensual

**Feature Branch**: `feature/021-descuento-gastos-comunes`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Quiero añadir una nueva regla de negocio. Actualmente, cada mes se añade un movimiento de aportación común de cada cuenta personal. La nueva regla de negocio debe sustraer de la cantidad de la aportación común cada movimiento de gasto de naturaleza "común" que se genere en el mes."

**Fuente**: Petición directa del propietario (2026-10-18). **Modifica el cálculo de 019** (`specs/019-aportacion-comun/spec.md`): la aportación mensual porcentual deja de ser un importe fijo (porcentaje sobre el ingreso regular) y pasa a ser un importe **neto**: al importe bruto se le restan los gastos de naturaleza común registrados en el mes en la cuenta personal del miembro. La aportación deja de duplicar lo que el miembro ya ha pagado directamente como gasto común desde su cuenta personal.

**Granularidad** (constitución II): una única user story pequeña con valor propio — la aportación del mes refleja automáticamente los gastos comunes ya pagados, sin edición manual del movimiento generado. No aplica excepción.

## Clarifications

### Session 2026-10-18

- Q: Si la aportación se desactiva a mitad del mes en curso con el movimiento ya generado, ¿deben los gastos comunes registrados después seguir reduciendo ese movimiento? → A: Sí: el ajuste del mes en curso continúa mientras el movimiento de aportación exista; la desactivación detiene la generación futura, no congela el importe del mes en curso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aportación neta de los gastos comunes del mes (Priority: P1)

Como miembro con aportación configurada (019), quiero que cada gasto de naturaleza común que registro en mi cuenta personal durante el mes reduzca el importe de mi aportación de ese mes, para no aportar dos veces el mismo dinero: lo que ya he pagado directamente como gasto común se descuenta de lo que debo aportar.

**Why this priority**: Es la única historia de la feature y su razón de ser: hoy la aportación es un porcentaje fijo que ignora los gastos comunes pagados desde la cuenta personal, obligando a editar a mano el movimiento generado para cuadrar.

**Independent Test**: Se puede probar configurando un ingreso regular de 2.000 € y una aportación del 25 % (019), consultando el mes (aportación de 500 €), registrando después un gasto de naturaleza común de 120 € en ese mes y reconsultando la cuenta: la aportación pasa a mostrar 380 € sin edición manual; consultas repetidas no duplican ni alteran el importe.

**Acceptance Scenarios**:

1. **Given** un miembro con ingreso regular de 2.000 € y aportación activa del 25 %, **When** consulta el mes en curso (sin gastos comunes todavía), **Then** su cuenta personal muestra la aportación de 500 € con la etiqueta «Aportación Común», como hasta ahora.
2. **Given** la aportación de 500 € ya materializada en el mes en curso, **When** el miembro registra un gasto de naturaleza común de 120 € en su cuenta personal fechado en ese mes, **Then** al consultar de nuevo la cuenta la aportación muestra 380 € (500 − 120), en un único movimiento, sin duplicados.
3. **Given** varios gastos comunes registrados en el mes en curso (p. ej. 120 € y 80 €), **When** se consulta la cuenta, **Then** la aportación descuenta la suma exacta de todos ellos (500 − 200 = 300 €).
4. **Given** gastos comunes del mes en curso por un total igual o superior al importe bruto de la aportación (p. ej. 620 € con bruto de 500 €), **When** se consulta la cuenta, **Then** ese mes no existe movimiento de aportación (importe neto cero) y el excedente de 120 € no descuenta aportaciones de otros meses.
5. **Given** un gasto común del mes en curso, **When** el miembro lo edita (p. ej. de 120 € a 150 €) o lo elimina, **Then** la aportación del mes en curso refleja el cambio al consultar la cuenta (380 € → 350 €, o vuelta a 500 € si se elimina).
6. **Given** un mes ya cerrado (anterior al en curso) con su aportación materializada, **When** se registran, editan o eliminan gastos comunes fechados en ese mes cerrado, **Then** la aportación de ese mes cerrado no cambia.
7. **Given** un mes aún no materializado dentro de la ventana de activación, **When** se consulta por primera vez con gastos comunes ya registrados en él, **Then** la aportación se materializa ya neta (bruto − gastos comunes de ese mes), no primero bruta y luego ajustada.
8. **Given** un gasto de naturaleza **propia** (o un ingreso) registrado en la cuenta personal del mes, **When** se consulta la cuenta, **Then** la aportación no cambia: solo computan los gastos de naturaleza común.
9. **Given** gastos registrados en la cuenta común (de cualquier naturaleza), **When** se consulta la cuenta personal del miembro, **Then** la aportación del miembro no cambia: solo descuentan gastos de su propia cuenta personal.
10. **Given** la aportación generada del mes en curso, **When** el miembro la elimina, **Then** no se regenera al consultar de nuevo ese mes (el borrado sigue siendo definitivo, como en 019).
11. **Given** consultas repetidas de la cuenta (5 o más) sin cambios en los gastos del mes, **Then** la aportación aparece exactamente una vez y con el mismo importe neto.
12. **Given** la ventana temporal de 019 (meses anteriores a la activación o futuros), **When** se consultan, **Then** no se genera aportación neta alguna: la regla de descuento no amplía la ventana de generación.
13. **Given** la aportación desactivada a mitad del mes en curso con su movimiento ya generado, **When** se registran gastos comunes nuevos en ese mes y se consulta la cuenta, **Then** la aportación del mes en curso sigue reduciéndose (la desactivación detiene la generación futura, no congela el importe del mes en curso).

---

### Edge Cases

- **Suelo cero**: si la suma de gastos comunes iguala o supera el bruto, el neto es cero y no existe movimiento de aportación ese mes; nunca se genera un importe negativo ni un ingreso compensatorio.
- **Excedente sin arrastre**: el excedente de gastos comunes sobre el bruto (p. ej. 120 € si el bruto es 500 € y los gastos 620 €) no reduce la aportación de meses siguientes ni se acumula.
- **Mes al que pertenece el descuento**: un gasto común descuenta en el mes de su **fecha**, no en el del momento de registro (un gasto fechado el mes pasado registrado hoy no toca la aportación del mes en curso).
- **Recomputación solo del mes en curso y de meses aún no materializados**: meses ya materializados y cerrados quedan congelados; un gasto común registrado con fecha de un mes cerrado no lo reabre.
- **Edición manual del movimiento de aportación en el mes en curso**: el importe del mes en curso se rige por la regla; una edición manual del movimiento generado se sustituye por el importe neto en la siguiente consulta que recalcule. Quien quiera fijar un importe distinto puede eliminar la aportación (definitiva) y registrar un gasto manual.
- **Cambio de porcentaje o de ingreso regular (019) en pleno mes en curso**: el mes en curso recalcula con la configuración vigente en la siguiente consulta; los meses cerrados conservan su aportación.
- **Gasto común de importe con céntimos** (p. ej. 120,55 €): la resta es exacta al céntimo sobre el bruto redondeado (parte porcentual con redondeo half-up de 019, luego sustracción en céntimos enteros).
- **Gasto común eliminado del mes en curso**: la aportación sube de nuevo en la siguiente consulta (el descuento desaparece con el gasto).
- **Etiqueta del gasto común**: el descuento aplica a cualquier gasto de naturaleza común con independencia de su etiqueta.
- **Miembro sin aportación configurada o desactivada**: la regla no genera nada nuevo; sin cambios respecto a 019. Si la aportación estaba activa y se desactiva a mitad del mes en curso, el movimiento ya generado del mes en curso sigue ajustándose a la regla (descuenta gastos comunes) mientras exista; la desactivación detiene la generación de meses futuros, no congela el importe del mes en curso.
- **Ingresos**: los movimientos de ingreso carecen de naturaleza (regla de dominio) y nunca computan en el descuento.
- **Rendimiento**: el cálculo con descuento no degrada apreciablemente la apertura del mes.
- **Arranque de la regla**: los meses ya materializados antes de la puesta en marcha conservan su importe; la regla aplica al mes en curso y a los meses aún no materializados desde entonces.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (importe neto)**: El sistema MUST calcular el importe de la aportación de un mes como el **importe bruto** (porcentaje sobre el ingreso regular, redondeo half-up al céntimo, según 019) **menos la suma de los movimientos de gasto de naturaleza común fechados en ese mes y registrados en la cuenta personal del miembro**, con suelo en cero. La resta MUST realizarse en céntimos enteros, sin aritmética de coma flotante.
- **FR-002 (ajuste del mes en curso)**: El sistema MUST mantener la aportación del **mes en curso** sincronizada con la regla: altas, ediciones y eliminaciones de gastos comunes del mes en curso MUST reflejarse en el importe de la aportación al consultar la cuenta, sin intervención manual. El ajuste MUST ser idempotente: consultas repetidas producen exactamente un movimiento de aportación con el importe neto vigente, nunca duplicados.
- **FR-003 (meses cerrados congelados)**: Una vez el mes deja de ser el mes en curso, su aportación MUST permanecer inmutable ante altas, ediciones o eliminaciones posteriores de gastos comunes fechados en ese mes. Los meses aún no materializados dentro de la ventana de activación (019) MUST materializarse directamente con el importe neto.
- **FR-004 (suelo cero sin arrastre)**: El importe neto MUST nunca ser negativo. Si resulta cero, ese mes MUST carecer de movimiento de aportación. El excedente de gastos comunes sobre el bruto MUST NOT descontarse de otros meses ni acumularse.
- **FR-005 (alcance del descuento)**: Solo computan en el descuento los gastos de naturaleza común de la **cuenta personal del miembro** cuya aportación se calcula. Los movimientos de la cuenta común y los de otras cuentas personales MUST permanecer sin efecto sobre la aportación. La cuenta común MUST seguir sin configuración de aportación (019).
- **FR-006 (borrado definitivo)**: La eliminación manual del movimiento de aportación de un mes MUST seguir siendo definitiva para ese mes (019): consultas posteriores no lo regeneran, aunque el importe neto cambie. La regla de descuento ajusta el movimiento generado solo mientras este exista.
- **FR-007 (semántica temporal de 019 intacta)**: La ventana de generación (desde el mes de activación hasta el mes en curso, sin retroactivo ni futuro), la dependencia del ingreso regular, la desactivación y la reactivación con reset del mes de activación MUST conservar la semántica de 019; la regla de descuento solo altera el **importe** calculado, no las condiciones de generación. La desactivación detiene la generación futura pero NO congela el ajuste del mes en curso: mientras el movimiento de aportación del mes en curso exista, el importe sigue reflejando los gastos comunes del mes (FR-002).
- **FR-008 (vistas y agregados)**: Cierre mensual, resumen global mensual y cuenta de resultados anual MUST computar la aportación neta con las reglas actuales de cada vista, leyendo los movimientos como hoy; las reglas de esas vistas no cambian.
- **FR-009 (actualización de documentación)**: Al completar la feature, el roadmap maestro MUST registrar la fila 021 (Completada) y la decisión MUST registrarse como ADR, dejando constancia de la modificación del cálculo de 019 (aportación neta de gastos comunes del mes).
- **FR-010 (cobertura de tests)**: La feature MUST estar cubierta por tests: unidad/dominio-aplicación del cálculo neto (suelo cero, exactitud al céntimo, alcance solo cuenta personal, congelado de meses cerrados, idempotencia del ajuste, borrado definitivo), y un flujo e2e que configure ingreso regular y porcentaje, consulte el mes, registre un gasto común y verifique la aportación ajustada sin duplicados, con su propia combinación cuenta/mes (convención de aislamiento e2e; constitución III).

### Key Entities

- **Aportación común (019, modificada)**: misma configuración (porcentaje, estado, mes de activación) y misma materialización (gasto de naturaleza propia con etiqueta «Aportación Común» en la cuenta personal); cambia el cálculo del importe, ahora neto de los gastos comunes del mes.
- **Movimiento (sin cambios estructurales)**: los gastos de naturaleza común fechados en el mes y registrados en la cuenta personal del miembro son la base del descuento; los ingresos siguen sin computar (carecen de naturaleza).
- **Cuenta común (sin cambios)**: sus movimientos no intervienen en el cálculo de ninguna aportación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras registrar un gasto común, la siguiente consulta de la cuenta muestra la aportación ya descontada, con el importe exacto esperado, sin edición manual: 0 pasos manuales de ajuste.
- **SC-002**: 5 o más consultas repetidas del mismo mes producen exactamente 1 movimiento de aportación con el importe neto vigente: 0 duplicados, 0 importes obsoletos.
- **SC-003**: El 100 % de las altas, ediciones y eliminaciones de gastos comunes fechados en el mes en curso queda reflejado en la aportación del mes en curso; el 100 % de las mismas operaciones sobre meses cerrados deja la aportación de esos meses intacta.
- **SC-004**: Ningún mes presenta una aportación negativa; cuando los gastos comunes igualan o superan el bruto, el mes carece de movimiento de aportación y ningún otro mes se ve afectado.
- **SC-005**: Todas las suites (dominio, aplicación, componentes, e2e) quedan en verde, con el flujo «aportación materializada → registrar gasto común → consultar → aportación ajustada sin duplicados» cubierto end-to-end.

## Assumptions

- **Alcance del descuento (default informado)**: «gasto de naturaleza común que se genere en el mes» = gastos de naturaleza común **fechados en ese mes y registrados en la cuenta personal del miembro**. La cuenta común no pertenece a ningún miembro, por lo que sus gastos no pueden descontar la aportación de nadie; los gastos de otros miembros tampoco.
- **Momento del ajuste (default informado, coherente con 018/019)**: el ajuste ocurre al consultar el mes (materialización perezosa, mismo disparador que 019: la página de cuenta); el mecanismo interno exacto (actualizar el movimiento generado, recrearlo, o equivalente) es decisión del plan.
- **Mes en curso vs. cerrado (default informado)**: «en el mes» se interpreta como el mes mientras está en curso: la aportación del mes en curso se recalcula conforme cambian sus gastos comunes y su configuración; los meses cerrados quedan congelados con el último importe vigente. Un mes materializado justo antes de cerrarse conserva ese importe definitivo.
- **Desactivación a mitad del mes en curso** (decisión del propietario, clarify 2026-10-18): el ajuste del mes en curso sigue activo aunque la aportación se desactive — desactivar detiene la generación de meses futuros, no congela el importe del mes en curso; el movimiento generado del mes en curso continúa descontando gastos comunes mientras exista.
- **Edición manual del movimiento generado**: durante el mes en curso, el importe de la aportación la fija la regla y las ediciones manuales se sustituyen en el siguiente recálculo; la vía para fijar un importe manual es eliminar la aportación (definitiva) y registrar un gasto a mano.
- **Arranque sin retroactivo**: los meses ya materializados antes de la puesta en marcha de esta regla conservan su importe histórico; no se recalculan.
- **Redondeo**: la parte porcentual mantiene el redondeo half-up de 019; la sustracción de gastos (céntimos exactos) no introduce redondeo adicional. Moneda EUR con aritmética en céntimos enteros (ADR 0007).
- **Validación de configuración (019) intacta**: la configuración sigue validando el importe bruto (porcentaje × ingreso ≥ 0,01 €); que un mes concreto nete cero por gastos comunes no invalida la configuración.
- Esta feature depende de 019 (completada); no modifica los formularios de movimiento (013/014) ni la interfaz de configuración de la aportación más allá de lo que el plan justifique (p. ej. información del cálculo).
- Los e2e de la feature operarán en su propia combinación cuenta/mes y en fichero propio, conforme a la convención de aislamiento del proyecto.

## Out of Scope

- **Contrapartida automática en la cuenta común (doble anotación)**: sigue diferida como en 019.
- **Descuento por gastos de la cuenta común**: los gastos pagados desde la cuenta común no reducen ninguna aportación.
- **Arrastre de excedentes** entre meses o saldo de "deuda común" acumulable.
- **Recálculo retroactivo** de meses cerrados o ya materializados antes de la puesta en marcha.
- **Cambios en las reglas de cierre mensual, cuadre, resumen global o cuenta de resultados anual**: leen los movimientos con las reglas actuales.
- **Naturaleza del gasto generado**: la aportación sigue materializándose como gasto de naturaleza propia con la etiqueta «Aportación Común» (019, clarify 2026-10-14).
- Notificaciones, recordatorios o generación por calendario real (cron).
- Optimización móvil específica, dark mode y animaciones.
