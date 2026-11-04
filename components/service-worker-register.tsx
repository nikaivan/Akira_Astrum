"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/sw-registration";

/** Registra el service worker cuando la página ya ha cargado, para no competir con el primer pintado. No pinta nada. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }
    const onLoad = () => void registerServiceWorker();
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
