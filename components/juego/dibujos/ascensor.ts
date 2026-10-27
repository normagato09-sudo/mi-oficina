import { P, lienzo, px, tono, type Dibujo } from "./comun";

/** Puertas del ascensor en la pared (64 × 64 px, las dos casillas de la cara del muro). */
export function dibujarAscensor(): Dibujo {
  const [c, ctx] = lienzo(64, 64);
  // Marco de acero.
  px(ctx, 4, 6, 56, 52, P.contorno);
  px(ctx, 5, 7, 54, 50, "#7d8491");
  // Pantalla de planta (el número lo pone el juego encima).
  px(ctx, 22, 8, 20, 9, P.contorno);
  px(ctx, 23, 9, 18, 7, "#1d1f27");
  // Dos hojas de acero cepillado.
  for (const x of [9, 32]) {
    px(ctx, x, 19, 23, 39, P.contorno);
    px(ctx, x + 1, 20, 21, 38, "#c3c8d2");
    for (let i = 0; i < 6; i++) px(ctx, x + 3 + i * 3, 21, 1, 36, tono("#c3c8d2", 0.12));
  }
  px(ctx, 31, 19, 2, 39, "#6b7280");
  // Botones a la derecha.
  px(ctx, 57, 32, 5, 12, P.contorno);
  px(ctx, 58, 34, 3, 3, P.amarillo);
  px(ctx, 58, 39, 3, 3, "#e3e5ea");
  return { canvas: c };
}
