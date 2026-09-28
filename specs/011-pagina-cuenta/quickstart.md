# Quickstart: Página de Cuenta

**Feature**: `011-pagina-cuenta` | Guía de verificación manual end-to-end de los escenarios de la [spec](./spec.md). Estructura, textos y estados: [contracts/ui-contract.md](./contracts/ui-contract.md); extensión del puerto de balance y agrupación: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js LTS y npm.
- Repositorio con la feature implementada (rama `feature/011-pagina-cuenta`); 002/003/005 ya entregadas (migraciones, seed y componentes disponibles).
- BD en estado limpio o con importes anotados: E2/E3 verifican balances con valores exactos (conviene partir de la BD recién migrada+sembrada o anotar los movimientos previos de la cuenta usada).

## Puesta en marcha

```bash
npm install            # dependencias (sin novedades)
npm run db:migrate     # aplica las migraciones (sin cambios nuevos en 011)
npm run db:seed        # precarga cuentas, miembros y tags (idempotente)
npm run dev            # http://localhost:3000
```

**Comprobación inicial (FR-001, SC-001)**: en `/`, el selector de cuenta sigue funcionando (FR-007). Navega a `/accounts/2`: se abre la página de esa cuenta en el mes actual con URL estable; `/accounts/999` y `/accounts/abc` muestran 404; `/accounts/2?month=bizzling` muestra el mes actual.

## Verificación de gates automáticos

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (helpers, repositorio, acciones, UI jsdom) en verde
npm run test:e2e       # Playwright: specs existentes intactas + pagina-cuenta.spec.ts
```

> SC-004: `registro-movimientos`, `edicion-movimientos`, `cierre-mensual`, `resumen-global` y `cuenta-resultados-anual` deben pasar **sin modificaciones** — `/` conserva su comportamiento (FR-007).

## Escenarios de validación manual (aceptación de la spec)

> E2/E3 verifican valores exactos: usa una cuenta/mes con saldo conocido (p. ej. BD limpia y fechas de un mes libre como abril de un año vacío).

### E1 — Página propia con agrupación, fila rediseñada y cierre (Escenarios 1, 2, 3, 6)

En `/accounts/{id}` de una cuenta (p. ej. la común), registra con el formulario embebido:

1. Gasto «Mercadona» `85,00` compartido, tags Alimentación, fecha **5 del mes actual**, descripción «compra semanal».
2. Gasto «Gasolina» `30,00` personal, tag Coche, fecha **5 del mes actual** (mismo día, registrado después).
3. Gasto «Cine» `12,00` personal, tag Ocio, fecha **2 del mes actual**.

- ✅ Tres grupos: «5 de {mes} de {año}» arriba y «2 de {mes} de {año}» debajo; dentro del día 5, «Gasolina» (último registrado) aparece **antes** que «Mercadona».
- ✅ Cada fila: tags como píldoras prominentes, nota pequeña debajo («Mercadona · compra semanal»; «Cine» solo), importe a la derecha — `−85,00 €` rojo, y verde `+` si registras un ingreso; distintivo «Común»/«Personal» solo en gastos; **sin** texto «Gasto/Ingreso».
- ✅ Panel de cierre (005) y balance «Acumulado hasta {Mes de YYYY}» visibles; el balance solo computa movimientos con fecha ≤ fin del mes consultado (E2).

### E2 — Balance acumulado hasta el mes consultado (Escenario 6, FR-006)

Con E1 en el mes actual:

1. Anota el balance mostrado en el mes actual (p. ej. `−127,00 €`).
2. Registra un gasto `50,00` **fechado el mes próximo** (el formulario admite fecha futura).
3. Recarga la página del mes actual.

- ✅ El balance del mes actual **no** incluye el gasto futuro (corte a fin de mes); el balance del mes próximo sí. El histórico completo sigue visible en `/` para la misma cuenta (FR-007).

### E3 — Navegación de meses con ‹ › y picker (Escenario 4, FR-005)

1. En `/accounts/{id}` del mes actual: **› está deshabilitado**; ‹ navega al mes anterior (URL `/accounts/{id}?month=...`) sin cambiar de página.
2. Navega a un mes anterior al primer movimiento: listado vacío (estado vacío dentro del listado), cierre a `0,00 €`/«Sin gastos este mes.» y balance `0,00 €`, sin errores.
3. Picker «Mes visible»: salto directo a un mes arbitrario de la ventana; **ninguna opción futura aparece** (ventana truncada en el mes actual real, clarificación 2026-09-28).

- ✅ Mes futuro por URL directa: página válida con estado vacío y balance heredado; › deshabilitado también desde él; ‹ permite retroceder. La cuenta activa nunca cambia al navegar.

### E4 — Edición y eliminación desde la fila (Escenario 5, FR-004)

1. En `/accounts/{id}`, pulsa ✏️ en «Mercadona»: abre el diálogo de 003; cambia el importe a `90,00` y guarda.
2. Pulsa 🗑️ en «Cine» y confirma.

- ✅ Toast de éxito, diálogo cerrado, y **en la misma página** el listado, el cierre y el balance se recalculan (−90,00; sin Cine).
3. Edita «Gasolina» cambiando su **fecha** a otro mes y guarda.

- ✅ Desaparece del grupo/mes actual (el toast de 003 avisa del movimiento de mes) y aparece al navegar al mes de su nueva fecha.

### E5 — Estado vacío dentro del listado y último movimiento (edge case)

1. Navega a un mes sin movimientos y elimina desde él el único movimiento visible (tras registrarlo).

- ✅ El estado vacío aparece **dentro del listado** (la página no se desmonta), el toast llega y el diálogo se cierra (convención de `movement-list`).

### E6 — 404 y fallbacks de parámetros (edge cases, FR-001)

1. `/accounts/999` y `/accounts/abc` → 404 (nunca otra cuenta).
2. `/accounts/{id}?month=2026-13` y `/accounts/{id}` (sin mes) → mes actual.

### E7 — `/` intacta como pasarela (Escenario 7, FR-007, FR-008)

1. Abre `/`: selector de cuenta y mes, alta, edición, eliminación y cierre como antes; el alta desde `/` y desde `/accounts/{id}` usan el mismo formulario embebido (FR-008).

- ✅ Ningún cambio de comportamiento respecto a 002/003/005 (sus e2e lo garantizan en CI).

## Verificación adicional recomendada

- **Tag «Sin Clasificar»**: un gasto sin tags muestra la píldora como cualquier otra (edge case).
- **Movimientos el mismo día en distinto orden**: el orden interno del grupo es por registro, no por concepto ni hora visible (edge case).
- **E2E (ADR 0006)**: `npm run test:e2e` cubre `pagina-cuenta.spec.ts` (agrupación, navegación ‹ ›, 404, rediseño de fila contra la app compilada, en la combinación propia Cuenta de Miembro B · abril 2026).
- **SC-003 (rendimiento)**: impresión informal durante E1 con el mes cargado (< 3 s a escala familiar), mismo criterio PoC que 005/006/009.

## Puesta en marcha (producción Turso)

Sin cambios respecto a [quickstart de 009](../009-cuenta-resultados-anual/quickstart.md): no hay migraciones nuevas; la página se calcula en cada petición.

## Criterio de cierre (Definition of Done)

- Gates en verde (arriba) en local y en CI (GitHub Actions), con las 5 specs e2e previas intactas.
- Los 7 escenarios verificados manualmente.
- Documentación actualizada en el mismo cambio (`docs/architecture/overview.md` y diagramas afectados; README/AGENTS.md solo si fijan convención nueva).
