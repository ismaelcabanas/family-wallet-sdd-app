# Quickstart: Alta continua con nota única y tag única

**Feature**: 014-formulario-nota-tags | **Fecha**: 2026-10-01

Guía de validación manual de la feature (contrato congelado en [contracts/ui-contract.md](./contracts/ui-contract.md), escenarios en [spec.md](./spec.md), modelo en [data-model.md](./data-model.md)).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con esquema nuevo y catálogo: `npm run db:migrate && npm run db:seed`.
  - La migración `0002_*` **elimina todos los movimientos existentes** (datos de prueba) y conserva cuentas, miembros y tags (SC-003).

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000`, entrar a una cuenta (p. ej. «Cuenta común») y fijar un mes de trabajo con el selector.

## Escenarios de validación

### Q1 — Formulario simplificado (FR-002/FR-003/FR-004, US2-1, SC-002)

1. Pulsar «Nuevo movimiento»: el diálogo muestra exactamente fecha, importe, **Nota**, tipo, naturaleza (en cuenta personal) y **Etiqueta** (selector con placeholder «Selecciona etiqueta», una como máximo). Sin campo descripción, sin bloque de cuenta; el título sigue siendo «Nuevo movimiento».
2. Verificar que no aparece el texto «Sin Clasificar» automático ni opción «Sin etiqueta» con Gasto marcado.
3. Cambiar a **Ingreso**: naturaleza desaparece y aparece la opción «Sin etiqueta».

### Q2 — Tag obligatoria en gastos, opcional en ingresos (FR-003, US2-2/2-3)

1. Con **Gasto** y sin etiqueta marcada, rellenar nota «Mercadona» e importe «85,00» y pulsar «Guardar y seguir»: error «Selecciona una etiqueta para el gasto.» junto a la Etiqueta, diálogo abierto, valores conservados.
2. Marcar «Alimentación» y guardar: éxito (Q3). La nota vacía produce «La nota es obligatoria.» (misma prueba con nota en blanco).

### Q3 — Captación continua: tanda de 3 movimientos (FR-001, US1-1, SC-001)

1. Tras el alta válida de Q2, verificar **sin cerrar el diálogo**: toast «Movimiento guardado», contador «Guardados: 1», Nota/Importe/Etiqueta **vacíos**, **fecha/tipo/naturaleza conservados** (misma fecha, Gasto, misma naturaleza), y foco en Nota.
2. Registrar un segundo gasto (nota e importe nuevos, etiqueta elegida) → «Guardados: 2»; verificar en la página (visible tras el diálogo o cerrando después) que el listado, el balance y el cierre ya reflejan ambos movimientos (FR-005).
3. Cambiar a **Ingreso**, guardar un ingreso **sin etiqueta** («Nómina», 1.500,00): se guarda; el diálogo sigue abierto con «Guardados: 3» y naturaleza oculta al volver a Gasto↔Ingreso según el tipo actual.
4. Pulsar **«Guardar y cerrar»** con un cuarto movimiento válido: se guarda, el diálogo se cierra y la página queda recalculada. Total: **1 apertura, N guardados** (SC-001).

### Q4 — Cancelación y errores a mitad de tanda (FR-001, US1-3/1-4)

1. Abrir el diálogo, guardar un movimiento y, con datos a medias en curso, pulsar Cancelar (o X/Escape): se descarta **solo la entrada en curso**, sin confirmación; los movimientos guardados siguen en la página.
2. Reabrir el diálogo: formulario limpio (fecha hoy, Gasto, sin etiqueta), sin contador («Guardados» oculto con 0).

### Q5 — Edición simplificada, sin cambio de cuenta (FR-002/FR-003/FR-004, US2-4)

1. Editar un movimiento desde una fila: el diálogo muestra nota única prefijada, etiqueta única marcada y **sin selector de cuenta**.
2. Guardar cambios (p. ej. nota e importe): el diálogo se **cierra** (FR-006) con toast «Movimiento actualizado»; cambiar la fecha a otro mes añade «: ahora está en {Mes año}» al mensaje.
3. Verificar que ninguna vista muestra concepto/descripción separados ni varias tags: listado (nota + un chip), diálogo de eliminación («Nota: …»), cierre mensual y anual **sin** la nota de «varias tags computan en cada una» (US2-6, SC-005).

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde (SC-004). `registro-movimientos.spec.ts` cubre la tanda continua y el error por gasto sin tag (FR-007, constitución III); el resto de specs usan los helpers adaptados a Nota + selector de etiqueta.

## Resultado esperado

El alta de una tanda completa (2-3 sesiones al mes de N movimientos) se realiza con una única apertura del diálogo; cada captura tiene 6 controles como máximo; los gastos llevan exactamente una etiqueta y los ingresos ninguna o una; la edición no permite cambiar de cuenta; la BD queda sin movimientos de prueba y con el catálogo intacto.
