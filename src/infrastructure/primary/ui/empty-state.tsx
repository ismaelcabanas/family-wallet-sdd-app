import type { ReactNode } from "react";

export function EmptyState({ children }: { children?: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      Aún no hay movimientos en este mes.
      <br />
      Pulsa «Nuevo movimiento» para registrar el primero.
      {children ? <span className="mt-3 block">{children}</span> : null}
    </p>
  );
}
