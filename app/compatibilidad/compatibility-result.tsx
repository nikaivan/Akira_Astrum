import { CircleCheck, CircleMinus, TriangleAlert } from "lucide-react";
import type { CompatibilityResultData, PersonResult } from "@/lib/compatibility/calculate";

type Level = CompatibilityResultData["level"];

// Estado con icono y texto, nunca solo color (docs/design.md §2). Colores con contraste AA.
function levelStyle(level: Level): { Icon: typeof CircleCheck; className: string } {
  switch (level) {
    case "alta":
      return { Icon: CircleCheck, className: "border-green-800/30 bg-green-100 text-green-900" };
    case "media":
      return { Icon: CircleMinus, className: "border-amber-800/30 bg-amber-100 text-amber-900" };
    default:
      return { Icon: TriangleAlert, className: "border-red-800/30 bg-red-100 text-red-900" };
  }
}

function Person({ person, testId }: { person: PersonResult; testId: string }) {
  return (
    <div data-testid={testId} className="flex flex-col items-center gap-1 text-center">
      <span aria-hidden="true" className="text-5xl leading-none text-gold">
        {person.symbol}
      </span>
      <p className="font-heading text-3xl font-semibold">{person.sign}</p>
      <p className="text-base text-muted-foreground">Elemento: {person.element}</p>
    </div>
  );
}

/** Presenta el resultado ya calculado. Todo se pinta como texto. */
export function CompatibilityResult({ result }: { result: CompatibilityResultData }) {
  const { Icon, className } = levelStyle(result.level);

  return (
    <section aria-labelledby="result-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="result-heading" className="text-center text-3xl font-semibold">
        Resultado
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <Person person={result.people[0]} testId="sign-a" />
        <Person person={result.people[1]} testId="sign-b" />
      </div>
      <div className={`flex flex-col gap-1 rounded-lg border p-4 ${className}`}>
        <p data-testid="level" className="flex items-center gap-2 text-xl font-semibold">
          <Icon aria-hidden="true" className="size-6 shrink-0" />
          <span>Compatibilidad: {result.levelName}</span>
        </p>
        <p className="text-base">{result.levelDescription}</p>
      </div>
      <p data-testid="explanation" className="max-w-prose text-lg leading-relaxed">
        {result.text}
      </p>
      <p data-testid="disclaimer" className="border-l-4 border-gold pl-3 text-base leading-relaxed text-muted-foreground">
        {result.disclaimer}
      </p>
    </section>
  );
}
