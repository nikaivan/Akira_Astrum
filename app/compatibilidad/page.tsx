import type { Metadata } from "next";
import { PageBanner } from "@/components/page-banner";
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
      <main className="flex flex-1 flex-col">
        <PageBanner
          title="Compatibilidad entre signos"
          description="Introduce las dos fechas de nacimiento y descubre cómo se relacionan sus signos solares."
        />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
          <CompatibilityForm disclaimer={DISCLAIMER} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
