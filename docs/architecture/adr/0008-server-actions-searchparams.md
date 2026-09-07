# 8. Mutación vía Server Actions y estado de pantalla en searchParams

- **Fecha**: 2026-09-03
- **Estado**: Aceptado

## Contexto y problema

La pantalla principal de la feature 002 necesita (FR-011, FR-014–FR-018): registrar movimientos con validación por campo y conservación de valores en fallo; estado de contexto (cuenta activa + mes) compartido por selectores, formulario, balance y listado; y actualización de listado/balance tras guardar en el mismo roundtrip.

## Opciones consideradas

1. **Route Handler `POST /api/movements` + `fetch` cliente**: mapeo manual de errores por campo, pending/toast manuales, mutación + `router.refresh()` (2 roundtrips), glue CSRF propio; sin consumidor no-UI (YAGNI).
2. **Estado de pantalla en cliente (`useState`/Context/Zustand)**: la URL pierde significado, el refresco pierde el contexto y listado/balance migrarían a cliente; Zustand fuera del stack autorizado.
3. **Server Action (`'use server'`) + `useActionState`, y cuenta/mes como URL searchParams** con render en servidor.

## Decisión

- Mutación: Server Action `createMovement` en `src/infrastructure/primary/actions/create-movement.action.ts` como adaptador inbound único. Valida FormData con Zod (frontera), delega en el caso de uso `CreateMovement`, mapea `ZodError`/excepciones de dominio a errores por campo (`errors`) + valores conservados (`values`), y en éxito llama `revalidatePath('/')` y devuelve `{ status: 'success' }` sin redirect. El formulario consume el estado con `useActionState` (toast "Movimiento guardado", reset a defaults y botón `pending` "Guardando…").
- Estado de pantalla: `/?account=<id>&month=YYYY-MM` con validación en `src/app/page.tsx` (defaults: primera cuenta personal y mes actual). Los selectores son client components que actualizan la URL con `router.replace` + `useTransition`; fuente única de verdad para selectores, balance, formulario y listado.

## Consecuencias

- **Positivas**: errores por campo y conservación de valores con el patrón oficial de forms de Next.js; listado/balance refrescados en el mismo roundtrip; URL compartible/recargable; todo el estado de datos vive en servidor consumiendo la capa de aplicación (principio VII); funciona como fallback progresivo sin JS.
- **Negativas**: el estado de pantalla vive en la URL (los selectores deben mantenerla sincronizada); las Server Actions solo son consumibles por la UI (si surgiera un consumidor programático, se añadiría Route Handler en su momento); `useActionState` obliga a mockear la action en tests de componentes.
