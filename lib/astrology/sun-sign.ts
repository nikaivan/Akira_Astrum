import { isCalendarDate, type BirthDate } from "./birth-date";
import { SIGNS, type SignName } from "./signs";

const dayKey = (month: number, day: number) => month * 100 + day;

/** Signo solar según la convención fija de docs/astrologia-reglas.md; solo cuentan el día y el mes. */
export function getSunSign(birth: BirthDate): SignName {
  if (!isCalendarDate(birth)) throw new Error("Fecha no válida");

  const x = dayKey(birth.month, birth.day);
  const sign = SIGNS.find(({ from, to }) => {
    const start = dayKey(from.month, from.day);
    const end = dayKey(to.month, to.day);
    return start <= end ? x >= start && x <= end : x >= start || x <= end;
  });

  if (!sign) throw new Error("Fecha no válida");
  return sign.name;
}
