import { P, lienzo, px, tono, type Dibujo } from "./comun";

/** Mostrador de recepción, `casillas` de ancho (alto 64 px): frente de madera con el logo y encimera blanca. */
export function dibujarMostrador(casillas: number): Dibujo {
  const w = casillas * 32;
  const [c, ctx] = lienzo(w, 64);
  // Encimera (detrás, a la altura de quien atiende).
  px(ctx, 0, 6, w, 18, P.contorno);
  px(ctx, 1, 7, w - 2, 16, P.blanco);
  px(ctx, 1, 7, w - 2, 2, "#ffffff");
  // Ordenadores (por detrás) y una campanita.
  for (const x of [Math.floor(w * 0.25) - 10, Math.floor(w * 0.75) - 10]) {
    px(ctx, x, 0, 20, 12, P.contorno);
    px(ctx, x + 1, 1, 18, 10, "#4a4e5c");
  }
  px(ctx, Math.floor(w / 2) - 3, 10, 6, 4, P.amarillo);
  // Frente de madera con el logo.
  px(ctx, 0, 22, w, 42, P.contorno);
  px(ctx, 1, 23, w - 2, 40, P.madera);
  for (let i = 0; i < w; i += 8) px(ctx, i + 1, 24, 1, 38, tono(P.madera, -0.12));
  px(ctx, 1, 23, w - 2, 3, tono(P.madera, 0.3));
  px(ctx, 1, 58, w - 2, 5, P.maderaOscura);
  const cx = Math.floor(w / 2);
  px(ctx, cx - 14, 32, 28, 18, P.contorno);
  px(ctx, cx - 13, 33, 26, 16, P.amarillo);
  px(ctx, cx - 9, 36, 8, 5, P.contorno);
  px(ctx, cx + 1, 36, 8, 5, P.contorno);
  px(ctx, cx - 9, 42, 8, 5, P.contorno);
  px(ctx, cx + 1, 42, 8, 5, P.contorno);
  return { canvas: c };
}
