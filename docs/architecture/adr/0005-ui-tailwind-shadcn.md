# 5. Stack de UI: Tailwind CSS + shadcn/ui

- **Fecha**: 2026-08-31
- **Estado**: Aceptado

## Contexto y problema

La constitución v1.1.3 no fijaba la tecnología de UI: cada feature podría elegir, con riesgo de divergencia visual y de dependencias entre features. El proyecto es una app personal en español, sin diseñador, desarrollada en solitario con agentes de IA; se necesita consistencia visual y accesibilidad sin mantener un sistema de diseño propio.

## Opciones consideradas

1. **Tailwind CSS + shadcn/ui**: utilidades + componentes accesibles copiados al repositorio y personalizables.
2. **Tailwind CSS a pelo**: control total, pero obliga a construir y mantener todos los componentes desde cero.
3. **CSS Modules**: aislamiento local por componente, sin utilidades ni base de componentes.
4. **Librería de componentes completa (MUI, Mantine, Chakra)**: componentes listos, pero estilos y dependencias propias difíciles de adaptar.

## Decisión

Tailwind CSS + shadcn/ui como stack de UI del proyecto: los componentes se copian y versionan en el repositorio (no se dependen de un paquete opaco), y ninguna otra librería de componentes se admite sin justificación en el plan. Fijado en la constitución v1.2.0 (Restricciones Tecnológicas).

## Consecuencias

- **Positivas**: consistencia visual entre features con esfuerzo mínimo; accesibilidad heredada de las primitivas Radix subyacentes; control total del código de los componentes (editable, auditable por agentes); alineado con los defaults de `create-next-app` (Tailwind incluido).
- **Negativas**: los componentes copiados se mantienen por el proyecto (actualizaciones manuales); dependencia transitiva de Radix UI (aceptada).
