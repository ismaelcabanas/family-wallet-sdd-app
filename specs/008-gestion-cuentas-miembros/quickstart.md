# Quickstart: Gestión de cuentas y miembros — renombrado

**Feature**: 008-gestion-cuentas-miembros | **Fecha**: 2026-10-29

Guía de validación manual de la feature (contrato congelado en [contracts/ui-contract.md](./contracts/ui-contract.md), escenarios en [spec.md](./spec.md), modelo en [data-model.md](./data-model.md)).

## Prerrequisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- BD con la migración nueva aplicada y seed al día: `npm run db:migrate && npm run db:seed`.
- Con BD preexistente: la migración `0007_*` pone a NULL el nombre de las cuentas personales y mantiene todo lo demás (ids, movimientos, configs); verificar con `sqlite3 db.sqlite "SELECT id, name, type, member_id FROM accounts"` tras migrar.

## Arranque

```bash
npm run dev
```

Abrir `http://localhost:3000` (panel de cuentas). Partir del seed: «Cuenta de Miembro A», «Cuenta de Miembro B», «Cuenta común».

## Escenarios de validación

Espejo de los 6 escenarios de aceptación de la spec + edges clave. Renombrar **no crea ni borra datos**: cualquier mes sirve y los importes nunca cambian (SC-002).

### Q1 — Renombrar un miembro y ver el derivado en el panel (escenario 1, FR-001/FR-004, SC-001)

1. En `/`: abrir ⋮ de «Cuenta de Miembro A» → primer ítem «Renombrar miembro».
2. Diálogo precargado con «Miembro A»; cambiar a `Isma` → «Guardar»: toast «Miembro renombrado» y cierre.
3. Sin recarga manual, la tarjeta muestra **«Cuenta de Isma»** (derivado) con subtítulo «Cuenta personal de Isma»; las otras tarjetas no cambian.

### Q2 — Propagación a vistas derivadas con histórico intacto (escenario 2, FR-001, SC-002)

1. Entrar en «Cuenta de Isma»: el `<h1>` y el balance («Balance de Cuenta de Isma») muestran el derivado; movimientos e importes idénticos.
2. Ir a `/summary` (mes con datos): el desglose por miembro muestra la fila **«Isma»** con los mismos importes (sin duplicar filas ni perder histórico).
3. Ir a `/annual` (año con datos): la fila de ingresos por miembro muestra **«Isma»** con los mismos importes.
4. ⋮ de la tarjeta → «Ingreso regular»/«Aportación»/«Ahorro» (si configurados): siguen activos con sus valores (escenario 6, edge «configs activas»).

### Q3 — Renombrar la cuenta común (escenario 3, FR-002)

1. La tarjeta «Cuenta común» ahora muestra ⋮ («Configuración de Cuenta común») con un único ítem: «Renombrar cuenta».
2. Renombrar a `Cuenta conjunta` → «Guardar»: toast «Cuenta renombrada»; tarjeta y página de la cuenta muestran el nuevo nombre; type, movimientos, tags y balances exactos.

### Q4 — Validación: vacío conserva lo tecleado (escenario 4, FR-006)

1. ⋮ de «Cuenta de Isma» → «Renombrar miembro»; vaciar el input y pulsar Espacio → «Guardar».
2. Error visible «El nombre del miembro es obligatorio.» (`role="alert"`), sin guardado, diálogo abierto. La misma regla en «Renombrar cuenta» con «El nombre de la cuenta es obligatorio.».

### Q5 — Validación: duplicados ignorando mayúsculas (escenario 5, FR-001/FR-002)

1. ⋮ de «Cuenta de Miembro B» → «Renombrar miembro» a `ISMA` (existe «Isma») → «Guardar»: error `Ya existe un miembro con el nombre "ISMA".`, sin guardado.
2. «Renombrar cuenta» de la común a un nombre ya almacenado (cualquier capitalización): error «Ya existe una cuenta con el nombre "…".».

### Q6 — Colisión visual aceptada y espacios extremos (edges)

1. Renombrar la común a `Cuenta de Isma`: **se acepta** — coincide visualmente con el derivado de la tarjeta de Isma, sin conflicto de datos (las vistas usan ids).
2. Renombrar un miembro a `  Sole  ` (espacios extremos): se guarda como **«Sole»** (trim) y el derivado muestra «Cuenta de Sole».
3. Restaurar nombres para repetir la guía ( ⋮ → renombrar de vuelta).

### Q7 — La tarjeta sigue siendo lanzador; teclado (edges, FR-006)

1. Clic en cualquier punto de una tarjeta fuera del ⋮: navega a su página de cuenta; interactuar con menú/diálogo **nunca navega**.
2. Solo teclado: Tab hasta ⋮, Enter abre, flechas navegan, Enter selecciona «Renombrar…», Escape cierra diálogo y menú devolviendo el foco.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test
npm run test:e2e
```

Esperado: todo en verde (SC-003). Cobertura nueva (FR-007): dominio (`Member`/`Account`), aplicación (`RenameMember`/`RenameAccount`), repositorios (derivación en `findAll`, `findByName` nocase, carrera UNIQUE), actions y componentes; **e2e nueva** `renombrado-cuentas-miembros.spec.ts` (renombrado con propagación a panel/cuenta/resumen + renombrado de la común + errores + **restauración final** de los nombres del seed); enmienda de `panel-cuentas.spec.ts` N1 (⋮ ya presente en las 3 tarjetas).

## Resultado esperado

Poner los nombres reales de la familia toma menos de 30 segundos por renombrado desde el panel (SC-001), el 100 % del histórico permanece numéricamente idéntico (SC-002) y todas las suites quedan en verde (SC-003). La única vía de personalización de nombres es esta superficie (el seed sigue sembrando «Miembro A/B» y «Cuenta común»).
