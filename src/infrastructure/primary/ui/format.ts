export function formatAmountCents(cents: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatSignedAmountCents(amountCents: number, type: "expense" | "income"): string {
  const sign = type === "expense" ? "\u2212" : "+";
  return `${sign}${formatAmountCents(Math.abs(amountCents))}`;
}

export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildMonthWindow(center: string, radius = 24): string[] {
  const [year, monthNumber] = center.split("-").map(Number);
  const months: string[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const totalMonths = year * 12 + (monthNumber - 1) + offset;
    const windowYear = Math.floor(totalMonths / 12);
    const windowMonth = (totalMonths % 12) + 1;
    months.push(`${windowYear}-${String(windowMonth).padStart(2, "0")}`);
  }
  return months;
}
