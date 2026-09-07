import type { Metadata } from "next";

import { Toaster } from "@/infrastructure/primary/ui/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Family Wallet",
  description: "Gestión de gastos e ingresos familiares",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
