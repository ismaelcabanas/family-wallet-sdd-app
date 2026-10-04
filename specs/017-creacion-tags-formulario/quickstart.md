# Quickstart: Creación de etiquetas desde el formulario de movimiento

**Feature**: 017-creacion-tags-formulario | **Fecha**: 2026-10-04

Guía de validación manual de la feature (contrato congelado en [contracts/ui-contract.md](./contracts/ui-contract.md), escenarios en [spec.md](./spec.md), modelo en [data-model.md](./data-model.md)).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con esquema y catálogo: `npm run db:migrate && npm run db:seed` (sin migración nueva en esta feature; catálogo inicial y «Sin Clasificar» intactos, FR-007).

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000`, entrar a una cuenta (p. ej. «Cuenta común») y fijar un mes de trabajo con el selector.

## Escenarios de validación

Espejo de los 6 escenarios de aceptación de la spec + edges clave.

### Q1 — Crear etiqueta a mitad de formulario sin perder nada (escenario 1, FR-001/FR-002/FR-004, SC-001/SC-002)

1. «Nuevo movimiento»: rellenar fecha, importe (85,00) y nota («Tienda de mascotas») **sin tocar la Etiqueta**.
2. Pulsar **«+ Nueva etiqueta»** junto al selector: aparece la captación con el campo «Nombre de la etiqueta».
3. Teclear «Mascotas» y pulsar **Crear** (o Enter): toast «Etiqueta creada», la captación desaparece y el selector muestra **«Mascotas» seleccionada**; fecha, importe y nota **conservan exactamente sus valores**; el diálogo sigue abierto y **no** hay movimiento guardado aún.
4. Pulsar «Guardar y cerrar»: el gasto se guarda con la etiqueta «Mascotas» (visible en la fila con su chip).

### Q2 — Duplicado ignorando mayúsculas (escenario 2, FR-003, SC-003)

1. Abrir el alta y «+ Nueva etiqueta»; con «Luz» ya en el catálogo (seed), teclear **«luz»** (o «LUZ») y Crear.
2. Error visible: «Ya existe una etiqueta con el nombre "luz".»; el nombre tecleado **permanece en el campo**; el resto del formulario no cambia.
3. Corregir a «Mascotas 2», Crear: éxito y selección. (Extra: una etiqueta **inactiva** con el mismo nombre también bloquea — estado de BD, verificable solo si existe.)

### Q3 — Cancelación y nombre vacío (escenarios 3 y 6, FR-001/FR-002)

1. Abrir la captación con una etiqueta ya elegida en el Select; pulsar **Cancelar** (o Escape): el Select vuelve a su estado anterior (misma etiqueta marcada) y no se crea nada.
2. Reabrir y pulsar Crear **sin nombre** (o con «   »): error «El nombre de la etiqueta es obligatorio.»; corregible sin cerrar nada.

### Q4 — Tanda continua con creación a mitad (escenario 4, FR-005, SC-004)

1. Abrir el alta y registrar un primer gasto normal («Guardar y seguir»).
2. En la segunda captura, rellenar nota/importe, «+ Nueva etiqueta» → «Farmacia» → Crear → «Guardar y seguir»: el gasto se guarda con «Farmacia».
3. Verificar que la tanda sigue su curso: campos vacíos (nota/importe/etiqueta), fecha/tipo/naturaleza pegados, «Guardados: 2», foco en Nota.
4. En la tercera captura, abrir el selector: **«Farmacia» está disponible** (extraTags). Elegirla y «Guardar y cerrar».
5. Cancelar el diálogo a mitad de una cuarta captura tras crear otra etiqueta: esa etiqueta **permanece** en el catálogo (reabrir el alta y verla en el Select).

### Q5 — Edición con etiqueta recién creada (escenario 5, FR-006)

1. Editar cualquier movimiento desde su fila (✏️).
2. «+ Nueva etiqueta» → «Regalos gato» → Crear: queda seleccionada; «Guardar cambios»: el movimiento queda con la nueva etiqueta y el diálogo **se cierra** con su toast habitual.

### Q6 — Acentos y espacios (edges, FR-002/FR-003)

1. Crear «Alimentación Mascotas» (con espacios extra al inicio/fin): se crea con el nombre recortado; usable al momento.
2. Crear «Alimentacion Mascotas» (sin tilde): **no** es duplicado (la regla solo ignora mayúsculas) y se crea sin fricción (slug interno distinto por sufijo).

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde (SC-005). Nueva suite `e2e/creacion-tags.spec.ts` (Cuenta de Miembro B, mayo 2026) cubre el flujo crítico: tanda con creación inline, duplicado, cancelación y edición (FR-009, constitución III).

## Resultado esperado

Registrar un gasto cuya etiqueta no existe se completa con **una sola apertura del diálogo** (SC-001): abrir «+ Nueva etiqueta», teclear el nombre, confirmar y guardar; cero navegaciones fuera del formulario y cero pérdidas de datos (SC-002/SC-003); la etiqueta creada queda en el catálogo para esta y futuras tandas (SC-004).
