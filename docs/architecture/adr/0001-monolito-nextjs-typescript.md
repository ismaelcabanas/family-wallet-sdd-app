# 1. Monolito Next.js con TypeScript estricto

- **Fecha**: 2026-08-26
- **Estado**: Aceptado

## Contexto y problema

Family Wallet es una webapp familiar de uso individual, sin login, mantenida por una sola persona. Se necesita UI + API + persistencia con la mínima fricción operativa posible y coste cero, accesible tanto en local para desarrollo como desde cualquier dispositivo de la familia en producción.

## Opciones consideradas

1. **Monolito Next.js (App Router)**: UI y API en un único proyecto TypeScript.
2. Backend (Node/Express o similar) + SPA separadas con API REST.
3. Monolito Nuxt (Vue) equivalente.

## Decisión

Monolito Next.js (App Router) con TypeScript en modo estricto end-to-end (constitución, principios I y IV).

## Consecuencias

- **Positivas**: un solo proyecto y despliegue; tipos compartidos entre cliente y servidor; Server Components y Route Handlers integrados; ecosistema React; alineado con el despliegue en Vercel.
- **Negativas**: acoplamiento al ecosistema Next/React (aceptado para este alcance); el serverless tiene filesystem efífero, lo que obliga a persistencia externa (ver ADR-0003).
- **Plan de contingencia**: si el producto creciera hacia multiusuario con carga real, el monolito puede extraerse a servicios gradualmente, justificándolo en plan.
