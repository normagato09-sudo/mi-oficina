import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import "./oficina.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["800"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mi Oficina",
  description: "Oficina virtual con agentes de IA",
};

export const viewport: Viewport = { themeColor: "#0E1220" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} ${inter.variable} antialiased`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
