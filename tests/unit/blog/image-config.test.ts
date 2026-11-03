import { afterEach, describe, expect, it, vi } from "vitest";
import { buildImageConfig, STORAGE_IMAGE_PATH } from "@/lib/blog/image-config";
import { ORIGIN } from "./support";

const HOST = "abcdefghijklmnopqrst.supabase.co";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("buildImageConfig: next/image solo admite el Storage público del proyecto", () => {
  it("permite exactamente un patrón: https, el host del proyecto y su bucket de imágenes", () => {
    expect(buildImageConfig(ORIGIN)).toEqual({
      remotePatterns: [{ protocol: "https", hostname: HOST, port: "", pathname: "/storage/v1/object/public/post-images/**", search: "" }],
    });
    expect(STORAGE_IMAGE_PATH).toBe("/storage/v1/object/public/post-images/");
  });

  it("no usa domains ni comodines de host", () => {
    const config = buildImageConfig(ORIGIN);
    expect(Object.keys(config)).toEqual(["remotePatterns"]);
    expect(JSON.stringify(config)).not.toMatch(/"hostname":"[^"]*\*/);
  });

  it.each([undefined, "", "no es una url", "http://abcdefghijklmnopqrst.supabase.co", "https://user:pw@abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co:8443", "javascript:alert(1)"])(
    "sin un https limpio (%j) no se permite ningún host (falla cerrado)",
    (url) => {
      expect(buildImageConfig(url)).toEqual({ remotePatterns: [] });
    },
  );

  it("next.config.ts lo toma de NEXT_PUBLIC_SUPABASE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN);
    vi.resetModules();
    const { default: nextConfig } = await import("@/next.config");
    expect(nextConfig.images).toEqual(buildImageConfig(ORIGIN));
  });

  it("y sin la variable, next.config.ts no permite ningún host", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.resetModules();
    const { default: nextConfig } = await import("@/next.config");
    expect(nextConfig.images).toEqual({ remotePatterns: [] });
  });
});
