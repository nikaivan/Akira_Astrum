"use server";

import { headers } from "next/headers";
import { clientIpFrom } from "@/lib/auth/rate-limit";
import { recordSecurityEvent } from "@/lib/security/log";
import { calculateCompatibility, type CompatibilityState } from "./calculate";
import { createCompatibilityLimiter } from "./limiter";
import { RATE_LIMIT_ERROR } from "./messages";

const limiter = createCompatibilityLimiter();

/** "Hoy" es la fecha UTC del servidor (AAAA-MM-DD). */
const todayUtc = () => new Date().toISOString().slice(0, 10);

async function currentIp(): Promise<string> {
  try {
    return clientIpFrom(await headers());
  } catch {
    return "unknown";
  }
}

export async function compatibilityAction(
  _previous: CompatibilityState | null,
  formData: FormData,
): Promise<CompatibilityState> {
  const ip = await currentIp();
  const state = await calculateCompatibility({ formData, today: todayUtc(), limiter, ip });
  // Solo el límite es un evento de seguridad; las fechas no se leen ni se registran (A09).
  if (!state.ok && state.message === RATE_LIMIT_ERROR) recordSecurityEvent({ event: "rate_limited", scope: "calculator", ip });
  return state;
}
