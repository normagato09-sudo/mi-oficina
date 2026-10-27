import { P, circulo, lienzo, px, type Dibujo } from "./comun";

/** Mesa redonda de cafetería con dos tazas (32 × 40 px). */
export function dibujarMesaRedonda(): Dibujo {
  const [c, ctx] = lienzo(32, 40);
  px(ctx, 14, 22, 4, 14, P.metalOscuro);
  px(ctx, 8, 35, 16, 3, P.metalOscuro);
  circulo(ctx, 16, 16, 14, P.contorno);
  circulo(ctx, 16, 16, 13, P.blanco);
  circulo(ctx, 13, 12, 4, "#ffffff");
  px(ctx, 8, 14, 5, 5, P.contorno);
  px(ctx, 9, 15, 3, 3, "#7a4a2a");
  px(ctx, 19, 17, 5, 5, P.contorno);
  px(ctx, 20, 18, 3, 3, P.amarillo);
  return { canvas: c };
}

/** Taburete o silla pequeña de cafetería (24 × 28 px). */
export function dibujarTaburete(color: string = P.amarillo): Dibujo {
  const [c, ctx] = lienzo(24, 28);
  px(ctx, 10, 12, 4, 12, P.metalOscuro);
  px(ctx, 5, 23, 14, 3, P.metalOscuro);
  circulo(ctx, 12, 10, 9, P.contorno);
  circulo(ctx, 12, 10, 8, color);
  circulo(ctx, 10, 8, 3, "rgba(255,255,255,0.35)");
  return { canvas: c };
}

/** Mesita baja de centro (64 × 36 px) con revistas. */
export function dibujarMesita(): Dibujo {
  const [c, ctx] = lienzo(64, 36);
  px(ctx, 4, 28, 4, 8, P.maderaOscura);
  px(ctx, 56, 28, 4, 8, P.maderaOscura);
  px(ctx, 0, 6, 64, 24, P.contorno);
  px(ctx, 1, 7, 62, 18, P.maderaClara);
  px(ctx, 1, 25, 62, 4, P.maderaClaraSombra);
  px(ctx, 10, 10, 16, 11, P.contorno);
  px(ctx, 11, 11, 14, 9, "#d35d6e");
  px(ctx, 14, 12, 16, 11, P.contorno);
  px(ctx, 15, 13, 14, 9, "#4f9ad6");
  px(ctx, 44, 12, 8, 8, P.contorno);
  px(ctx, 45, 13, 6, 6, "#ffffff");
  return { canvas: c };
}
