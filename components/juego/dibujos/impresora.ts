import { P, lienzo, px, type Dibujo } from "./comun";

/** Impresora grande de oficina sobre su mueble (32 × 52 px). */
export function dibujarImpresora(): Dibujo {
  const [c, ctx] = lienzo(32, 52);
  px(ctx, 2, 6, 28, 46, P.contorno);
  px(ctx, 3, 7, 26, 44, "#dfe2e8");
  px(ctx, 3, 7, 26, 3, "#f2f4f7");
  // Bandeja de salida con papel.
  px(ctx, 6, 12, 20, 6, "#9aa0ab");
  px(ctx, 8, 9, 16, 6, P.papel);
  // Panel con pantalla y botón.
  px(ctx, 20, 20, 7, 4, P.pantalla);
  px(ctx, 21, 21, 3, 1, "#8fd0f5");
  px(ctx, 6, 21, 3, 2, "#5fd08a");
  // Cajones.
  for (let i = 0; i < 3; i++) {
    px(ctx, 4, 27 + i * 8, 24, 1, "#aab0bb");
    px(ctx, 13, 30 + i * 8, 6, 1, P.metalOscuro);
  }
  return { canvas: c };
}
