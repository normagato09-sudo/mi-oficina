import { P, azar, circulo, lienzo, px, type Dibujo } from "./comun";

/** Planta en maceta (32 × 56 px). `tipo`: frondosa (redonda) o alta (hojas largas). */
export function dibujarPlanta(tipo: "frondosa" | "alta" = "frondosa"): Dibujo {
  const [c, ctx] = lienzo(32, 56);
  // Maceta.
  px(ctx, 8, 40, 16, 15, P.contorno);
  px(ctx, 9, 41, 14, 13, P.maceta);
  px(ctx, 9, 41, 14, 2, "#e0d3c4");
  px(ctx, 19, 43, 3, 11, "#b3a291");
  if (tipo === "frondosa") {
    circulo(ctx, 16, 26, 13, P.contorno);
    circulo(ctx, 16, 26, 12, P.verdeOscuro);
    circulo(ctx, 13, 23, 8, P.verde);
    circulo(ctx, 20, 28, 6, P.verde);
    for (let i = 0; i < 7; i++) px(ctx, 8 + Math.floor(azar(i, 2) * 16), 16 + Math.floor(azar(2, i) * 18), 2, 2, P.verdeClaro);
  } else {
    // Hojas largas hacia arriba (sansevieria).
    for (let i = 0; i < 6; i++) {
      const x = 9 + i * 3;
      const alto = 22 + Math.floor(azar(i, 5) * 14);
      px(ctx, x - 1, 41 - alto - 1, 4, alto + 1, P.contorno);
      px(ctx, x, 41 - alto, 2, alto, i % 2 ? P.verde : P.verdeOscuro);
      px(ctx, x, 41 - alto, 1, alto, P.verdeClaro);
    }
  }
  return { canvas: c };
}
