# Quickstart — Importación de movimientos desde Excel, PoC (028)

**Feature**: 028-importacion-excel | **Fecha**: 2026-11-06

Guía de validación manual de los escenarios de la spec (US1). Contratos: [import-sheet-action.md](./contracts/import-sheet-action.md) y [ui-contract.md](./contracts/ui-contract.md); reglas de parseo/mapeo: [data-model.md](./data-model.md).

## Prerrequisitos

```bash
npm run db:migrate && npm run db:seed && npm run dev
```

- Fichero de prueba: la muestra real «Balance 2026.xlsx - Enero Isma.csv» (export de Google Sheets: Archivo → Descargar → Valores separados por comas). Para Q2/Q3, copias editadas de la muestra.
- Cuenta y mes de destino libres a elección (p. ej. una cuenta personal y un mes pasado; la importación es aditiva).

## Escenarios de validación manual

### Q1 — Importación completa con la muestra real (FR-001..FR-006; esc. 1)

1. Navegación global → **«Importar»**: página `/import` con el asistente (paso 1, ui-contract §2).
2. Seleccionar cuenta personal y mes **Enero 2026**; adjuntar el CSV; **«Previsualizar importación»**.
3. Verificar la previsualización (ui-contract §3): 12 movimientos (8 `Gasto` personales + 4 `Gasto Común` compartidos + `Nomina` como ingreso = 13; contar según la muestra); filas ignoradas «Fila 34» (Aportación Común) y «Fila 36» (Ahorro); totales exactos — Gastos personales 186,75 €, Gastos compartidos 73,52 €, Ingresos 3.300,00 € (SC-002); fechas resueltas a 01/01/2026; notas fusionadas («Regalo — Cumple David», «Carrera — OPie Randobike», «Fisio»); etiquetas de las categorías de la hoja, ninguna nueva.
4. **«Confirmar importación (N movimientos)»** → «Importación completada» → enlace a la cuenta.
5. En `/accounts/{id}?month=2026-01`: los movimientos aparecen en el listado agrupado con fecha, nota, importe con signo, tipo, naturaleza y etiqueta correctos (esc. 1); son editables/eliminables como cualquier manual (esc. 5).

### Q2 — Filas inválidas: todo-o-nada (FR-004/FR-005; esc. 2; SC-003)

1. Copia de la muestra con una fila corrompida (p. ej. importe `abc` o `-5`, o fecha `15/03/2026` de otro mes).
2. Previsualizar: la fila aparece en «Filas con error» con «Fila {n}: {motivo}» y el botón de confirmar **deshabilitado**.
3. Corregir el CSV, volver a adjuntar → la previsualización anterior se descarta al cambiar el fichero; re-previsualizar → confirmar → solo la versión correcta se importa.

### Q3 — Estructura no reconocida (FR-002; esc. 3)

1. Subir un CSV con columnas distintas (p. ej. renombrar una cabecera o eliminar una columna).
2. Error `role="alert"` «La estructura del fichero no coincide con la esperada…»; sin previsualización; nada creado (verificar el listado del mes).

### Q4 — Etiquetas nuevas y filas de configuración (FR-003; Edge Cases)

1. En la copia de la muestra, cambiar la `Categoría` de un gasto a un nombre inexistente (p. ej. `Mascotas`) y dejar los ingresos sin categoría.
2. Previsualizar: «Etiquetas que se crearán: Mascotas» (nace en la genérica «General», data-model §2.1); confirmar.
3. `/tags`: la etiqueta «Mascotas» existe, activa, dentro de la categoría «General»; el gasto la lleva. Re-importar el mismo fichero sin corregir crea duplicados (fuera de alcance — la previsualización con totales es la comprobación previa).

### Q5 — Agregados y materializaciones intactos (FR-007; esc. 4)

1. Tras Q1, consultar `/summary?month=2026-01`, `/annual?year=2026` y los KPIs de la cuenta del mes: reflejan los movimientos importados con las reglas vigentes, sin cambios de comportamiento (mes cerrado congelado; si se importa el mes en curso de una personal, la aportación neta se re-sincroniza al consultar como siempre).

## Validación automatizada

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```

Esperado: todo en verde (SC-004). `e2e/importacion-excel.spec.ts` cubre el flujo completo (subida → previsualización → confirmación → listado) en su combinación propia **Cuenta común · marzo 2027** (research §9), el caso de fila inválida sin altas y el de estructura no reconocida.
