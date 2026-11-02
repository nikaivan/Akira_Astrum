"use server";

import { headers } from "next/headers";
import { clientIpFrom } from "@/lib/auth/rate-limit";
import { calculateCompatibility, type CompatibilityState } from "./calculate";
import { createCompatibilityLimiter } from "./limiter";

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
  return calculateCompatibility({ formData, today: todayUtc(), limiter, ip: await currentIp() });
}
