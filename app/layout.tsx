import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Vendas",
  description: "CRM interno para organizar e automatizar o processo comercial."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
