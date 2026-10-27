"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Mientras `activo`, vuelve a pedir la página cada `cadaMs` (y así la cola avanza y se ve al momento). */
export default function AutoRefresco({ activo, cadaMs = 4000 }: { activo: boolean; cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!activo) return;
    const temporizador = setInterval(() => {
      // Con la pestaña oculta no hace falta: al volver, el siguiente tic la pone al día.
      if (document.visibilityState === "visible") router.refresh();
    }, cadaMs);
    return () => clearInterval(temporizador);
  }, [activo, cadaMs, router]);
  return null;
}
