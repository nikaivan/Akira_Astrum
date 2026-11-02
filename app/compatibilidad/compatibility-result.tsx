import { CircleCheck, CircleMinus, TriangleAlert } from "lucide-react";
import type { CompatibilityResultData, PersonResult } from "@/lib/compatibility/calculate";

function LevelIcon({ level }: { level: CompatibilityResultData["level"] }) {
  switch (level) {
    case "alta":
      return <CircleCheck aria-hidden="true" className="size-5 shrink-0" />;
    case "media":
      return <CircleMinus aria-hidden="true" className="size-5 shrink-0" />;
    default:
      return <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />;
  }
}

function Person({ person, testId }: { person: PersonResult; testId: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden="true">{person.symbol}</span>
        <span>{person.sign}</span>
      </p>
      <p className="text-sm">Elemento: {person.element}</p>
    </div>
  );
}

/** Presenta el resultado ya calculado. Todo se pinta como texto. */
export function CompatibilityResult({ result }: { result: CompatibilityResultData }) {
  return (
    <section aria-labelledby="result-heading" className="flex flex-col gap-4">
      <h2 id="result-heading" className="text-xl font-semibold">
        Resultado
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Person person={result.people[0]} testId="sign-a" />
        <Person person={result.people[1]} testId="sign-b" />
      </div>
      <p data-testid="level" className="flex items-center gap-2 text-lg font-semibold">
        <LevelIcon level={result.level} />
        <span>Compatibilidad: {result.levelName}</span>
      </p>
      <p>{result.levelDescription}</p>
      <p data-testid="explanation">{result.text}</p>
      <p data-testid="disclaimer" className="text-sm">
        {result.disclaimer}
      </p>
    </section>
  );
}
