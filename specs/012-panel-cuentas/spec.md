# Feature Specification: Panel de Cuentas

**Feature Branch**: `feature/012-panel-cuentas`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "012-panel-cuentas"

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (fila `012-panel-cuentas`, nota 2026-09-27): landing `/` con tarjetas lanzadoras por cuenta y navegación global persistente; retira el selector de cuenta de la página de cuenta. Da por construida `011-pagina-cuenta` (Completada): cada cuenta ya tiene su página propia `/accounts/[id]?month=` con listado del mes, cierre y balance acumulado a mes. Es una feature de presentación sobre lo existente: sin cambios de dominio ni migraciones. **Decisión del propietario (2026-09-29)**: la tarjeta es un **lanzador puro** (nombre y tipo); el balance acumulado y el gasto del mes previstos originalmente en las tarjetas se retiran del panel —el acceso a una cuenta es mayoritariamente para registrar, editar o eliminar movimientos, y la consulta financiera vive en la propia página de la cuenta (011) y en el resumen global (006)—.

## Clarifications

### Session 2026-09-29

- Q: Al pulsar "Resumen global" o "Cuenta de resultados" en la navegación global desde una página con mes visible, ¿debe el enlace conservar ese mes o llevar siempre al mes actual? → A: Conservar el mes (opción A): `/summary?month=` y `/annual?year=` heredan el mes visible; paridad con los navs locales actuales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar por el panel de cuentas (Priority: P1)

Como usuario, quiero abrir la aplicación en `/` y ver un **panel con una tarjeta por cuenta** —nombre y tipo (personal de quién / común)— que me lleve directamente a la página de esa cuenta al pulsarla, para llegar a registrar, editar o eliminar movimientos con el mínimo número de pasos y sin selectores intermedios.

**Why this priority**: Es la única historia de la feature y el segundo paso del rediseño UX: convierte `/` en el lanzador natural del producto y libera a la página de cuenta del selector de cuenta. El acceso a una cuenta es mayoritariamente de escritura (alta/edición/eliminación), no de consulta: el balance y el gasto del mes viven en la propia página de la cuenta (decisión del propietario, 2026-09-29). Todo el valor es de presentación sobre lo ya entregado por 002/003/005/011.

**Independent Test**: Se puede probar abriendo `/`, verificando que hay una tarjeta por cuenta con su nombre y tipo correctos y sin más datos financieros, y que cada tarjeta navega a `/accounts/[id]` del mes actual.

**Acceptance Scenarios**:

1. **Given** las tres cuentas, **When** abro `/`, **Then** veo una tarjeta por cuenta con su nombre y su tipo ("Cuenta común" / "Cuenta personal de {miembro}"), sin ningún dato financiero (ni balance ni gasto del mes): la tarjeta es un lanzador puro.
2. **Given** una tarjeta de cuenta del panel, **When** la pulso, **Then** navego a la página de esa cuenta (`/accounts/[id]`) mostrando su mes actual.
3. **Given** cuentas con y sin movimientos, **When** comparo sus tarjetas, **Then** todas son equivalentes en contenido y tamaño (nombre y tipo); el estado financiero de una cuenta se consulta en su página, no en el panel.
4. **Given** la ruta `/`, **When** la abro, **Then** ya no muestra el selector de cuenta ni el formulario de alta ni el listado de movimientos: es exclusivamente el panel de tarjetas (el alta vive en la página de cuenta; el CTA en diálogo llega con `013-formulario-dialogo`).

### User Story 2 - Navegar siempre con la misma barra (Priority: P2)

Como usuario, quiero que todas las páginas (panel, cuentas, resumen global, cuenta de resultados) compartan una **navegación global persistente** con los mismos destinos —Panel, Resumen global, Cuenta de resultados—, para moverme por la aplicación desde cualquier punto sin volver atrás.

**Why this priority**: Complementa la P1 haciendo coherente el conjunto: hoy cada página duplica su propio nav con enlaces cruzados; una navegación única persistente reduce fricción y elimina mantenimiento duplicado. Es presentación pura sobre rutas existentes.

**Independent Test**: Se puede probar visitando `/`, una cuenta, `/summary` y `/annual` y verificando que la misma navegación está presente y accesible en las cuatro, con el destino activo distinguible.

**Acceptance Scenarios**:

1. **Given** cualquier página de la aplicación (`/`, `/accounts/[id]`, `/summary`, `/annual`), **When** miro la cabecera, **Then** la navegación global (Panel, Resumen global, Cuenta de resultados) está presente y consistente en todas ellas.
2. **Given** la navegación global en la página actual, **When** pulso "Panel", **Then** vuelvo a `/` (panel de tarjetas) desde cualquier página.
3. **Given** la navegación global mientras visualizo una página, **When** la consulto, **Then** el destino actual está distinguible del resto (estado activo visible), incluida la página de cuenta dentro de "Panel".
4. **Given** la navegación global en `/accounts/1?month=2026-03`, **When** pulso "Resumen global" (o "Cuenta de resultados"), **Then** navego a `/summary?month=2026-03` (o `/annual?year=2026`) conservando el mes visible.

### Edge Cases

- `accountId` inexistente: no aplica al panel — muestra solo cuentas existentes (`ListAccounts`) y cada tarjeta enlaza a un id válido. `/accounts/[id]` inválido sigue produciendo 404 (comportamiento de 011, sin cambios).
- Cuenta con o sin movimientos: irrelevante para la tarjeta, que no muestra datos financieros; no hay estados de carga ni cálculo por cuenta.
- `?month=` residual en `/` tras la migración desde la pasarela: se ignora sin error; el panel no depende del mes.
- Orden de las tarjetas: determinista y estable — el devuelto por `ListAccounts` (id ascendente), igual que el selector actual; sin reordenación ni drag-and-drop.
- Más cuentas que las tres iniciales: el panel escala verticalmente (rejilla responsiva, decisión de diseño en el plan); no hay máximo fijo de tarjetas.
- Las e2e existentes que hoy entran por `/` a operar una cuenta (registro, edición, cierre, resumen, anual) deben seguir pasando: entrarán por la tarjeta de la cuenta o directamente por `/accounts/[id]`; su ajuste es parte del alcance de esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST servir el panel de cuentas en `/`: una tarjeta por cuenta existente, con nombre y tipo ("Cuenta común" o "Cuenta personal de {miembro}") y **sin ningún dato financiero** (lanzador puro; balance y gasto del mes viven en la página de la cuenta). Cada tarjeta MUST navegar a `/accounts/[id]` (mes actual por defecto de 011). El panel es la única vista de `/`: sin selector de cuenta, sin formulario de alta, sin listado ni cierre en esta ruta.
- **FR-002**: El panel MUST renderizarse en servidor a partir de `ListAccounts` (única fuente de datos). Sin lógica de cálculo en la UI (constitución VII); sin consultas de balance ni de cierre por cuenta en esta ruta.
- **FR-003**: El sistema MUST mostrar una navegación global persistente —Panel (`/`), Resumen global (`/summary`), Cuenta de resultados (`/annual`)— presente y consistente en todas las páginas (`/`, `/accounts/[id]`, `/summary`, `/annual`), sustituyendo los navs locales duplicados que hoy viven en cada página. La navegación no añade rutas ni páginas nuevas: enlaza las existentes, y `/summary` y `/annual` conservan su comportamiento funcional intacto (solo heredan la navegación global). El destino actual MUST ser distinguible (estado activo); la página de cuenta computa como "Panel". La navegación global conserva el contexto temporal al navegar: desde una página con mes visible (`/accounts/[id]?month=`), los enlaces a Resumen global y Cuenta de resultados propagan ese mes (`/summary?month=`, `/annual?year=`), igual que los navs locales actuales; sin mes visible, enlazan al mes/año actual.
- **FR-004**: La página de cuenta (`/accounts/[id]`, feature 011) MUST retirar cualquier selector de cuenta y cualquier enlace de cambio de cuenta: se entra a una cuenta solo desde el panel de tarjetas o por URL directa. El resto de la página (listado agrupado, stepper de mes, balance acumulado a mes, formulario embebido hasta 013, cierre) permanece sin cambios funcionales.
- **FR-005**: Las e2e existentes que dependen de la pasarela actual de `/` (registro, edición, cierre, resumen, anual) MUST adaptarse a la nueva puerta de entrada (tarjeta del panel o `/accounts/[id]` directa) sin debilitar sus aserciones; el flujo crítico de registro de movimientos MUST seguir cubierto end-to-end (constitución III).
- **FR-006**: Sin cambios de dominio, aplicación ni persistencia de esquema: read-only sobre `ListAccounts`; sin migraciones ni dependencias nuevas. Excepción declarada: la revalidación de `/` en las Server Actions de 002/003 (`revalidatePath("/")` ya presente por la pasarela actual; se verifica que sigue vigente tras la sustitución para que el panel refleje altas de cuentas si algún día las hubiera — no afecta a movimientos, cuya escritura no cambia los datos del panel).
- **FR-007**: Interfaz en español. El panel no muestra importes; la navegación global y las tarjetas usan las convenciones de estilo ya presentes en la app (formateo EUR es-ES solo donde aplique, vía `format.ts`).

### Key Entities

- Ninguna nueva. Reutiliza **Cuenta** tal cual. La tarjeta del panel es una vista de presentación de `ListAccounts` (nombre y tipo); no hay datos calculados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde `/`, el usuario llega al listado de cualquiera de las tres cuentas con un solo clic (pulsar su tarjeta), sin selectores intermedios.
- **SC-002**: La tarjeta de cada cuenta identifica inequívocamente la cuenta (nombre y tipo) y nada más: ningún usuario necesita datos adicionales para decidir a qué cuenta entrar.
- **SC-003**: El panel con las tres cuentas se visualiza en menos de 1 segundo (solo consulta el listado de cuentas; SC-004 del maestro holgado).
- **SC-004**: La navegación global está presente y operativa en el 100% de las páginas de la aplicación; ninguna página retiene un nav local duplicado.
- **SC-005**: Toda la funcionalidad de 002/003/005/011 permanece operativa desde la nueva arquitectura de navegación (página de cuenta intacta, e2e adaptados y en verde), incluido el flujo crítico de registro.

## Assumptions

- Escritorio primero en esta fase (decisión del propietario, 2026-09-27, heredada de 011): el panel debe ser usable en móvil pero no se optimiza hasta iteraciones posteriores.
- Lanzador puro (decisión del propietario, 2026-09-29): la tarjeta no muestra datos financieros; el acceso a una cuenta es mayoritariamente para escribir movimientos (alta/edición/eliminación), y el balance/gasto del mes se consultan en la página de la cuenta (011) y en el resumen global (006).
- El panel muestra siempre las cuentas actuales en el momento de la petición; sin navegación de meses ni estado de cliente.
- La navegación global vive en el layout raíz (`layout.tsx`) o equivalente de presentación; su ubicación técnica exacta se decide en el plan.
- Etiquetas de navegación: "Panel" para `/`, "Resumen global" para `/summary`, "Cuenta de resultados" para `/annual` (nombres ya usados en la app; revisables en el plan).
- Los estados activos de la navegación usan los patrones de estilo de shadcn/ui ya presentes; sin animaciones ni microinteracciones nuevas.
- Las e2e de `pagina-cuenta.spec.ts` no dependen de `/` como pasarela (entran por URL directa) y no deberían requerir cambios; las que hoy hacen `page.goto("/")` y operan desde la pasarela sí se adaptan dentro del alcance.
- Se valorará en el plan un e2e del panel (tarjetas por cuenta y navegación a cuenta) siguiendo la convención de aislamiento (AGENTS.md); al no haber flujo de escritura nuevo, no añade flujo crítico obligatorio adicional al de registro.
- Moneda única EUR con céntimos enteros; la aritmética no cambia (ADR 0007). El panel no muestra importes; accesibilidad del estado activo de la navegación a valorar en el plan.

## Out of Scope

- CTA "Nuevo movimiento" en el panel o la página de cuenta con formulario en diálogo (`013-formulario-dialogo`) y formulario rediseñado con nota única y chips (`014-formulario-nota-tags`).
- Cuenta de resultados anual agrupada por grupos genéricos (`015-anual-agrupada`).
- Reordenación, edición, creación u ocultamiento de cuentas y tarjetas (gestión de cuentas/miembros: `008-gestion-cuentas-miembros`); la tarjeta no es editable.
- Datos financieros en la tarjeta: balance acumulado y gasto del mes (retirados por decisión del propietario, 2026-09-29; se consultan en la página de la cuenta y en el resumen global).
- Indicadores adicionales en la tarjeta (ingresos del mes, saldo del mes, mini-gráficas, comparativa con meses anteriores, descuadres de `010-cuadre-mensual`).
- Navegación de meses en el panel (el panel siempre muestra el mes actual).
- Menús colaterales, breadcrumbs, búsqueda global y atajos de teclado; dark mode/temas.
- Filtrado y búsqueda de movimientos (`007-filtrado-busqueda`); gestión de tags (`004-gestion-tags`).
- Registro de usuarios, login y multiusuario; importación de histórico, presupuestos, metas de ahorro e integración bancaria.
