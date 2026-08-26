# Feature Specification: Family Wallet – Gestión Familiar de Gastos e Ingresos

**Feature Branch**: `001-family-wallet`

**Created**: 2026-08-25

**Status**: Aprobada como roadmap maestro

**Input**: User description: "Quiero desarrollar una aplicación webapp para gestionar los gastos e ingresos de mi familia. Actualmente registro en una hoja excel los gastos que tengo yo, mi mujer y los gastos de la cuenta común. Estos gastos van asociados a una cuenta diferente, es decir, yo y mi mujer tenemos cuentas separadas, y luego tenemos una cuenta separada para los gastos comunes (hipoteca, luz, gas, etc...). Los gastos, míos o de mi mujer, los diferencio entre gastos propios o comunes. Cada mes y por cada una de las cuentas relleno los gastos e ingresos. Actualmente, cada gasto está asociado a una categoría pero me gustaría que fuesen tags, que es más flexible a la hora de a un gasto añadir varias tags."

**Fuentes analizadas**: CSV "Balance 2026.xlsx - Junio Isma" (registro mensual por cuenta/miembro) y CSV "Cuenta Resultados 2026" (agregado anual). Ambos incorporados a esta especificación.

## Rol de esta especificación: Roadmap maestro

Este documento es la **especificación maestra (roadmap)** del producto Family Wallet. No genera plan ni implementación propios: define la visión, las historias de usuario priorizadas y los requisitos globales que se desarrollan mediante **especificaciones hijas**, cada una con su ciclo completo (`/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`).

### Hoja de ruta: features hijas

| Feature hija | Agrupa historias | Contenido | Estado |
|--------------|------------------|-----------|--------|
| `002-registro-movimientos` | US1 + US5 + US6 | Registro de gastos e ingresos, cuentas, naturaleza propio/común, tags múltiples, catálogo de tags, uso sin login. Incluye el modelo de datos base (Miembro, Cuenta, Movimiento, Tag) | Pendiente de crear |
| `003-cierre-mensual` | US2 | Cierre mensual por cuenta con KPIs del Excel de Balance y balance acumulado | Futura |
| `004-analisis-agregado` | US3 + US4 | Resumen global, cuadre mensual y cuenta de resultados anual | Futura |

### Alcance diferido (decisiones del usuario)

- Multiusuario con credenciales y regla de reparto de gastos comunes
- Transferencias entre cuentas y seguimiento del ahorro como tipo de movimiento
- Importación de histórico desde Excel, presupuestos, metas de ahorro, proyecciones

Cada feature hija, al crearse, toma de esta especificación: las historias que agrupa, los requisitos funcionales correspondientes, las entidades implicadas y los criterios de éxito aplicables, refinándolos a su alcance concreto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar gastos e ingresos con tags (Priority: P1)

Como miembro de la familia, quiero registrar un movimiento indicando: fecha, concepto (ej. "Mercadona"), descripción (ej. "Compra semanal"), importe, la cuenta desde la que se realiza, el tipo de movimiento (gasto o ingreso), su naturaleza cuando es gasto (propio o común) y una o varias etiquetas (tags), para sustituir el registro manual en Excel por un registro más rápido y flexible.

**Why this priority**: Es el núcleo del sistema. Sin registro de movimientos no existe ningún valor; es el equivalente digital exacto de lo que hoy se hace en la hoja Excel cada mes.

**Independent Test**: Se puede probar registrando movimientos de cada tipo (gasto propio, gasto común e ingreso) y verificando que quedan guardados con sus campos y tags.

**Acceptance Scenarios**:

1. **Given** que estoy en la cuenta común, **When** registro un gasto de 850,00 € con concepto "Hipoteca" y las tags "vivienda" e "hipoteca", **Then** el movimiento aparece en el listado del mes y de la cuenta común con ambas tags visibles.
2. **Given** que registro un gasto desde mi cuenta personal, **When** marco su naturaleza como "común" (por ejemplo, la compra semanal del supermercado), **Then** el gasto queda identificado como gasto común pagado desde cuenta personal y computa en los totales de gastos comunes.
3. **Given** que registro mi nómina como ingreso en mi cuenta personal, **When** la guardo, **Then** el ingreso se guarda correctamente y actualiza el balance de la cuenta.
4. **Given** que registro un gasto, **When** intento guardarlo sin importe o con un importe no válido, **Then** el sistema muestra un mensaje de error claro y no guarda el movimiento.

---

### User Story 2 - Consultar el resumen mensual por cuenta y miembro (Priority: P2)

Como miembro de la familia, quiero ver, para cada mes y cada cuenta, el cierre mensual equivalente al que hoy calculo en el Excel de Balance: total de ingresos, total de gastos comunes, total de gastos personales, balance acumulado de la cuenta y desglose de gastos por tag, para cerrar el mes de cada cuenta sin cálculos manuales.

**Why this priority**: Es el primer output de valor: replica los KPIs que hoy se calculan manualmente (Balance, Gastos Comunes, Gastos Personales). Depende del registro de movimientos (P1).

**Independent Test**: Se puede probar registrando un mes completo de movimientos de una cuenta y comparando los KPIs del resumen con los calculados a mano sobre el mismo Excel.

**Acceptance Scenarios**:

1. **Given** un mes con movimientos registrados en la cuenta común, **When** abro el resumen de ese mes y esa cuenta, **Then** veo total de ingresos, gastos comunes, gastos personales, saldo del mes, balance acumulado y desglose de gastos por tag.
2. **Given** un mes sin movimientos en una cuenta, **When** abro su resumen, **Then** veo totales a cero y el balance acumulado heredado del mes anterior, sin errores.
3. **Given** movimientos registrados en los tres tipos de cuenta, **When** cambio de cuenta en el resumen, **Then** los totales y desgloses se actualizan a esa cuenta.

---

### User Story 3 - Consultar el resumen mensual global agregado con cuadre (Priority: P3)

Como familia, queremos ver un resumen mensual que agregue todas las cuentas (como el segundo Excel actual), con desglose de gastos propios vs. comunes, por tag y por miembro, y una comprobación automática de cuadre que verifique que no hemos olvidado nada (ingresos − gastos = variación del saldo de la cuenta corriente), para conocer la situación financiera global de la familia con garantías.

**Why this priority**: Da la visión de familia que hoy exige cruzar manualmente varios Excel, e incorpora la comprobación de cuadre que hoy se hace a mano ("si el resultado no es el esperado, hemos olvidado algo"). Depende de P1 (datos) y complementa a P2.

**Independent Test**: Se puede probar registrando movimientos en varias cuentas, introduciendo el saldo real inicial y final del mes, y verificando que el total global coincide con la suma de cuentas y que el cuadre detecta descuadres.

**Acceptance Scenarios**:

1. **Given** movimientos del mes en las tres cuentas, **When** abro el resumen global del mes, **Then** el total de gastos coincide con la suma de los gastos de las tres cuentas.
2. **Given** gastos marcados como propios y como comunes, **When** consulto el desglose global, **Then** veo el total de gastos comunes (incluidos los comunes pagados desde cuentas personales) y el total de gastos propios, por miembro.
3. **Given** un gasto con varias tags (por ejemplo "supermercado" + "vacaciones"), **When** consulto el desglose por tags, **Then** el gasto computa en cada una de sus tags sin duplicar el total global.
4. **Given** el saldo inicial y final reales del mes (introducidos manualmente), **When** el sistema compara la variación real con la calculada (ingresos − gastos), **Then** indica si existe descuadre y por qué importe, señalando posibles olvidos.

---

### User Story 4 - Consultar la cuenta de resultados anual (Priority: P4)

Como familia, queremos ver la cuenta de resultados anual equivalente al Excel actual "Cuenta Resultados": por cada mes, ingresos por miembro, gasto real y saldo; más un desglose de gastos por categoría/tag en columnas mensuales, con totales anuales, media mensual y una fila de gasto mensual excluyendo gastos personales.

**Why this priority**: Es la vista de análisis y seguimiento anual que hoy se mantiene manualmente; da perspectiva de evolución. Depende de P1-P3 (datos y agregación).

**Independent Test**: Se puede probar con 12 meses de datos y verificando que los totales anuales y medias coinciden con los calculados manualmente sobre el mismo conjunto.

**Acceptance Scenarios**:

1. **Given** movimientos de los 12 meses, **When** abro la cuenta de resultados anual, **Then** veo por mes: ingresos desglosados por miembro, gasto real y saldo, con totales anuales y media mensual.
2. **Given** gastos clasificados con tags, **When** consulto el desglose anual, **Then** veo cada tag como fila y cada mes como columna, replicando la estructura actual de categorías.
3. **Given** gastos propios y comunes mezclados, **When** consulto la fila de total mensual, **Then** obtengo tanto el gasto mensual total como el gasto mensual excluyendo gastos personales.

---

### User Story 5 - Gestionar el catálogo de tags (Priority: P5)

Como miembro de la familia, quiero crear, renombrar, fusionar y desactivar tags, y poder asignar varias tags a cualquier movimiento, para mantener el sistema de clasificación flexible y limpio a medida que evoluciona (sustituyendo al rígido sistema de una sola categoría por gasto). El catálogo parte de las categorías actuales del Excel (Hogar, Coche, Salud, Alimentación, Ocio, Viaje, Ropa, Regalos, Suscripciones online, Sin Clasificar...).

**Why this priority**: La flexibilidad de tags es un requisito explícito del usuario, pero es utilidad de mantenimiento: no bloquea el registro si se parte del catálogo inicial importado.

**Independent Test**: Se puede probar creando dos tags, fusionándolas y verificando que los movimientos históricos quedan reasignados a la tag resultante.

**Acceptance Scenarios**:

1. **Given** que existe la tag "super", **When** la renombro a "supermercado", **Then** todos los movimientos que la tenían muestran la nueva tag y los totales no cambian.
2. **Given** dos tags similares ("gas" y "gas-casa"), **When** las fusiono, **Then** los movimientos de ambas quedan con la tag resultante y la tag absorbida desaparece del catálogo.
3. **Given** una tag usada en movimientos históricos, **When** la desactivo, **Then** deja de estar disponible para nuevos movimientos pero los históricos la conservan.
4. **Given** que intento crear una tag con el mismo nombre que otra existente (ignorando mayúsculas), **When** la guardo, **Then** el sistema lo impide mostrando un mensaje claro.

---

### User Story 6 - Uso individual sin registro de usuario (Priority: P6)

Como único usuario inicial de la aplicación, quiero utilizarla directamente, sin necesidad de crear cuentas de usuario ni iniciar sesión, para empezar a registrar los movimientos de las tres cuentas (incluida la cuenta personal de mi pareja, que registro en su nombre) con la mínima fricción.

**Why this priority**: Decisión explícita del usuario: el acceso multiusuario queda diferido a una fase posterior para acelerar la puesta en marcha; el valor del MVP no depende de la colaboración simultánea.

**Independent Test**: Se puede probar abriendo la aplicación, verificando que no se exige login, registrando movimientos y comprobando que los datos persisten entre sesiones.

**Acceptance Scenarios**:

1. **Given** la aplicación desplegada, **When** accedo a ella, **Then** puedo registrar movimientos sin crear cuenta de usuario ni iniciar sesión.
2. **Given** movimientos registrados en una sesión, **When** vuelvo a acceder más tarde, **Then** todos los datos siguen disponibles.
3. **Given** el catálogo de miembros configurado, **When** registro un movimiento en la cuenta personal de mi pareja, **Then** puedo atribuírselo como miembro, de forma que los desgloses por miembro funcionen desde el primer día.

### Edge Cases

- ¿Qué ocurre cuando se registra un gasto con importe 0 o negativo? (Debe rechazarse con mensaje claro; los abonos/devoluciones se registran como ingresos).
- ¿Cómo se maneja un movimiento fechado en un mes distinto al actual? (Debe permitirse; el movimiento computa en el mes de su fecha).
- ¿Qué pasa si se elimina una tag que tiene movimientos asociados? (Se desactiva en lugar de borrarse físicamente, preservando el histórico).
- ¿Cómo se manejan tags con el mismo nombre y distinta capitalización ("Luz" vs "luz")? (Se tratan como duplicados y se impide su creación).
- ¿Qué ocurre si se edita un movimiento cambiándolo de cuenta o de mes? (Los resúmenes y balances de ambas cuentas/meses deben recalcularse).
- ¿Cómo se muestran los movimientos sin ninguna tag? (Agrupados bajo "Sin clasificar" en los desgloses, como hoy hace el Excel).
- ¿Qué ocurre si el cuadre mensual detecta un descuadre? (Se marca visualmente el mes descuadrado con la diferencia, sin bloquear el registro).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir configurar al menos tres cuentas: la cuenta personal del miembro A, la cuenta personal del miembro B y una cuenta común, identificando cada cuenta con un nombre y un tipo (personal/común), y mostrando el balance acumulado de cada cuenta.
- **FR-002**: El sistema MUST permitir registrar movimientos con: fecha, concepto, descripción, importe, cuenta y tipo de movimiento (gasto o ingreso), y opcionalmente una o varias tags. Los tipos del Excel actual (Gasto, Gasto Común, Gasto Fijo) se mapan al nuevo modelo de tipo + naturaleza + tags.
- **FR-003**: El sistema MUST permitir marcar cada gasto con su naturaleza: "propio" o "común". Los gastos de la cuenta común se consideran comunes por defecto; en las cuentas personales el usuario elige la naturaleza.
- **FR-004**: El sistema MUST permitir asignar múltiples tags (0 o más) a un mismo movimiento, en sustitución del modelo actual de una única categoría. Los movimientos sin tag se agrupan como "Sin clasificar".
- **FR-005**: El sistema MUST permitir gestionar el catálogo de tags: crear, renombrar, fusionar y desactivar, sin perder el histórico de movimientos ya etiquetados. El catálogo inicial MUST partir de las categorías actuales del Excel (Hogar, Coche, Salud, Alimentación, Ocio, Viaje, Ropa, Regalos, Suscripciones online, Sin Clasificar).
- **FR-006**: El sistema MUST generar el cierre mensual por cuenta con los KPIs equivalentes al Excel de Balance: total de ingresos, gastos comunes, gastos personales, saldo del mes, balance acumulado y desglose de gastos por tag.
- **FR-007**: El sistema MUST generar un resumen mensual global que agregue todas las cuentas, con desglose por tag, por miembro y por naturaleza (propios vs. comunes, incluyendo los comunes pagados desde cuentas personales).
- **FR-008**: El sistema MUST permitir editar y eliminar movimientos existentes, recalculando automáticamente los resúmenes y balances afectados.
- **FR-009**: El sistema MUST permitir filtrar y buscar movimientos por mes, cuenta, tipo (gasto/ingreso), naturaleza (propio/común), tag y miembro.
- **FR-010**: El sistema MUST permitir su uso individual sin registro de usuario ni inicio de sesión (decisión del usuario). El acceso multiusuario con credenciales propias queda diferido a una fase posterior, momento en que se incorporará una regla de reparto configurable para la liquidación de gastos comunes.
- **FR-011**: El sistema MUST mostrar el balance acumulado por cuenta (equivalente a la columna "Balance" del Excel), actualizado con cada movimiento.
- **FR-012**: El sistema MUST realizar la comprobación de cuadre mensual: comparar la variación calculada (ingresos − gastos) con la variación real del saldo introducida manualmente, señalando el importe del descuadre, en equivalencia a la comprobación manual actual del "Saldo CUENTA CORRIENTE".
- **FR-013**: El sistema MUST generar la cuenta de resultados anual: por mes, ingresos desglosados por miembro, gasto real y saldo; desglose de gastos por tag en columnas mensuales con totales anuales, media mensual y total mensual excluyendo gastos personales.

### Key Entities *(include if feature involves data)*

- **Miembro**: Persona de la unidad familiar (inicialmente 2, equivalentes a "Sueldo 1" y "Sueldo 2" del Excel agregado). Atributos: nombre. Relación: posee una cuenta personal y registra movimientos.
- **Cuenta**: Agrupación financiera sobre la que se registran movimientos. Atributos: nombre, tipo (personal o común), balance acumulado. Relación: una cuenta personal pertenece a un miembro; la cuenta común es compartida.
- **Movimiento**: Registro unitario equivalente a una fila del Excel mensual. Atributos: tipo (gasto o ingreso), fecha, concepto, descripción, importe, cuenta, naturaleza (propio/común, para gastos), tags (0 o más). Relación: pertenece a una cuenta y a un mes.
- **Tag**: Etiqueta de clasificación libre que sustituye a la categoría única actual. Atributos: nombre (único), estado (activa/desactivada). Relación: puede aplicarse a muchos movimientos; un movimiento puede tener muchas tags.
- **Cierre mensual**: Agregación calculada por cuenta y mes con los KPIs del Excel de Balance (ingresos, gastos comunes, gastos personales, saldo, balance acumulado, desglose por tag).
- **Cuenta de resultados anual**: Agregación calculada por año con la estructura del segundo Excel (ingresos por miembro y mes, gasto real, saldo, desglose por tag y mes, media mensual, total sin gastos personales).
- **Cuadre mensual**: Comprobación de consistencia entre variación calculada y variación real de saldo declarada manualmente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede registrar un movimiento completo (importe, concepto, cuenta, tipo, naturaleza y tags) en menos de 30 segundos.
- **SC-002**: Los KPIs del cierre mensual por cuenta coinciden al 100% con los calculados manualmente sobre el mismo conjunto de movimientos del Excel actual.
- **SC-003**: El resumen global mensual reproduce, con desviación cero, los valores que hoy se obtienen manualmente cruzando los Excel de las tres cuentas.
- **SC-004**: Los resúmenes de un mes con hasta 300 movimientos se visualizan en menos de 3 segundos.
- **SC-005**: La comprobación de cuadre mensual se realiza de forma automática al introducir los saldos reales, sin cálculo manual intermedio.
- **SC-006**: Desde el primer mes completo de uso, el 100% de los movimientos familiares se registran en la aplicación, abandonando el Excel como registro principal.
- **SC-007**: Al menos el 80% de los movimientos registrados llevan una o más tags tras el primer mes de uso.

## Assumptions

- Moneda única: euro (EUR); no se contemplan divisas ni conversiones en esta versión.
- La unidad familiar inicial son 2 miembros y 3 cuentas (2 personales + 1 común), pero el sistema debe permitir añadir más miembros y cuentas sin rediseño. En esta versión un solo usuario registra los movimientos de todos los miembros en nombre propio.
- Uso individual sin autenticación en esta versión (decisión del usuario). El acceso multiusuario queda diferido a una fase posterior; cuando se desarrolle la incorporación de nuevos usuarios, se incluirá una regla de reparto configurable para liquidar los gastos comunes entre miembros (decisión del usuario).
- No se migra el histórico de los Excel: se empieza de cero en la aplicación y los Excel actuales quedan como archivo de consulta (decisión del usuario). El catálogo inicial de tags sí parte de las categorías actuales del Excel.
- Los movimientos se registran manualmente; no hay integración bancaria (importación automática de extractos) en esta versión. El saldo real para el cuadre se introduce manualmente.
- Las transferencias entre cuentas propias (aportaciones a la cuenta común, p. ej. la aportación fija mensual de 1.920 € más extraordinarias) y el seguimiento del ahorro como tipo de movimiento propio quedan diferidos a una fase futura (decisión del usuario). Provisionalmente, las aportaciones a la cuenta común, si se registran, se anotan como ingresos en dicha cuenta.
- Los gastos registrados directamente en la cuenta común son comunes por defecto; la distinción propio/común aplica principalmente a gastos pagados desde cuentas personales.
- Los ingresos no requieren naturaleza propio/común; se asocian a la cuenta en la que se registran.
- Idioma de la interfaz: español.
- La distinción actual entre "Concepto" y "Descripción" del Excel se mantiene como dos campos independientes del movimiento.
- Fuera de alcance en esta versión (fases futuras posibles): transferencias entre cuentas y seguimiento del ahorro (decisión del usuario), multiusuario con regla de reparto de gastos comunes, presupuestos, metas de ahorro, proyecciones e importación de histórico desde Excel.
