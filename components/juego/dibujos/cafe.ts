import { P, lienzo, px, tono, type Dibujo } from "./comun";

/** Encimera de la zona de café, `casillas` de ancho (alto 56 px): cafetera, tazas, fruta y fregadero. */
export function dibujarEncimeraCafe(casillas: number): Dibujo {
  const w = casillas * 32;
  const [c, ctx] = lienzo(w, 56);
  // Mueble bajo.
  px(ctx, 0, 24, w, 32, P.contorno);
  px(ctx, 1, 34, w - 2, 21, P.blanco);
  for (let i = 0; i < casillas; i++) {
    px(ctx, i * 32 + 2, 36, 28, 18, P.blancoSombra);
    px(ctx, i * 32 + 13, 40, 6, 2, P.metalOscuro);
  }
  // Encimera.
  px(ctx, 1, 25, w - 2, 9, "#5d6270");
  px(ctx, 1, 25, w - 2, 2, "#7d8291");
  // Cafetera.
  px(ctx, 6, 2, 20, 26, P.contorno);
  px(ctx, 7, 3, 18, 24, P.negro);
  px(ctx, 9, 5, 14, 5, "#4a4f5c");
  px(ctx, 10, 13, 12, 8, "#1d1f27");
  px(ctx, 13, 17, 6, 6, "#ffffff");
  px(ctx, 13, 17, 6, 2, "#7a4a2a");
  px(ctx, 21, 6, 2, 2, P.rojo);
  // Tazas.
  for (let i = 0; i < 3; i++) {
    px(ctx, 32 + i * 9, 18, 7, 8, P.contorno);
    px(ctx, 33 + i * 9, 19, 5, 6, ["#ffffff", P.amarillo, "#4f9ad6"][i]!);
  }
  // Frutero o fregadero.
  if (casillas >= 3) {
    px(ctx, 64, 14, 22, 12, P.contorno);
    px(ctx, 65, 15, 20, 10, "#e8e1d4");
    px(ctx, 67, 12, 6, 6, "#e05a5a");
    px(ctx, 73, 11, 6, 6, P.amarillo);
    px(ctx, 78, 13, 6, 6, "#79bf6f");
  }
  if (casillas >= 4) {
    px(ctx, w - 30, 26, 22, 6, tono("#5d6270", -0.3));
    px(ctx, w - 21, 16, 3, 10, P.metal);
  }
  return { canvas: c };
}
