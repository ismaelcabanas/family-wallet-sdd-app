# Quickstart: Registro manual de la aportación común en meses pasados

**Feature**: 032-retroactivacion-aportacion-ahorro  
**Fecha**: 2026-11-11

---

## Prerrequisitos

- Repositorio clonado y con `npm install` ejecutado
- Base de datos local (`db.sqlite` en dev)
- Al menos una cuenta personal con config de aportación activa
- Un mes pasado con ingresos y gastos comunes registrados (a mano o importados)

---

## Escenario 1: Registrar aportación manual en mes pasado

### Objetivo

Registrar manualmente la aportación común de un mes pasado que no tiene registro.

### Pasos

1. **Navegar a la página de la cuenta personal**
   ```
   /accounts/{accountId}
   ```

2. **Cambiar al mes pasado** usando el stepper (arriba de la página)
   - Seleccionar el mes anterior al actual

3. **Abrir el formulario de movimiento**
   - Botón «Nuevo movimiento» (arriba del listado)

4. **Llenar el formulario**
   - **Tipo**: Seleccionar «Aportación común»
   - **Fecha**: Seleccionar la fecha del mes pasado
   - **Importe**: Teclear el importe neto real (en céntimos)
   - **Nota**: Opcional (p. ej., «Aportación noviembre 2025»)

5. **Guardar**
   - El sistema crea el movimiento y escribe la fila del registro en la misma transacción

### Resultados esperados

- El movimiento aparece en el listado del mes
- El KPI «Aportación común» muestra el importe tecleado
- El KPI «Gasto personal» excluye la aportación (composición 024)
- El KPI «Saldo del mes» es coherente
- `/summary` y `/annual` cuentan la aportación

---

## Escenario 2: Evitar duplicado

### Objetivo

Verificar que no se puede crear un segundo movimiento de aportación en el mismo mes.

### Pasos

1. **Repetir el escenario 1** para crear la primera aportación manual

2. **Intentar crear otra aportación en el mismo mes**
   - Abrir el formulario de movimiento nuevamente
   - Seleccionar tipo «Aportación común»
   - Llenar los campos

3. **Guardar**

### Resultados esperados

- Error con mensaje al usuario: «Ya existe una aportación común para este mes»
- El segundo movimiento no se guarda
- El KPI sigue mostrando el importe de la primera aportación

---

## Escenario 3: Borrar aportación manual

### Objetivo

Verificar que borrar el movimiento elimina también la fila del registro.

### Pasos

1. **Crear una aportación manual** (escenario 1)

2. **Eliminar el movimiento**
   - Fila del listado → menú ⋮ → «Eliminar»

### Resultados esperados

- El movimiento desaparece del listado
- El KPI «Aportación común» muestra 0
- El mes queda en estado «sin aportación»
- Se puede crear una nueva aportación en ese mes

---

## Escenario 4: Editar aportación manual

### Objetivo

Verificar que la edición solo permite modificar importe, nota y fecha.

### Pasos

1. **Crear una aportación manual** (escenario 1)

2. **Editar el movimiento**
   - Fila del listado → menú ⋮ → «Editar»
   - Modificar importe, nota o fecha
   - **No** modificar tipo, naturaleza o etiqueta (deberían estar deshabilitados)

3. **Guardar**

### Resultados esperados

- El KPI «Aportación común» muestra el nuevo importe
- El movimiento se actualiza en el listado
- La fila del registro no cambia (el KPI lee el movimiento enlazado)

---

## Escenario 5: Materializador respeta registro manual

### Objetivo

Verificar que el materializador no altera un registro manual existente.

### Pasos

1. **Crear una aportación manual** en el mes en curso (dentro de la ventana de la config)

2. **Recargar la página** o esperar que el materializador ejecute su tarea

### Resultados esperados

- El registro manual no cambia
- El KPI sigue mostrando el importe manual
- No se genera un segundo movimiento

---

## Validación de datos

### Importe

- El importe manual es el **neto real** que ocurrió entonces
- No se valida contra porcentajes de la config
- Se guarda en céntimos enteros (sin coma flotante)

### Fecha

- La fecha puede ser cualquier día del mes
- El mes del registro se deriva de la fecha del movimiento

### Naturaleza y etiqueta

- **Implícitas**: no se seleccionan a mano
- Naturaleza = `own` (propia)
- Etiqueta = «Aportación Común» (protegida)

---

## Comandos de verificación

### Lint

```bash
npm run lint
```

### Typecheck

```bash
npm run typecheck
```

### Tests

```bash
npm run test
```

### E2E (Playwright)

```bash
npm run build
npm run start
npm run test:e2e
```

---

## Referencias

- **Spec**: `specs/032-retroactivacion-aportacion-ahorro/spec.md`
- **Data Model**: `specs/032-retroactivacion-aportacion-ahorro/data-model.md`
- **Contracts**: `specs/032-retroactivacion-aportacion-ahorro/contracts/interfaces.md`
- **Constitución**: `.specify/memory/constitution.md`
