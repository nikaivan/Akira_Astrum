import { z } from "zod";

export type BirthDate = { year: number; month: number; day: number };

const INVALID_DATE = "Fecha no válida";
const MIN_YEAR = 1900;
const DATE_TEXT = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Comprueba el calendario con números: no depende de la zona horaria. */
export function isCalendarDate({ year, month, day }: BirthDate): boolean {
  return (
    [year, month, day].every(Number.isInteger) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

function parseText(input: unknown): BirthDate {
  const text = DATE_TEXT.safeParse(input);
  if (!text.success) throw new Error(INVALID_DATE);

  const [year, month, day] = text.data.split("-").map(Number);
  const date = { year, month, day };
  if (!isCalendarDate(date)) throw new Error(INVALID_DATE);
  return date;
}

const sortKey = ({ year, month, day }: BirthDate) => year * 10000 + month * 100 + day;

/** Valida un texto AAAA-MM-DD entre 1900 y `today` (inclusive). Los errores son genéricos. */
export function parseBirthDate(input: unknown, today: string): BirthDate {
  const birth = parseText(input);
  const limit = parseText(today);

  if (birth.year < MIN_YEAR || sortKey(birth) > sortKey(limit)) throw new Error(INVALID_DATE);
  return birth;
}
