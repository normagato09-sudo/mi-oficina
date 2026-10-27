import { P, lienzo, px, tono, type Dibujo } from "./comun";

/** Escalera que baja (96 × 96 px, 3 × 3 casillas) con barandilla, vista desde arriba. */
export function dibujarEscalera(): Dibujo {
  const [c, ctx] = lienzo(96, 96);
  px(ctx, 0, 0, 96, 96, P.contorno);
  // Peldaños que se oscurecen al bajar.
  for (let i = 0; i < 12; i++) {
    const y = 1 + i * 8;
    const color = tono("#c9c2b4", -i * 0.04);
    px(ctx, 9, y, 78, 8, color);
    px(ctx, 9, y, 78, 1, tono(color, 0.25));
    px(ctx, 9, y + 7, 78, 1, tono(color, -0.25));
  }
  // Barandillas.
  for (const x of [1, 87]) {
    px(ctx, x, 1, 8, 94, "#7d8491");
    px(ctx, x + 2, 1, 3, 94, "#aab0bb");
  }
  // Flecha de bajada.
  px(ctx, 44, 30, 8, 30, "rgba(42, 36, 51, 0.35)");
  for (let k = 0; k < 8; k++) px(ctx, 40 + k, 60 + k, 16 - k * 2, 1, "rgba(42, 36, 51, 0.35)");
  return { canvas: c };
}
