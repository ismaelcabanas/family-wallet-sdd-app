# Quickstart — Gestión de etiquetas y jerarquía unificada (027)

**Feature**: `027-gestion-etiquetas` | Guía de validación manual end-to-end. Contrato congelado: [contracts/ui-contract.md](./contracts/ui-contract.md) · Modelo y casos de uso: [data-model.md](./data-model.md).

## Prerrequisitos

```bash
npm install
npm run db:migrate     # sin novedad: la feature NO añade migraciones (esquema intacto)
npm run db:seed        # idempotente (categorías/tags de 026)
npm run dev            # http://localhost:3000
```

> Base existente de 026: basta con arrancar; el catálogo ya viene agrupado. Esta feature cambia `/tags` (árbol + creación única) y el Select «Etiqueta» de los formularios (agrupado).

## Escenarios de validación manual

### Q1 — Árbol unificado y única vía de creación (FR-003; esc. 4)

1. Abrir `/tags`.
2. **Esperado**: cada categoría es un **contenedor** con sus etiquetas sangradas dentro (contenedor vs contenido, sin dos listados hermanos); genérica primero. En la cabecera del catálogo existe **un solo** botón de creación («Nueva etiqueta») — no existe «Nueva categoría» en la página.

### Q2 — Crear etiqueta en una categoría existente (FR-001; esc. 1)

1. «Nueva etiqueta» → Nombre «Mercadona», Categoría «Alimentación» → «Crear».
2. **Esperado**: toast «Etiqueta creada»; la fila aparece dentro del grupo «Alimentación» sin recarga; al registrar un gasto, el Select «Etiqueta» la muestra bajo la cabecera «Alimentación» (no elegible la cabecera).

### Q3 — Inferencia de tipo: sin padre ⇒ categoría (FR-002; esc. 2)

1. «Nueva etiqueta» → Nombre «Suscripciones», Categoría **sin seleccionar** (placeholder «Ninguna — se creará una categoría») → «Crear».
2. **Esperado**: toast «Categoría creada»; grupo nuevo vacío («Sin etiquetas») ordenado tras la genérica. Repetir con Categoría «Suscripciones» y Nombre «Netflix» → «Etiqueta creada» dentro del grupo.
3. Cancelar el diálogo a mitad → **Esperado**: no se crea nada (no-op limpio).

### Q4 — Duplicados y errores conservando el valor (FR-001/FR-002; esc. 3; edges)

1. Crear «ocio» existiendo «Ocio» (con padre) → **Esperado**: alerta `Ya existe una etiqueta con el nombre "Ocio".`, campo «Nombre» conserva «ocio», diálogo abierto.
2. Crear «ALIMENTACIÓN» sin padre (existe la categoría) → **Esperado**: alerta `Ya existe una categoría con el nombre "Alimentación".`. Crear una etiqueta llamada «Alimentación» con padre → permitido (regla 026).
3. Nombre vacío/solo espacios → **Esperado**: «El nombre es obligatorio.»

### Q5 — Selector agrupado y cabeceras no seleccionables (FR-004, FR-005; esc. 5, 6)

1. Registrar un gasto: desplegar «Etiqueta» → **Esperado**: opciones agrupadas bajo cabeceras de categoría (genérica primera); recorrer con teclado → las cabeceras se saltan (nunca quedan seleccionadas); elegir una etiqueta guarda el mismo valor que hoy.
2. En un ingreso → **Esperado**: «Sin etiqueta» sigue disponible como primera opción.
3. Desactivar todas las etiquetas de una categoría (o elegir una vacía) y desplegar → **Esperado**: esa categoría no pinta cabecera (esc. 8).

### Q6 — Inline 017 y tanda intactos (FR-006; esc. 9)

1. En el formulario de movimiento, «+ Nueva etiqueta» → crear «Mascotas».
2. **Esperado**: flujo idéntico a hoy (creación y selección inmediatas sin cerrar el diálogo); en el Select agrupado aparece bajo la cabecera de la genérica; «Guardar y seguir» mantiene la tanda.

### Q7 — Ciclo de vida 004/026 sin cambios (FR-006; esc. 7)

1. En `/tags`: renombrar, fusionar, desactivar/reactivar y mover una etiqueta; renombrar una categoría y eliminar una vacía.
2. **Esperado**: cada acción funciona exactamente como antes, con sus diálogos a nivel del listado.

### Q8 — No-regresión de informes y KPIs (FR-006; SC-003)

1. Tras crear/mover etiquetas de 027, revisar `/summary`, `/annual`, la página de cuenta (KPIs y listado).
2. **Esperado**: mismos desgloses por etiqueta, mismos importes y comportamientos que antes de la feature; ninguna referencia a categorías en agregados.

## Gates automáticos

```bash
npm run lint && npm run typecheck && npm run test        # dominio/aplicación/actions/componentes (matriz research §8)
npm run test:e2e                                        # incluye jerarquia-etiquetas.spec.ts (inferencia → etiqueta → movimiento → restauración)
```

**Criterio de cierre**: Q1–Q8 verificados manualmente + gates en verde + documentación actualizada en el mismo cambio (AGENTS.md «Jerarquía y creación única (027)», diagramas vivos, fila 027 del roadmap «Completada» y nota del informe por categorías re-referenciada a ~028 — FR-007).
