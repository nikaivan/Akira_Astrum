import type { Metadata } from "next";
import { DISCLAIMER } from "@/lib/astrology/compatibility-data";
import { CompatibilityForm } from "./compatibility-form";

export const metadata: Metadata = {
  title: "Compatibilidad entre signos · Akira Astrum",
  description: "Calcula la compatibilidad astrológica entre dos signos solares a partir de las fechas de nacimiento. No se guarda ningún dato.",
};

export default function CompatibilityPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">Compatibilidad entre signos</h1>
      <p>Introduce las dos fechas de nacimiento y descubre cómo se relacionan sus signos solares.</p>
      <CompatibilityForm disclaimer={DISCLAIMER} />
    </main>
  );
}
