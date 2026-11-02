# Quickstart — Categorías de etiquetas: organización del catálogo (026)

**Feature**: `026-categorias-tags` | Guía de validación manual end-to-end. Contrato congelado: [contracts/ui-contract.md](./contracts/ui-contract.md) · Modelo y migración: [data-model.md](./data-model.md).

## Prerrequisitos

```bash
npm install
npm run db:migrate     # aplica 0008: crea tag_categories + General + backfill de tags
npm run db:seed        # idempotente: garantiza General y las etiquetas con categoría
npm run dev            # http://localhost:3000
```

> En una BD con datos previos, `0008` asigna el 100 % de las etiquetas existentes a «General» sin tocar nombre, slug, estado ni ningún movimiento (SC-001).

## Escenarios de validación manual

### Q1 — Puesta en marcha: backfill a la genérica (FR-001; esc. 1; SC-001)

1. Con la BD migrada (etiquetas preexistentes), abrir `/tags`.
2. **Esperado**: todas las etiquetas aparecen agrupadas bajo **«Categoría General»**, sin perder ninguna ni cambiar nombre/estado; cada grupo muestra su cardinal. Ninguna etiqueta fuera de un grupo.

### Q2 — Crear categoría y duplicados (FR-003; esc. 2, 3)

1. Pulsar **«Nueva categoría»**, crear «Alimentación» → **Esperado**: grupo nuevo (vacío, «Sin etiquetas») ordenado tras la genérica; toast «Categoría creada».
2. Crear «hogar» existiendo «Hogar» → **Esperado**: alerta `Ya existe una categoría con el nombre "Hogar".`, el campo conserva «hogar» y el diálogo abierto.
3. Vacío/solo espacios → **Esperado**: «El nombre de la categoría es obligatorio.» (una categoría puede llamarse igual que una etiqueta: permitido).

### Q3 — Mover etiqueta de categoría (FR-005; esc. 4, 5)

1. En ⋮ de «Supermercado» → **«Mover a categoría…»** → elegir «Alimentación» → «Mover».
2. **Esperado**: toast «Etiqueta movida a Alimentación»; la fila desaparece de «General» y aparece en «Alimentación» **sin recarga manual**. El Select de `MoveTagDialog` no ofrece la categoría actual.
3. Mover «Supermercado» de nuevo a su misma categoría actual no es posible desde el diálogo (excluida); a nivel servidor, mover a la propia categoría es no-op sin error.

### Q4 — Histórico e informes intactos (FR-008; esc. 5; SC-002, SC-003)

1. Con movimientos registrados con «Supermercado» (p. ej. en su cuenta/mes), mover la etiqueta y volver a esa página de cuenta.
2. **Esperado**: los movimientos siguen mostrando «Supermercado» con mismos importes y fechas; `/summary` y `/annual` producen exactamente las mismas filas por etiqueta y totales que antes de organizar el catálogo.

### Q5 — Renombrar categoría (FR-004; esc. 6)

1. ⋮ de «Alimentación» → «Renombrar…» → «Comida» → Guardar.
2. **Esperado**: el grupo pasa a «Categoría Comida», sus etiquetas siguen dentro y nada cambia en movimientos ni informes. La genérica también es renombrable y sigue siendo el destino por defecto tras renombrarla.

### Q6 — Eliminar categoría (FR-006; esc. 7)

1. ⋮ de «Comida» (con «Supermercado» dentro) → «Eliminar…» → confirmar → **Esperado**: alerta «La categoría "Comida" tiene etiquetas asignadas…», el diálogo permanece.
2. Mover «Supermercado» a «General» y reintentar → **Esperado**: «Categoría eliminada», el grupo desaparece.
3. ⋮ de la genérica → **Esperado**: solo «Renombrar…» (sin «Eliminar…»).

### Q7 — Etiquetas nuevas nacen en la genérica (FR-007; esc. 8)

1. En el formulario de movimiento, «+ Nueva etiqueta» → crear «Mascotas».
2. **Esperado**: flujo 017 idéntico a hoy (creación y selección inmediatas); en `/tags`, «Mascotas» aparece bajo la genérica sin pasos adicionales. El Select «Etiqueta» sigue plano, sin categorías.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test        # dominio/aplicación/repositorios/actions/componentes
npm run test:e2e                                        # incluye categorias-tags.spec.ts (creación → movimiento → histórico intacto → restauración)
```

**Criterio de cierre**: Q1–Q7 verificados manualmente + gates en verde + documentación actualizada en el mismo cambio (ADR 0022, AGENTS.md, diagramas vivos, fila 026 del roadmap «Completada» — FR-009; SC-003 cubierto por Q4 y la suite e2e sin cambios).
