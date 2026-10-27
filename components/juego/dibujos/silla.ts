import { P, circulo, lienzo, px, tono, type Dibujo } from "./comun";

/**
 * Silla de oficina con ruedas (32 × 40 px). `respaldo`: dónde queda el respaldo visto desde arriba.
 * "arriba": la persona mira hacia abajo (la silla queda detrás). "abajo": la persona da la espalda (el respaldo, delante).
 */
export function dibujarSilla(respaldo: "arriba" | "abajo", color: string = P.tela): Dibujo {
  const [c, ctx] = lienzo(32, 40);
  const osc = tono(color, -0.3);
  // Base de estrella con ruedas.
  px(ctx, 15, 30, 2, 5, P.metalOscuro);
  px(ctx, 7, 34, 18, 2, P.metalOscuro);
  for (const x of [6, 15, 24]) {
    px(ctx, x, 36, 3, 3, P.contorno);
  }
  if (respaldo === "arriba") {
    // Respaldo alto detrás y asiento delante.
    px(ctx, 6, 2, 20, 18, P.contorno);
    px(ctx, 7, 3, 18, 16, osc);
    px(ctx, 8, 4, 16, 3, color);
    px(ctx, 5, 18, 22, 12, P.contorno);
    px(ctx, 6, 19, 20, 10, color);
    px(ctx, 6, 19, 20, 2, tono(color, 0.2));
  } else {
    // Asiento detrás y respaldo delante (se ve su parte de atrás).
    px(ctx, 5, 8, 22, 10, P.contorno);
    px(ctx, 6, 9, 20, 8, color);
    px(ctx, 6, 16, 20, 13, P.contorno);
    px(ctx, 7, 17, 18, 11, osc);
    px(ctx, 7, 17, 18, 2, tono(osc, 0.2));
    circulo(ctx, 16, 22, 1, tono(osc, -0.3));
  }
  return { canvas: c };
}

/** Sillón de dirección (cuero), 40 × 44 px, respaldo arriba. */
export function dibujarSillon(): Dibujo {
  const [c, ctx] = lienzo(40, 44);
  const cuero = P.cuero;
  px(ctx, 19, 34, 2, 5, P.metalOscuro);
  px(ctx, 9, 38, 22, 2, P.metalOscuro);
  for (const x of [8, 19, 30]) px(ctx, x - 1, 40, 3, 3, P.contorno);
  px(ctx, 6, 0, 28, 24, P.contorno);
  px(ctx, 7, 1, 26, 22, tono(cuero, -0.15));
  for (let i = 0; i < 3; i++) px(ctx, 10, 5 + i * 6, 20, 1, tono(cuero, -0.35));
  px(ctx, 8, 2, 24, 2, tono(cuero, 0.2));
  px(ctx, 2, 20, 36, 14, P.contorno);
  px(ctx, 3, 21, 34, 12, cuero);
  px(ctx, 3, 21, 6, 12, tono(cuero, -0.2));
  px(ctx, 31, 21, 6, 12, tono(cuero, -0.2));
  px(ctx, 9, 21, 22, 2, tono(cuero, 0.25));
  return { canvas: c };
}
