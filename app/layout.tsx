import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthCookieSync } from "@/components/auth-cookie-sync";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

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
      <body className={inter.variable}>
        <AuthCookieSync />
        {children}
      </body>
    </html>
  );
}
