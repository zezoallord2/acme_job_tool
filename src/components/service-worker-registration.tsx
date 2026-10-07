"use client";

import { useEffect } from "react";

/**
 * Service worker registration.
 *
 * Registered only in production and only where the browser supports it.
 * Registration failure is deliberately ignored: the app works without it, so a
 * console error would be noise rather than information.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    };

    // Registering after load keeps the service worker off the critical path.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
