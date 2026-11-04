import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { cn } from "@/lib/utils";

// Fuentes servidas desde el propio dominio con next/font (docs/design.md §3).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], variable: "--font-serif" });

// Todas las páginas se renderizan en cada petición: el nonce de la CSP (proxy.ts) solo se puede aplicar así.
export const dynamic = "force-dynamic";

// Aplicación instalable (docs/design.md §6 bis): barra del sistema en noche y contenido hasta los bordes, con márgenes seguros.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B1026",
};

export const metadata: Metadata = {
  title: "Akira Astrum",
  description: "Blog de astrología",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("h-full antialiased", "font-sans", inter.variable, cormorant.variable)}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
