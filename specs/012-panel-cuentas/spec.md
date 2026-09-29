# Feature Specification: Panel de Cuentas

**Feature Branch**: `feature/012-panel-cuentas`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "012-panel-cuentas"

**Fuente**: Roadmap maestro `specs/001-family-wallet/spec.md` (fila `012-panel-cuentas`, nota 2026-09-27): landing `/` con tarjetas de cuentas (nombre, tipo, balance, gasto del mes) y navegación global persistente; retira el selector de cuenta de la página de cuenta. Da por construida `011-pagina-cuenta` (Completada): cada cuenta ya tiene su página propia `/accounts/[id]?month=` con listado del mes, cierre y balance acumulado a mes. Es una feature de presentación sobre lo existente: sin cambios de dominio ni migraciones. El "gasto del mes" de cada tarjeta proviene del cierre mensual (`GetMonthlyClosure`, feature 005) y el balance del puerto de balance (`getBalance`), ambos ya disponibles.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar por el panel de cuentas (Priority: P1)

Como usuario, quiero abrir la aplicación en `/` y ver un **panel con una tarjeta por cuenta** —nombre, tipo (personal de quién / común), balance acumulado y gasto del mes actual—, de modo que de un vistazo sepa la situación de las tres cuentas y entre a la que me interesa pulsando su tarjeta, para empezar a operar sin pasar por un selector.

**Why this priority**: Es la única historia de la feature y el segundo paso del rediseño UX: convierte `/` en la puerta de entrada natural del producto y libera a la página de cuenta del selector de cuenta. Todo el valor es de presentación sobre lo ya entregado por 002/003/005/011.

**Independent Test**: Se puede probar abriendo `/`, verificando que hay una tarjeta por cuenta con sus datos correctos (balance y gasto del mes contra el cierre de cada cuenta) y que cada tarjeta navega a `/accounts/[id]` del mes actual.

**Acceptance Scenarios**:

1. **Given** las tres cuentas con movimientos en el mes actual, **When** abro `/`, **Then** veo una tarjeta por cuenta con su nombre, su tipo ("Cuenta común" / "Cuenta personal de {miembro}"), su balance acumulado (histórico total) y su gasto del mes actual, todos correctos respecto al cierre de cada cuenta.
2. **Given** una tarjeta de cuenta del panel, **When** la pulso, **Then** navego a la página de esa cuenta (`/accounts/[id]`) mostrando su mes actual.
3. **Given** una cuenta sin movimientos en el mes actual, **When** miro su tarjeta, **Then** muestra gasto del mes 0,00 € y el balance acumulado heredado (correcto, sin errores), igual que hace el cierre mensual de 005 con mes vacío.
4. **Given** la ruta `/`, **When** la abro, **Then** ya no muestra el selector de cuenta ni el formulario de alta ni el listado de movimientos: es exclusivamente el panel de tarjetas (el alta vive en la página de cuenta; el CTA en diálogo llega con `013-formulario-dialogo`).

### User Story 2 - Navegar siempre con la misma barra (Priority: P2)

Como usuario, quiero que todas las páginas (panel, cuentas, resumen global, cuenta de resultados) compartan una **navegación global persistente** con los mismos destinos —Panel, Resumen global, Cuenta de resultados—, para moverme por la aplicación desde cualquier punto sin volver atrás.

**Why this priority**: Complementa la P1 haciendo coherente el conjunto: hoy cada página duplica su propio nav con enlaces cruzados; una navegación única persistente reduce fricción y elimina mantenimiento duplicado. Es presentación pura sobre rutas existentes.

**Independent Test**: Se puede probar visitando `/`, una cuenta, `/summary` y `/annual` y verificando que la misma navegación está presente y accesible en las cuatro, con el destino activo distinguible.

**Acceptance Scenarios**:

1. **Given** cualquier página de la aplicación (`/`, `/accounts/[id]`, `/summary`, `/annual`), **When** miro la cabecera, **Then** la navegación global (Panel, Resumen global, Cuenta de resultados) está presente y consistente en todas ellas.
2. **Given** la navegación global en la página actual, **When** pulso "Panel", **Then** vuelvo a `/` (panel de tarjetas) desde cualquier página.
3. **Given** la navegación global mientras visualizo una página, **When** la consulto, **Then** el destino actual está distinguible del resto (estado activo visible), incluida la página de cuenta dentro de "Panel".

### Edge Cases

- `accountId` que no existe en BD pero con tarjeta visitada por URL antigua: no aplica; el panel muestra solo cuentas existentes (`ListAccounts`) y cada tarjeta enlaza a un id válido. `/accounts/[id]` inválido sigue produciendo 404 (comportamiento de 011, sin cambios).
- Cuenta recién creada sin movimientos históricos: tarjeta con balance 0,00 € y gasto del mes 0,00 €; sin errores.
- Balance negativo de una cuenta: la tarjeta lo muestra con formato y color coherentes con el estándar de la app (`AccountBalance`, rojo), sin ocultar el signo.
- `?month=` residual en `/` tras la migración desde la pasarela: el panel siempre muestra el mes actual por defecto; un parámetro de mes residual se ignora sin error (no hay navegación de meses en el panel).
- Orden de las tarjetas: determinista y estable — el devuelto por `ListAccounts` (id ascendente), igual que el selector actual; sin reordenación por balance ni drag-and-drop.
- Cambio de mes natural durante una sesión abierta: la tarjeta muestra el mes actual en el momento de la petición (renderizado por petición, sin estado de cliente; una recarga refleja el mes nuevo).
- Más cuentas que las tres iniciales: el panel escala verticalmente (rejilla responsiva, decisión de diseño en el plan); no hay máximo fijo de tarjetas.
- Las e2e existentes que hoy entran por `/` a operar una cuenta (registro, edición, cierre, resumen, anual) deben seguir pasando: entrarán por la tarjeta de la cuenta o directamente por `/accounts/[id]`; su ajuste es parte del alcance de esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST servir el panel de cuentas en `/`: una tarjeta por cuenta existente, con nombre, tipo ("Cuenta común" o "Cuenta personal de {miembro}"), balance acumulado (histórico total, `getBalance` sin corte) y gasto del mes actual (total de gastos del cierre mensual de 005). Cada tarjeta MUST navegar a `/accounts/[id]` (mes actual por defecto de 011). El panel es la única vista de `/`: sin selector de cuenta, sin formulario de alta, sin listado ni cierre en esta ruta.
- **FR-002**: Los datos de cada tarjeta MUST calcularse en servidor a partir de los casos de uso y puertos existentes (`ListAccounts`, `getBalance`, `GetMonthlyClosure`): una consulta de balance y una de cierre por cuenta. Sin lógica de cálculo en la UI (constitución VII); la UI solo formatea con los helpers existentes (`format.ts`).
- **FR-003**: El sistema MUST mostrar una navegación global persistente —Panel (`/`), Resumen global (`/summary`), Cuenta de resultados (`/annual`)— presente y consistente en todas las páginas (`/`, `/accounts/[id]`, `/summary`, `/annual`), sustituyendo los navs locales duplicados que hoy viven en cada página. La navegación no añade rutas ni páginas nuevas: enlaza las existentes, y `/summary` y `/annual` conservan su comportamiento funcional intacto (solo heredan la navegación global). El destino actual MUST ser distinguible (estado activo); la página de cuenta computa como "Panel". La conservación del contexto (mes/año) al navegar a Resumen global o Cuenta de resultados desde una página con mes, si procede, se decide en el plan (hoy cada nav local ya lo propaga; no se pierde información).
- **FR-004**: La página de cuenta (`/accounts/[id]`, feature 011) MUST retirar cualquier selector de cuenta y cualquier enlace de cambio de cuenta: se entra a una cuenta solo desde el panel de tarjetas o por URL directa. El resto de la página (listado agrupado, stepper de mes, balance acumulado a mes, formulario embebido hasta 013, cierre) permanece sin cambios funcionales.
- **FR-005**: Las e2e existentes que dependen de la pasarela actual de `/` (registro, edición, cierre, resumen, anual) MUST adaptarse a la nueva puerta de entrada (tarjeta del panel o `/accounts/[id]` directa) sin debilitar sus aserciones; el flujo crítico de registro de movimientos MUST seguir cubierto end-to-end (constitución III).
- **FR-006**: Sin cambios de dominio, aplicación ni persistencia de esquema: read-only sobre `ListAccounts`, `getBalance` y `GetMonthlyClosure`; sin migraciones ni dependencias nuevas. Excepción declarada: la revalidación de `/` en las Server Actions de 002/003 (`revalidatePath("/")` ya presente por la pasarela actual; se verifica que sigue vigente tras la sustitución para que las tarjetas reflejen los cambios tras alta/edición/eliminación desde la página de cuenta).
- **FR-007**: Interfaz en español; importes en formato EUR es-ES con dos decimales y cifras tabulares, reutilizando los helpers de formateo existentes (`format.ts`). El gasto del mes muestra siempre signo coherente con el estándar de la app (importe positivo con etiqueta "Gasto del mes", sin aritmética de signos en la UI).

### Key Entities

- Ninguna nueva. Reutiliza **Cuenta** tal cual. La tarjeta del panel es una vista calculada en servidor a partir de datos ya existentes (balance histórico total y cierre del mes actual por cuenta).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde `/`, el usuario llega al listado de cualquiera de las tres cuentas con un solo clic (pulsar su tarjeta), sin selectores intermedios.
- **SC-002**: Balance y gasto del mes de cada tarjeta coinciden al 100% con los que muestra la página de esa cuenta (balance histórico total y cierre del mes actual) para el mismo instante de datos.
- **SC-003**: El panel con las tres cuentas (y hasta 300 movimientos en el mes por cuenta) se visualiza en menos de 3 segundos (SC-004 del maestro).
- **SC-004**: La navegación global está presente y operativa en el 100% de las páginas de la aplicación; ninguna página retiene un nav local duplicado.
- **SC-005**: Toda la funcionalidad de 002/003/005/011 permanece operativa desde la nueva arquitectura de navegación (página de cuenta intacta, e2e adaptados y en verde), incluido el flujo crítico de registro.

## Assumptions

- Escritorio primero en esta fase (decisión del propietario, 2026-09-27, heredada de 011): el panel debe ser usable en móvil pero no se optimiza hasta iteraciones posteriores.
- "Gasto del mes" de la tarjeta = total de gastos (`expenseTotalCents`) del cierre mensual del mes actual de esa cuenta (005); no desglosa propio/común en la tarjeta (esa profundidad vive en la página de cuenta).
- El balance de la tarjeta es el histórico total (`getBalance` sin corte de fecha), diferenciándose explícitamente del balance "acumulado hasta el mes consultado" de la página de cuenta (011): en la tarjeta no hay mes consultado, siempre es "hoy".
- El mes de referencia del panel es siempre el actual en el momento de la petición; el panel no ofrece navegación de meses (la historia mensual vive en cada página de cuenta).
- La navegación global vive en el layout raíz (`layout.tsx`) o equivalente de presentación; su ubicación técnica exacta se decide en el plan.
- Etiquetas de navegación: "Panel" para `/`, "Resumen global" para `/summary`, "Cuenta de resultados" para `/annual` (nombres ya usados en la app; revisables en el plan).
- Los estados activos de la navegación usan los patrones de estilo de shadcn/ui ya presentes; sin animaciones ni microinteracciones nuevas.
- Las e2e de `pagina-cuenta.spec.ts` no dependen de `/` como pasarela (entran por URL directa) y no deberían requerir cambios; las que hoy hacen `page.goto("/")` y operan desde la pasarela sí se adaptan dentro del alcance.
- Se valorará en el plan un e2e del panel (tarjetas con datos y navegación a cuenta) siguiendo la convención de aislamiento (AGENTS.md); al no haber flujo de escritura nuevo, no añade flujo crítico obligatorio adicional al de registro.
- Moneda única EUR con céntimos enteros; la aritmética no cambia (ADR 0007). Accesibilidad del color en balances negativos y estado activo a valorar en el plan.

## Out of Scope

- CTA "Nuevo movimiento" en el panel o la página de cuenta con formulario en diálogo (`013-formulario-dialogo`) y formulario rediseñado con nota única y chips (`014-formulario-nota-tags`).
- Cuenta de resultados anual agrupada por grupos genéricos (`015-anual-agrupada`).
- Reordenación, edición, creación u ocultamiento de cuentas y tarjetas (gestión de cuentas/miembros: `008-gestion-cuentas-miembros`); la tarjeta no es editable.
- Indicadores adicionales en la tarjeta (ingresos del mes, saldo del mes, mini-gráficas, comparativa con meses anteriores, descuadres de `010-cuadre-mensual`).
- Navegación de meses en el panel (el panel siempre muestra el mes actual).
- Menús colaterales, breadcrumbs, búsqueda global y atajos de teclado; dark mode/temas.
- Filtrado y búsqueda de movimientos (`007-filtrado-busqueda`); gestión de tags (`004-gestion-tags`).
- Registro de usuarios, login y multiusuario; importación de histórico, presupuestos, metas de ahorro e integración bancaria.
