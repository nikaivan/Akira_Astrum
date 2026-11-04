import type { Metadata } from "next";
import "./globals.css";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { cn } from "@/lib/utils";

// Fuentes servidas desde el propio dominio con next/font (docs/design.md §3).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Akira Astrum",
  description: "Blog de astrología",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("h-full antialiased", "font-sans", inter.variable, cormorant.variable)}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
