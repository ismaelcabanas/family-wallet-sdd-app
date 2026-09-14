# Quickstart: Edición y Eliminación de Movimientos

**Feature**: `003-edicion-movimientos` | Guía de verificación manual end-to-end de los escenarios de la [spec](./spec.md). Textos y diálogos: [contracts/ui-contract.md](./contracts/ui-contract.md); modelo de datos: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js LTS y npm.
- Repositorio con la feature implementada (rama `feature/003-edicion-movimientos`); 002 y 005 entregadas (migraciones, seed, pantalla principal).
- BD en estado limpio o con datos anotados: los escenarios verifican importes y recuentos exactos.

## Puesta en marcha

```bash
npm install            # novedades: @radix-ui/react-dialog y @radix-ui/react-alert-dialog (peers shadcn)
npm run db:migrate     # aplica las migraciones (novedad en 003: updated_at en movements)
npm run db:seed        # precarga cuentas y tags (idempotente)
npm run dev            # http://localhost:3000
```

**Comprobación inicial (FR-001, FR-006)**: registra un movimiento cualquiera y verifica que su fila del listado muestra los botones de editar (✏️) y eliminar (🗑️) a la derecha.

## Verificación de gates automáticos

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (dominio, aplicación, infra/actions, UI) en verde
npm run test:e2e       # Playwright: registro (002) + cierre (005) + edición/eliminación (003)
```

## Escenarios de validación manual (aceptación de la spec)

### E1 — Editar el importe actualiza las vistas derivadas (Escenario 1)

1. Selecciona una cuenta y mes; registra un gasto "Mercadona" de `85,00` con tag Alimentación.
2. Pulsa ✏️ en su fila; cambia el importe a `78,50` y "Guardar cambios".

- ✅ Toast "Movimiento actualizado"; la fila muestra 78,50 €; el balance de cabecera y el panel de cierre de 005 se recalculan (Gastos y desglose de Alimentación con el nuevo importe) sin pasos manuales.

### E2 — Editar la fecha mueve el movimiento a otro mes (Escenario 2)

1. Con el movimiento de E1 visible en septiembre, edítalo y cambia la fecha a un día de agosto; guarda.

- ✅ Toast "Movimiento actualizado: ahora está en Agosto 2026"; la pantalla permanece en septiembre y la fila desaparece del listado; navega a agosto y verifica que aparece ahí y que computa en el cierre de agosto (no en el de septiembre).

### E3 — Editar la cuenta traslada el movimiento (Escenario 3)

1. Edita el movimiento y cambia "Cuenta" a otra cuenta (p. ej. la común); guarda.

- ✅ Toast "Movimiento actualizado: ahora está en {cuenta}"; balance de la cuenta de origen y de la destino coherentes; en la cuenta destino el movimiento computa en listado y cierre; sin residuos en el origen.

### E4 — Cambiar el tipo gasto ↔ ingreso (Escenarios 4 y 5)

1. Edita un gasto con naturaleza "Personal" y cambia el tipo a "Ingreso": guarda.

- ✅ El bloque naturaleza desaparece y el movimiento pasa a computar como ingreso (cierre: Ingresos +importe, Gastos −importe).
2. Edita un ingreso y cambia el tipo a "Gasto".

- ✅ Aparece el bloque naturaleza y exige elegir Personal/Compartido antes de guardar.

### E5 — Validaciones idénticas al alta (Escenario 6)

1. Abre la edición y prueba, uno a uno: importe `0`, concepto vacío, fecha inválida, cero tags (desmarca todas).

- ✅ Los mismos mensajes de error que el alta, en línea bajo el campo; el diálogo no cierra y no guarda.

### E6 — Eliminar con confirmación y cancelar (Escenarios 7, 8 y 9)

1. En un mes con 3 movimientos, pulsa 🗑️ en una fila con varias tags.
2. Verifica que el diálogo muestra concepto, importe y fecha del movimiento; pulsa "Cancelar".

- ✅ No se elimina nada; el listado permanece intacto.
3. Repite y confirma "Eliminar".

- ✅ Toast "Movimiento eliminado"; el listado pasa a 2 filas; balance y cierre recalculados; en `/` (o recargando) las tags del movimiento siguen en el catálogo y siguen usándose en el formulario de alta (FR-003, escenario 9).

### E7 — Movimiento inexistente (edge case)

1. Abre la edición de un movimiento en dos pestañas; elimínalo en una y guarda la edición en la otra.

- ✅ La segunda pestaña muestra "El movimiento ya no existe." y no corrompe el estado.

## Verificación adicional recomendada

> SC-003 ("corrección completa < 30 s") se verifica de forma **informal** durante E1/E6 (impresión de duración de la interacción completa), sin condiciones de medición estrictas — mismo régimen PoC que SC-001 de 002 y SC-002 de 005.

- **Mes que queda vacío**: elimina (o edita hacia otro mes) el último movimiento del mes activo y verifica que el listado muestra el estado vacío de 002 ("Aún no hay movimientos"), sin error.
- **Edición hacia un mes futuro (edge case)**: edita la fecha de un movimiento a un día del mes siguiente y verifica que desaparece del listado actual con el aviso de movimiento movido, y que aparece y computa en el mes futuro.
- **Cuenta común en edición (§2.1 del contrato)**: edita un gasto hacia la cuenta común → naturaleza fija "Compartido"; al volver a una cuenta personal los radios se habilitan.
- **Descripción opcional**: edición borrando la descripción → se persiste como vacía (null).
- **E2E (ADR 0006/0011)**: `npm run test:e2e` cubre `edicion-movimientos.spec.ts` (edición del caso más frecuente —importe— y eliminación contra la app compilada; el resto de escenarios queda en verificación manual, decisión del revisor 2026-09-14).

## Puesta en marcha (producción Turso)

Un cambio respecto a [quickstart de 002](../002-registro-movimientos/quickstart.md): hay **una migración nueva** (`updated_at`); ejecútala contra Turso como paso pre-deploy (`drizzle.prod.config.ts` con `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`) antes del despliegue.

## Criterio de cierre (Definition of Done)

- Gates en verde (arriba) en local y en CI (GitHub Actions).
- Los 7 escenarios verificados manualmente.
- Documentación actualizada en el mismo cambio (ADR 0011, `docs/architecture/overview.md` y diagramas si procede, README/AGENTS.md solo si fijan convención nueva).
