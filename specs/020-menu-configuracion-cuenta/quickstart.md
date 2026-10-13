# Quickstart: Menú de configuración en las tarjetas de cuenta

**Feature**: 020-menu-configuracion-cuenta | **Fecha**: 2026-10-13

Guía de validación manual de la feature (contrato congelado en [contracts/ui-contract.md](./contracts/ui-contract.md), escenarios en [spec.md](./spec.md), modelo en [data-model.md](./data-model.md)).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con el esquema al día (el de 018, sin migraciones nuevas): `npm run db:migrate && npm run db:seed`.

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000` (panel de cuentas). Trabajar con «Cuenta de Miembro A» y el **mes en curso**.

## Escenarios de validación

Espejo de los 8 escenarios de aceptación de la spec + edges clave.

### Q1 — Menú ⋮ con estado en cuentas personales; común sin menú (escenario 1 y 5, FR-001)

1. En `/`: «Cuenta de Miembro A» y «Cuenta de Miembro B» muestran el botón ⋮ («Configuración de Cuenta de Miembro A/B»); la tarjeta de «Cuenta común» no muestra ninguno.
2. Abrir ⋮ de A: ítem «Ingreso regular» con estado («Sin configurar» si la BD viene limpia). Pulsar fuera/Escape: cierra sin efecto (escenario 8).
3. Las tarjetas siguen limpias: sin badges ni indicadores de configuración fuera del menú.

### Q2 — Configurar desde el menú y ver el ingreso materializado (escenario 2, FR-002/FR-004, SC-001)

1. ⋮ de A → «Ingreso regular» (Sin configurar): diálogo vacío (día `1`, placeholder de nota).
2. Importe `2.000,00`, día `1`, nota vacía → «Guardar»: toast «Ingreso regular guardado» y cierre.
3. Entrar en la cuenta de A (mes en curso): el ingreso aparece **sin alta manual**, exactamente una vez; cierre y balance lo computan (comportamiento 018 intacto).

### Q3 — Estado del ítem sincronizado tras guardar (escenario 7, FR-001, SC-002)

1. Volver a `/`, reabrir ⋮ de A: el ítem muestra «Activa» **sin recarga manual**.
2. ⋮ de A → «Ingreso regular»: diálogo precargado (2.000,00 · día 1 · nota).

### Q4 — Editar y desactivar desde el diálogo (escenario 3, FR-002)

1. Desde el menú, editar el importe a `2.100,00` → «Guardar»: toast; el mes ya generado conserva 2.000,00 € (solo-adelante de 018).
2. Reabrir menú + diálogo → «Desactivar»: toast «Ingreso regular desactivado»; el ítem reabre con «Desactivada» y el diálogo precargado permite reactivar editando y guardando (edge).
3. Validaciones intactas: importe vacío/`0`/`abc` → mensajes exactos de 018, diálogo abierto con valores conservados (edge).

### Q5 — La tarjeta sigue siendo lanzador; el menú no navega (escenario 4, FR-003)

1. Pulsar cualquier punto de la tarjeta de B fuera del ⋮: navega a `/accounts/2`.
2. Volver, abrir el menú de B: interactuar con el menú/diálogo **no navega** nunca (abortar con Escape sin efecto secundario).

### Q6 — Página de cuenta sin panel; materialización igual (escenario 6, FR-004, SC-001)

1. Página de la cuenta de A: solo movimientos, cierre y balance; no existe panel «Ingreso regular» en ningún mes (tampoco en la común).
2. Con config activa (reactivar si se desactivó en Q4): navegar meses ‹ › y recargar — el ingreso del mes consultado aparece/desaparece según el rango de 018 (sin retroactivo ni futuro, sin duplicados).

### Q7 — Independencia de menús y teclado (edges «dos cuentas», accesibilidad, SC-003)

1. Abrir ⋮ de A: el menú de B permanece cerrado; cada uno muestra el estado de su propia config.
2. Solo teclado: Tab hasta ⋮, Enter abre, flechas navegan, Enter selecciona, Escape cierra y devuelve el foco al trigger.

### Q8 — Móvil (edge)

1. Vista estrecha: el ⋮ es alcanzable (≥ 44 px) y el menú de la tarjeta de la última columna no se sale del viewport.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde (SC-004). Enmiendas e2e (FR-006): `panel-cuentas.spec.ts` N1 (lanzador + ⋮ en personales, sin menú en la común) e `ingresos-regulares.spec.ts` (flujo re-rutado por el menú: configurar → consultar mes → ingreso materializado → editar/borrar/desactivar, misma combinación cuenta/mes y limpieza final que 018).

## Resultado esperado

La página de cuenta queda libre de configuración (0 paneles de ingreso regular, SC-001) y configurar/editar/desactivar el ingreso regular desde el menú de la tarjeta toma menos de 1 minuto, con el estado del ítem siempre sincronizado (SC-002), operable con teclado y lector de pantalla (SC-003).
