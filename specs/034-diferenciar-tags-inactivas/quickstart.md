# Quickstart: Etiquetas inactivas visibles en el listado de movimientos (034)

**Feature**: 034-diferenciar-tags-inactivas | **Fecha**: 2026-11-19

Guía de validación manual de los escenarios de la spec. Referencias: [spec](./spec.md) · [data-model](./data-model.md) · [contracts](./contracts/ui-contract.md).

---

## Prerrequisitos

```bash
npm run dev            # http://localhost:3000 (sin migraciones nuevas: no hay cambios de esquema)
```

**Estado inicial necesario**: una cuenta con movimientos en el mes consultado y al menos una etiqueta **desactivable** usada por ellos (si no existe: registra 2-3 movimientos con una etiqueta nueva y desactívala en `/tags` como en E1-E2).

## Validación end-to-end

### E1. Sembrar el escenario (US-1)

1. En `/accounts/1?month=2026-07` (o el mes que uses): registra 2 movimientos con una etiqueta creada inline («+ Nueva etiqueta» → p. ej. «Vacaciones») y 1 movimiento con una etiqueta activa del catálogo (p. ej. «Ocio»).

### E2. Diferenciación en el listado (FR-001, escenarios 1/6/8)

2. `/tags` → menú ⋮ de «Vacaciones» → «Desactivar…» → confirmar.
3. Vuelve a la cuenta del mes: **esperado** — las 2 filas con «Vacaciones» muestran el chip con borde discontinuo y texto apagado, tooltip «Vacaciones (inactiva)» al pasar el cursor, y un lector de pantalla anuncia el nombre con «(inactiva)»; la fila con «Ocio» (y las protegidas «Aportación Común»/«Ahorro» si las hay) se ven **exactamente como antes**.
4. Navega a otro mes con esa etiqueta y a la cuenta común: el marcador aparece igual (histórico conservado).

### E3. Coherencia en el diálogo de edición (FR-002, escenarios 2/5)

5. Edita (✏️) una fila marcada: **esperado** — el campo «Etiqueta» muestra «Vacaciones (inactiva)» como valor actual (no el placeholder vacío de antes).
6. Abre el desplegable: el ítem «Vacaciones (inactiva)» está primero y **deshabilitado** (no clicable); los destinos son solo etiquetas activas agrupadas por categoría.
7. Guarda sin cambiar la etiqueta: **esperado** — error existente «Una de las etiquetas seleccionadas ya no está disponible.» bajo el campo, diálogo abierto, y el valor mostrado sigue siendo «Vacaciones (inactiva)» (ahora se ve el motivo).

### E4. Reasignación individual (escenario 3)

8. Con el diálogo abierto, elige una etiqueta activa («Ocio») → «Guardar cambios».
9. **Esperado**: toast «Movimiento actualizado»; el chip de la fila vuelve a la apariencia normal (sin borde discontinuo ni `title` con «(inactiva)»).

### E5. Reasignación masiva con marcador visible (escenario 4)

10. «Seleccionar» → verifica que la fila aún marcada es seleccionable y conserva el chip diferenciado → «Cambiar etiqueta…» → destino activo → «Reasignar».
11. **Esperado**: ningún chip diferenciado permanece en el mes; salida automática del modo selección.

### E6. Cero cambios de cálculo (FR-003, SC-003)

12. Compara (antes/después de desactivar): KPIs del mes, `/summary?month=…`, `/annual` y el informe anual — **esperado**: importes idénticos; los desgloses siguen incluyendo el histórico de la etiqueta inactiva.

## Comandos de verificación

```bash
npm run lint && npm run typecheck && npm run test   # suites en verde (SC-004)
npm run test:e2e                                    # incluye e2e/etiquetas-inactivas.spec.ts
```

## Resultado esperado (criterios de éxito)

- SC-001: una inspección del listado identifica el 100 % de filas con etiqueta inactiva (marcador) y 0 falsos positivos en activas.
- SC-002: recorrido «detectar → editar → reasignar → chip normal» en < 30 s, sin errores.
- SC-003: importes, KPIs y agregados idénticos antes/después.
- SC-004: todas las suites en verde.
