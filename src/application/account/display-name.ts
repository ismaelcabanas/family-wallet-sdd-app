export function personalAccountDisplayName(memberName: string | null): string {
  return `Cuenta de ${memberName ?? "miembro"}`;
}
