# Quickstart: Registro de Movimientos con Tags

**Feature**: `002-registro-movimientos` | Guía de verificación manual end-to-end de los escenarios de la [spec](./spec.md). Detalles de campos/errores: [contracts/](./contracts/); modelo de datos: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js LTS y npm.
- Repositorio con la feature implementada (rama `002-registro-movimientos`).
- No se necesita ninguna cuenta de usuario (uso único sin login).

## Puesta en marcha

```bash
npm install            # dependencias
npm run db:migrate     # aplica las migraciones versionadas (crea SQLite local)
npm run db:seed        # precarga 2 miembros, 3 cuentas y 12 tags (idempotente)
npm run dev            # http://localhost:3000
```

**Comprobación inicial (FR-001, FR-017)**: al abrir `/` se ve el mes actual, la primera cuenta personal activa, su balance a `0,00 €`, el formulario siempre visible (fecha = hoy, naturaleza "personal") y el estado vacío "Aún no hay movimientos en este mes".

## Verificación de gates automáticos

```bash
npm run lint           # ESLint en verde
npm run typecheck      # tsc --noEmit en verde
npm run test           # Vitest (dominio, aplicación, infraestructura, UI) en verde
npm run test:e2e       # Playwright: flujo crítico de registro (levanta build+start)
```

## Escenarios de validación manual (aceptación de la spec)

### E1 — Gasto compartido con varias tags (Escenario 1)
1. Selecciona la **Cuenta común** y el mes actual.
2. Registra: fecha hoy, concepto "Hipoteca", importe `850,00`, tipo gasto, naturaleza compartido (fija), tags **Vivienda** e **Hipoteca**.
- ✅ Toast "Movimiento guardado"; formulario reseteado; el movimiento aparece en el listado con fecha, concepto, `−850,00 €`, tipo Gasto, naturaleza Compartido y ambos tags visibles; balance de la común `−850,00 €`.

### E2 — Gasto compartido pagado desde cuenta personal (Escenario 2)
1. Cambia a una **cuenta personal**.
2. Registra: concepto "Compra semanal", importe `120,50`, gasto, naturaleza **Compartido**, tag "Alimentación".
- ✅ El movimiento queda identificado como gasto compartido pagado desde cuenta personal (naturaleza "Compartido" visible en el listado de esa cuenta personal).

### E3 — Ingreso y balance acumulado (Escenario 3)
1. En la cuenta personal, registra un ingreso: concepto "Nómina", importe `1.500,00`, tipo ingreso (sin naturaleza).
- ✅ El ingreso se guarda; el balance acumulado refleja `+1.500,00 €` sumado al balance previo de ESA cuenta (las demás cuentas no cambian).

### E4 — Importe inválido (Escenario 4)
1. Intenta guardar con importe vacío, luego `0`, luego `-5`, luego `abc`.
- ✅ En cada caso: mensaje de error junto al campo de importe (ver [contrato §3](./contracts/create-movement-action.md)); nada se guarda; el resto de valores permanece.

### E5 — Campos obligatorios vacíos (Escenario 5)
1. Envía el formulario con concepto vacío (y el resto válido).
- ✅ Registro rechazado; error junto al campo concepto; valores introducidos conservados.

### E6 — Movimiento de otro mes (Escenario 6)
1. Registra un movimiento fechado el mes pasado.
2. Cambia el selector de mes al mes pasado.
- ✅ El movimiento aparece en el listado de ese mes; en el mes actual no aparece.

### E7 — Movimiento sin tags (Escenario 7)
1. Registra un gasto sin seleccionar ninguna tag.
- ✅ Se guarda y aparece con el chip "Sin clasificar".

### E8 — Persistencia entre sesiones (SC-004)
1. Con movimientos registrados, detén `npm run dev` y arranca de nuevo (`npm run dev`).
- ✅ Movimientos, tags y balances siguen exactamente iguales.

## Verificación adicional recomendada

- **Naturaleza por cuenta**: al cambiar entre cuenta personal y común, el formulario ajusta el default de naturaleza (personal editable / compartido fija).
- **Selectores**: recarga la página con `/?account=2&month=2026-08` → la vista corresponde a esa cuenta y mes; URL sin parámetros → mes actual y primera cuenta.
- **E2E crítico (ADR 0006)**: `npm run test:e2e` cubre el flujo completo de registro (E1–E3) contra la app compilada.

## Criterio de cierre (Definition of Done)

- Gates en verde (arriba) en local y en CI (GitHub Actions).
- Los 8 escenarios verificados manualmente.
- Documentación actualizada en el mismo cambio (README, `docs/architecture/`, ADRs 0007–0009, AGENTS.md si procede).
