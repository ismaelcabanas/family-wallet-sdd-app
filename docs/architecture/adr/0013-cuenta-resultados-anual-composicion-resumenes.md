# 13. Cuenta de resultados anual por composición de resúmenes mensuales

- **Fecha**: 2026-09-24
- **Estado**: Aceptado

## Contexto y problema

La feature 009 exige una cuenta de resultados anual equivalente al Excel «Cuenta Resultados»: tabla Ene–Dic con ingresos atribuidos por miembro (dueño de la cuenta de registro) y cuenta común, totales, gasto real, gasto sin gastos personales, saldo del mes y saldo acumulado desde enero (FR-012), cada fila con total anual y media mensual `/12`; más un desglose anual de gastos por tag. La coherencia céntimo a céntimo de cada mes con el resumen global de 006 es un criterio de éxito (FR-006, SC-003). Había que decidir dónde vive el cálculo, cómo se leen los datos y dónde vive la vista, sin persistencia nueva ni migraciones (FR-008).

## Opciones consideradas

1. **VO anual con sus propios bucles para todo (sin componer `GlobalMonthlySummary`)**: duplicaría las reglas de agregación (naturaleza, multi-tag, orden de tags): dos fuentes de verdad que pueden divergir; FR-006 pasaría de garantía estructural a compromiso de mantenimiento.
2. **Componer en la aplicación** (12 × `GetGlobalMonthlySummary` y sumar DTOs): lógica de negocio fuera del dominio (principio VII); el DTO de 006 no expone la atribución de ingresos por miembro que 009 necesita → habría que re-leer los movimientos igualmente; la invariante FR-006 dejaría de ser estructural.
3. **Agregación SQL dedicada** (`GROUP BY` mes/miembro/tag): nuevo contrato de puerto de salida + tests de integración para datos que se agregan trivialmente en memoria (misma razón por la que se descartó en los ADR 0010/0012); la atribución por miembro exigiría joins adicionales.
4. **12 llamadas a `listByMonth` desde el caso de uso**: 12 queries por render para obtener de una vez datos que luego se re-segmentan por mes; más latencia Turso (red) y más orquestación sin ganancia.
5. **`listAll()` sin rango y filtrar el año en memoria**: carga historia completa contra FR-011 («sin cargar más años de los necesarios»).
6. **Calcular en la página o el componente**: prohibido (VII: la UI nunca calcula).

## Decisión

El cálculo es un VO de dominio puro **`AnnualIncomeStatement`** (`src/domain/movement/AnnualIncomeStatement.ts`) con factory `fromMovements(inputs, accounts, members)` que **particiona los movimientos del año por mes** (derivado del campo `date`) y **compone 12 × `GlobalMonthlySummary.fromMovements`** (uno por mes Ene–Dic, los vacíos incluidos; cadena 0013 → 0012 → 0010) como única fuente de los KPIs mensuales y del desglose por tag: la coherencia FR-006 queda garantizada **estructuralmente** (cada columna mensual *es* el resumen global de ese mes) y clavada con un test de invariante. El VO añade en pasadas propias lo único nuevo de 009:

- **Atribución de ingresos por miembro** (`memberIncomeRows`): cada ingreso computa en la fila del dueño de la cuenta personal de registro; los de la cuenta común en la fila `memberId: null` («Cuenta común», etiqueta solo en UI). Agrupación por identidad (`memberId`): homónimos no fusionan; varias cuentas del mismo miembro sí. El catálogo completo (`MemberRepository.findAll()`) siempre presente con filas a cero (FR-002).
- **Saldo acumulado** (`accumulatedBalanceRow`, FR-012): running total de la fila «Saldo» desde enero; total de la fila = acumulado a diciembre = total anual de «Saldo»; **sin media mensual**.
- **Medias mensuales** (`averageCents`): `Math.round(totalCents / 12)` en todas las filas salvo la acumulada — único punto de redondeo de la feature (excepción acotada al ADR 0007: una sola división por fila, céntimo más próximo, no acumulativa; réplica del Excel, clarificación 2026-09-23).
- **Fusión anual de tags** (`tagRows`): fusión por `tagId` de los 12 `tagBreakdown`, solo gastos, orden por total anual descendente con desempate alfabético `es`.

La lectura de datos es propia del año vía nuevo método de puerto **`MovementRepository.listByYear(year)`** (`[YYYY-01-01, (YYYY+1)-01-01)` semicerrado sargable, mismas joins y orden que `listByMonth`), orquestada por el caso de uso autocontenido `GetAnnualIncomeStatement` (junto a `AccountRepository.findAll()` y `MemberRepository.findAll()`). La vista vive en **ruta propia `/annual`** (`src/app/annual/page.tsx`, searchParams `year` con Zod como `/summary` — ADR 0008) con selector de año `YearSelector` (`buildYearWindow`, radio 6) y panel servidor `AnnualStatementPanel` con dos tablas semánticas (tabla mensual y desglose por tag) en contenedor `overflow-x-auto`; los únicos cambios en pantallas existentes son los enlaces «Cuenta de resultados» en `/` (preserva el año del mes activo) y `/summary`.

## Consecuencias

- **Positivas**: una sola fuente de reglas agregadas (la cuenta anual hereda cualquier corrección de 006/005); FR-006 estructural y verificada por test de invariante; caso de uso autocontenido; sin índices nuevos ni migraciones — una query de rango sobre ≤ ~4.000 filas/año es sub-milisegundo a escala familiar (FR-011, YAGNI).
- **Negativas**: el puerto `MovementRepository` gana un método (breaking change acotado: solo el adaptador Drizzle y los dobles de tests lo implementan, actualizados en el mismo cambio); la media anual exige la única división de la feature (redondeo documentado y acotado a una unidad de céntimo por fila).
