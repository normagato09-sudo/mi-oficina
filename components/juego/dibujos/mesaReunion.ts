import { P, azar, circulo, lienzo, px, tono, type Dibujo } from "./comun";

/**
 * Mesa de reunión de madera de `casillas` × 2 casillas (el lienzo sube 16 px por encima).
 * Encima: portátiles, papeles, vasos de agua y una planta en el centro.
 */
export const SUBE_MESA_REUNION = 16;

export function dibujarMesaReunion(casillas: number): Dibujo {
  const w = casillas * 32;
  const h = 64 + SUBE_MESA_REUNION;
  const [c, ctx] = lienzo(w, h);
  const madera = P.madera;
  // Patas.
  px(ctx, 6, h - 14, 5, 14, P.maderaOscura);
  px(ctx, w - 11, h - 14, 5, 14, P.maderaOscura);
  // Tablero con contorno, brillo y canto.
  const y0 = SUBE_MESA_REUNION;
  px(ctx, 0, y0, w, 52, P.contorno);
  px(ctx, 1, y0 + 1, w - 2, 44, madera);
  px(ctx, 1, y0 + 45, w - 2, 6, P.maderaOscura);
  px(ctx, 4, y0 + 3, w - 8, 2, tono(madera, 0.25));
  for (let i = 0; i < casillas * 2; i++) px(ctx, 6 + Math.floor(azar(i, 3) * (w - 30)), y0 + 8 + Math.floor(azar(3, i) * 32), 18, 1, tono(madera, -0.08));
  // Cosas encima, delante de cada asiento.
  for (let i = 0; i < casillas; i++) {
    const x = i * 32 + 8;
    if (i % 2 === 0) {
      px(ctx, x, y0 + 5, 16, 10, P.contorno);
      px(ctx, x + 1, y0 + 6, 14, 8, P.papel);
      px(ctx, x + 3, y0 + 8, 9, 1, "#c3c8d2");
      px(ctx, x + 3, y0 + 10, 7, 1, "#c3c8d2");
    } else {
      px(ctx, x, y0 + 4, 16, 12, P.contorno);
      px(ctx, x + 1, y0 + 5, 14, 10, "#b9bec9");
      px(ctx, x + 2, y0 + 6, 12, 7, P.pantalla);
    }
    px(ctx, x + 2, y0 + 31, 14, 9, P.contorno);
    px(ctx, x + 3, y0 + 32, 12, 7, P.papel);
    px(ctx, x + 19, y0 + 30, 5, 6, P.contorno);
    px(ctx, x + 20, y0 + 31, 3, 4, "#cfe9fb");
  }
  // Planta en el centro.
  const cx = Math.floor(w / 2);
  circulo(ctx, cx, y0 + 22, 6, P.contorno);
  circulo(ctx, cx, y0 + 22, 5, P.verde);
  px(ctx, cx - 2, y0 + 18, 3, 2, P.verdeClaro);
  return { canvas: c };
}

/** Mesa de dirección de madera oscura, 3 × 2 casillas (sube 16 px): ordenador, lámpara y carpetas. */
export function dibujarMesaDireccion(): Dibujo {
  const w = 96;
  const h = 80;
  const [c, ctx] = lienzo(w, h);
  const y0 = 16;
  px(ctx, 0, y0, w, 56, P.contorno);
  px(ctx, 1, y0 + 1, w - 2, 40, P.maderaOscura);
  px(ctx, 3, y0 + 3, w - 6, 2, tono(P.maderaOscura, 0.25));
  px(ctx, 1, y0 + 41, w - 2, 14, tono(P.maderaOscura, -0.25));
  px(ctx, 8, y0 + 44, w - 16, 1, tono(P.maderaOscura, 0.1));
  px(ctx, 4, h - 8, 6, 8, P.contorno);
  px(ctx, w - 10, h - 8, 6, 8, P.contorno);
  // Teclado y ratón (junto a mí, arriba).
  px(ctx, 34, y0 + 4, 26, 6, P.contorno);
  px(ctx, 35, y0 + 5, 24, 4, "#e3e5ea");
  px(ctx, 63, y0 + 4, 5, 6, P.contorno);
  px(ctx, 64, y0 + 5, 3, 4, "#e3e5ea");
  // Ordenador grande, visto por detrás.
  px(ctx, 44, y0 + 22, 8, 10, "#c9ccd3");
  px(ctx, 32, y0 + 8, 32, 18, P.contorno);
  px(ctx, 33, y0 + 9, 30, 16, "#d9dce3");
  px(ctx, 46, y0 + 15, 4, 4, "#b9bec9");
  // Lámpara de mesa.
  px(ctx, 80, y0 + 6, 10, 4, P.contorno);
  px(ctx, 81, y0 + 7, 8, 2, P.amarillo);
  px(ctx, 84, y0 + 10, 2, 12, P.metalOscuro);
  px(ctx, 81, y0 + 22, 8, 3, P.metalOscuro);
  // Carpetas y bolígrafo.
  px(ctx, 6, y0 + 8, 18, 14, P.contorno);
  px(ctx, 7, y0 + 9, 16, 12, "#2f6db5");
  px(ctx, 9, y0 + 11, 12, 9, P.papel);
  px(ctx, 8, y0 + 26, 14, 2, P.amarillo);
  return { canvas: c };
}
