import { P, lienzo, px, tono, type Dibujo } from "./comun";

/**
 * Sofá de `casillas` de ancho (alto 48 px). `mira`: hacia dónde se sienta uno.
 * "abajo": el respaldo queda arriba (contra la pared). "arriba": el respaldo, delante.
 */
export function dibujarSofa(casillas: number, color: string, mira: "abajo" | "arriba" = "abajo"): Dibujo {
  const w = casillas * 32;
  const [c, ctx] = lienzo(w, 48);
  const osc = tono(color, -0.25);
  const luz = tono(color, 0.2);
  px(ctx, 0, 6, w, 40, P.contorno);
  if (mira === "abajo") {
    px(ctx, 1, 7, w - 2, 14, osc); // respaldo
    px(ctx, 1, 7, w - 2, 2, color);
    px(ctx, 1, 21, w - 2, 20, color); // asiento
    for (let i = 1; i < casillas; i++) px(ctx, i * 32, 22, 1, 18, osc);
    px(ctx, 1, 21, w - 2, 2, luz);
  } else {
    px(ctx, 1, 7, w - 2, 20, color);
    for (let i = 1; i < casillas; i++) px(ctx, i * 32, 8, 1, 18, osc);
    px(ctx, 1, 27, w - 2, 14, osc);
    px(ctx, 1, 27, w - 2, 2, tono(osc, 0.2));
  }
  // Brazos y patas.
  px(ctx, 1, 9, 6, 32, osc);
  px(ctx, w - 7, 9, 6, 32, osc);
  px(ctx, 3, 46, 4, 2, P.maderaOscura);
  px(ctx, w - 7, 46, 4, 2, P.maderaOscura);
  px(ctx, 1, 41, w - 2, 4, tono(osc, -0.2));
  // Un cojín.
  if (mira === "abajo") {
    px(ctx, 9, 12, 12, 11, P.contorno);
    px(ctx, 10, 13, 10, 9, P.amarillo);
  }
  return { canvas: c };
}
