import { P, tono, type Ctx } from "./comun";

/** Alfombra con borde (se pinta directamente en el suelo). */
export function pintarAlfombra(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = tono(color, -0.25);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = tono(color, 0.2);
  ctx.fillRect(x + 8, y + 8, w - 16, 2);
  ctx.fillRect(x + 8, y + h - 10, w - 16, 2);
  ctx.fillStyle = P.sombra;
  ctx.fillRect(x, y + h, w, 2);
}
