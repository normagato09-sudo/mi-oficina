"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** El Director trabaja (o hay cola): hay que seguir mirando. */
  activo: boolean;
  /** Huella de lo que se ve ahora (la calcula el servidor al pintar la página). */
  firma: string;
  cadaMs?: number;
};

/**
 * Refresco automático ligero: cada `cadaMs` pide solo la huella del estado (/api/estado) y vuelve a
 * cargar la página únicamente si ha cambiado. Ese vistazo también hace avanzar la cola en el servidor.
 */
export default function AutoRefresco({ activo, firma, cadaMs = 4000 }: Props) {
  const router = useRouter();
  const firmaActual = useRef(firma);
  useEffect(() => {
    firmaActual.current = firma;
  }, [firma]);

  useEffect(() => {
    if (!activo) return;
    let seguir = true;
    let temporizador: ReturnType<typeof setTimeout>;
    const mirar = async () => {
      // Con la pestaña oculta no hace falta: al volver, el siguiente tic la pone al día.
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/estado", { cache: "no-store" });
          if (r.ok) {
            const estado = (await r.json()) as { firma: string; activo: boolean };
            if (estado.firma !== firmaActual.current) {
              firmaActual.current = estado.firma;
              router.refresh();
            }
          }
        } catch {
          // Sin conexión: se reintenta en el siguiente tic.
        }
      }
      if (seguir) temporizador = setTimeout(mirar, cadaMs);
    };
    temporizador = setTimeout(mirar, cadaMs);
    return () => {
      seguir = false;
      clearTimeout(temporizador);
    };
  }, [activo, cadaMs, router]);
  return null;
}
