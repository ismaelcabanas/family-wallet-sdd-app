# Quickstart — Aportación porcentual a la cuenta común por miembro (019)

**Feature**: `019-aportacion-comun` | Guía de validación manual end-to-end. Referencias: [spec.md](./spec.md) (escenarios), [contracts/ui-contract.md](./contracts/ui-contract.md) (literales congelados), [data-model.md](./data-model.md) (reglas).

## Prerrequisitos

```bash
npm install
npm run db:migrate   # aplica drizzle/0004_aportacion-comun.sql (tablas + etiqueta «Aportación Común»)
npm run db:seed      # idempotente; añade la etiqueta si faltaba
```

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000`. Trabaja sobre una **cuenta personal** (p. ej. «Cuenta de Miembro A») y el **mes en curso** (la activación siempre arranca en el mes en curso, FR-004).

## Escenarios de validación

Espejo de los 11 escenarios de aceptación de la spec + edges clave. Literales exactos en [ui-contract](./contracts/ui-contract.md).

### Q1 — Sin ingreso regular, la aportación queda bloqueada (escenario 10, FR-006)

1. En `/`, abre ⋮ («Configuración de {cuenta}») de una cuenta **sin** ingreso regular.
2. El ítem «Aportación» muestra **«Requiere ingreso regular»** y está deshabilitado: el clic no abre diálogo.

### Q2 — Configurar y ver la aportación generada sin alta manual (escenario 1, FR-001/FR-002/FR-003, SC-001)

1. Configura primero el ingreso regular desde ⋮ → «Ingreso regular»: `2.000,00`, día `1`.
2. ⋮ → «Aportación» (ahora «Sin configurar») → porcentaje `25` → «Guardar»: toast **«Aportación guardada»**.
3. Entra en la cuenta (mes en curso): gasto **−500,00 €** con nota **«Aportación común de {miembro}»** y etiqueta **«Aportación Común»**, exactamente una vez, **sin** captura manual.
4. La cuenta común no cambia automáticamente; el panel `/` no muestra importes.

### Q3 — Idempotencia total (escenario 2, FR-002, SC-002)

1. Con la aportación visible, visita el mes repetidamente: reload, `/summary?month={mes}`, `/annual?year={año}`, vuelve a la cuenta — 5+ consultas.
2. La aportación aparece **exactamente 1 vez** en todas las vistas.

### Q4 — Cambio de porcentaje solo-adelante (escenario 3, FR-004)

1. Edita la aportación al `30` % → «Guardar».
2. El mes ya generado conserva **−500,00 €**; el mes siguiente (cuando llegue) se materializará al 30 %.

### Q5 — Edición del movimiento generado (escenario 4, FR-003)

1. Edita el importe de la aportación desde su fila.
2. Persiste; ninguna consulta posterior lo sobrescribe.

### Q6 — Borrado definitivo (escenario 5, FR-004)

1. Elimina la aportación del mes (fila → «Eliminar»).
2. Desaparece y **no vuelve a generarse** al reconsultar el mes.

### Q7 — Desactivar y reactivar con reset (escenarios 6 y 11, FR-004)

1. «Desactivar»: el ítem pasa a **«Desactivada»**; los meses futuros no generan.
2. Reactiva («Guardar»): los meses del periodo inactivo **no** se generan aunque se consulten; la generación retoma desde el mes de la reactivación.

### Q8 — Validación del formulario (escenario 7, FR-001; edges redondeo/decimales)

1. Prueba vacío, `0`, `-5`, `100,01` y `12,345`: mensajes congelados de ui-contract §3, sin guardar nada.
2. `12,5` y `33,33` se aceptan; sobre 2.000,00 € generan **250,00 €** y **666,60 €**; sobre un ingreso de `1.500,50` con `25` %: **375,13 €** (half-up).

### Q9 — Ventana temporal (escenarios 9 y edges, FR-005)

1. Navega a un mes **anterior** a la activación: sin aportación (nunca se genera).
2. Navega a un mes **futuro**: vacío, «Mes siguiente» deshabilitado (intacto).

### Q10 — Sin doble anotación e independencia por miembro (escenario 8, FR-003; edge «Dos miembros»)

1. La «Cuenta común» no tiene menú ⋮ ni configuración de aportación.
2. Configura aportaciones distintas en las dos cuentas personales: porcentajes y generaciones totalmente independientes.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e   # incluye e2e/aportacion-comun.spec.ts (Cuenta de Miembro B + mes en curso; research §8)
```

Esperado: todo en verde (SC-005).

## Resultado esperado

Tras configurar ingreso regular + porcentaje una vez (< 1 minuto, SC-001), cada mes consultado muestra exactamente una aportación con el importe correcto redondeado half-up (SC-002/SC-003), el saldo personal refleja la salida sin cambios automáticos en la común (SC-004), y todas las suites quedan en verde (SC-005).
