export type Element = "Fuego" | "Tierra" | "Aire" | "Agua";
export type Modality = "Cardinal" | "Fijo" | "Mutable";

type DayMonth = { day: number; month: number };

export type Sign = {
  name: string;
  symbol: string;
  from: DayMonth;
  to: DayMonth;
  element: Element;
  modality: Modality;
};

// Tabla de signos de docs/astrologia-reglas.md (sección 2). Capricornio cruza el cambio de año.
export const SIGNS = [
  { name: "Aries", symbol: "♈", from: { day: 21, month: 3 }, to: { day: 20, month: 4 }, element: "Fuego", modality: "Cardinal" },
  { name: "Tauro", symbol: "♉", from: { day: 21, month: 4 }, to: { day: 20, month: 5 }, element: "Tierra", modality: "Fijo" },
  { name: "Géminis", symbol: "♊", from: { day: 21, month: 5 }, to: { day: 20, month: 6 }, element: "Aire", modality: "Mutable" },
  { name: "Cáncer", symbol: "♋", from: { day: 21, month: 6 }, to: { day: 20, month: 7 }, element: "Agua", modality: "Cardinal" },
  { name: "Leo", symbol: "♌", from: { day: 21, month: 7 }, to: { day: 21, month: 8 }, element: "Fuego", modality: "Fijo" },
  { name: "Virgo", symbol: "♍", from: { day: 22, month: 8 }, to: { day: 22, month: 9 }, element: "Tierra", modality: "Mutable" },
  { name: "Libra", symbol: "♎", from: { day: 23, month: 9 }, to: { day: 22, month: 10 }, element: "Aire", modality: "Cardinal" },
  { name: "Escorpio", symbol: "♏", from: { day: 23, month: 10 }, to: { day: 22, month: 11 }, element: "Agua", modality: "Fijo" },
  { name: "Sagitario", symbol: "♐", from: { day: 23, month: 11 }, to: { day: 21, month: 12 }, element: "Fuego", modality: "Mutable" },
  { name: "Capricornio", symbol: "♑", from: { day: 22, month: 12 }, to: { day: 19, month: 1 }, element: "Tierra", modality: "Cardinal" },
  { name: "Acuario", symbol: "♒", from: { day: 20, month: 1 }, to: { day: 18, month: 2 }, element: "Aire", modality: "Fijo" },
  { name: "Piscis", symbol: "♓", from: { day: 19, month: 2 }, to: { day: 20, month: 3 }, element: "Agua", modality: "Mutable" },
] as const satisfies readonly Sign[];

export type SignName = (typeof SIGNS)[number]["name"];
