import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DISCLAIMER } from "@/lib/astrology/compatibility-data";
import { CompatibilityForm } from "./compatibility-form";

export const metadata: Metadata = {
  title: "Compatibilidad entre signos · Akira Astrum",
  description: "Calcula la compatibilidad astrológica entre dos signos solares a partir de las fechas de nacimiento. No se guarda ningún dato.",
};

export default function CompatibilityPage() {
  return (
    <>
      <SiteHeader current="compatibility" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold sm:text-5xl">Compatibilidad entre signos</h1>
          <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">
            Introduce las dos fechas de nacimiento y descubre cómo se relacionan sus signos solares.
          </p>
        </div>
        <CompatibilityForm disclaimer={DISCLAIMER} />
      </main>
      <SiteFooter />
    </>
  );
}
