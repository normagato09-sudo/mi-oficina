import { P, T, lienzo, px, type Ctx, type Dibujo } from "./comun";

/** Pared de cristal vertical (vista desde arriba: un perfil fino), en la casilla (x, y) en px. */
export function pintarCristalVertical(ctx: Ctx, x: number, y: number, alto: number) {
  const cx = x + T / 2 - 3;
  px(ctx, cx, y, 6, alto, P.cristal);
  px(ctx, cx, y, 1, alto, P.cristalMarco);
  px(ctx, cx + 5, y, 1, alto, P.cristalMarco);
  px(ctx, cx + 2, y, 1, alto, P.cristalBrillo);
  for (let j = y; j < y + alto; j += T * 2) px(ctx, cx - 1, j, 8, 3, P.cristalMarco);
}

/**
 * Pared de cristal horizontal de `casillas` de ancho: se ve su cara (32 px de alto), transparente.
 * Es un dibujo aparte para que tape a quien está detrás y no a quien está delante.
 */
export function dibujarCristalHorizontal(casillas: number): Dibujo {
  const w = casillas * T;
  const [c, ctx] = lienzo(w, T + 8);
  px(ctx, 0, 6, w, T - 2, P.cristal);
  px(ctx, 0, 4, w, 3, P.cristalMarco);
  px(ctx, 0, T + 2, w, 4, P.cristalMarco);
  for (let i = 0; i <= casillas; i += 2) px(ctx, Math.min(i * T, w - 3), 4, 3, T + 2, P.cristalMarco);
  // Brillos en diagonal.
  for (let i = 0; i < casillas; i += 3)
    for (let k = 0; k < 12; k++) px(ctx, i * T + 8 + k, 26 - k * 2, 2, 2, P.cristalBrillo);
  return { canvas: c };
}
