# 16. Materialización perezosa de ingresos regulares con registro de meses

- **Fecha**: 2026-10-12
- **Estado**: Aceptado (feature 018, decisión del propietario 2026-10-12 sobre el punto de enganche)

## Contexto y problema

La feature 018 convierte la captura más repetitiva de la app (el ingreso habitual de cada miembro) en configuración: cada miembro define una sola vez su ingreso regular (importe, día del mes, nota) en su cuenta personal y los meses consultados ya traen el ingreso materializado como movimiento corriente. Había que decidir (1) el mecanismo de generación en un despliegue serverless sin estado ni planificador (Vercel plan gratuito), (2) dónde vive la idempotencia para que las consultas repetidas nunca dupliquen y **el borrado del mes sea definitivo**, y (3) el punto de enganche de la generación. Research en `specs/018-ingresos-regulares/research.md`.

## Opciones consideradas

1. **Cron / Vercel Cron / job programado**: fuera de alcance de la spec y por coste/infra (plan gratuito, constitución).
2. **Marca de origen en `movements` (`regular_income_id` + `source_month` UNIQUE)**: al borrar el movimiento desaparece su unicidad y el mes se regeneraría, violando FR-004; sostenerla exigiría borrado blando, que rompe el flujo de borrado existente.
3. **Idempotencia por existencia del movimiento** (query «¿hay un ingreso con la nota/día de la config?»): la edición manual del movimiento (FR-003) rompería la comprobación y duplicaría.
4. **Generación por lotes al guardar la config**: infringe la semántica perezosa (meses anteriores a la activación nunca se generan) y un borrado futuro sería destructivo.
5. **Efectos de escritura en los repositorios/use cases de lectura** (`DrizzleMovementRepository.listBy*`, decorar `ListMovements`): efecto oculto en lectura, no cubre `getBalance` (SQL directo) y acopla el repo de movimientos a la feature.
6. **Enganchar `/summary` y `/annual` además de la página de cuenta**: diferido por decisión del propietario (2026-10-12); extensión futura aditiva (una llamada por página).

## Decisión

- **Materialización perezosa al consultar, solo en la página de la cuenta** (`src/app/accounts/[accountId]/page.tsx`): la página invoca `MaterializeRegularIncomes.ensureForAccountAndMonth(accountId, mes, currentMonth)` **antes del `Promise.all`** de lecturas, cubriendo listado, cierre y balance del mismo render. Es el disparador único (decisión del propietario 2026-10-12): la página donde el usuario registraría a mano el ingreso si la feature no existiera. `/summary` y `/annual` **no materializan** — muestran los movimientos existentes —; trade-off aceptado (un mes no consultado en su cuenta no muestra el ingreso en los agregados hasta consultarlo allí; iteración futura aditiva si el uso lo exige).
- **Registro de meses materializados `regular_income_months`** (`UNIQUE (regular_income_id, month)`) como fuente de idempotencia: la materialización de un mes es «si el par no existe, crear movimiento + fila **en una transacción**» (`INSERT … ON CONFLICT DO NOTHING RETURNING`; sin fila devuelta → carrera perdida → no se crea movimiento). Así: consultas repetidas nunca duplican (también ante renders concurrentes), **borrar el movimiento no regenera el mes** (la fila sobrevive al borrado físico) y los cambios de config son solo-adelante (la config solo se lee para meses sin registro).
- **`movements` queda intacta**: el ingreso generado es un movimiento corriente (FR-003), editable/borrable con los flujos existentes; sin marca de origen, columnas ni unicidades nuevas.
- **`currentMonth` como parámetro del adaptador** (calculado con `ui/format.ts` en la página y la action): aplicación pura y tests deterministas, sin puerto `Clock` (misma convención que `?month=`/`year=`; research §3.3).
- **Guardas estructurales en el caso de uso**, no en la UI: `activatedAtMonth ≤ mes ≤ currentMonth` (comparación lexicográfica de `YYYY-MM`) y config activa — los meses futuros alcanzables por URL quedan blindados (FR-005) aunque la vista no acote.

## Consecuencias

- **Positivas**: viable en serverless sin cron ni estado; coste habitual = una SELECT sobre las tablas nuevas (mes ya materializado o sin config); primera consulta de un mes pendiente = 1 movimiento (materialización por mes consultado, nunca por lotes); `movements` y los flujos de edición/borrado intactos (FR-003/FR-004); semántica de reactivación sin huecos (la (re)activación fija `activatedAtMonth = mes en curso`; las ediciones no lo tocan).
- **Negativas / trade-offs**: los agregados (`/summary`, `/annual`) muestran huecos en meses nunca abiertos por la página de cuenta hasta que se consulten allí; el registro de meses es estructura nueva (migración aditiva 0003) que auditúa el ciclo de vida de la config.
- La agregados no materializan por decisión explícita del propietario; recuperar `monthRange`/rangos sería trivial si se re-extiende el enganche (YAGNI hoy, principio I).
