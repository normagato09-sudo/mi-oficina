import { P, T, azar, px, tono, type Ctx } from "./comun";

export type TipoSuelo = "moqueta" | "madera" | "marmol" | "baldosa";

/** Una casilla de suelo de 32 px en (ox, oy). `cx`, `cy`: casilla (para que el dibujo varíe sin repetirse). */
export function pintarSuelo(ctx: Ctx, ox: number, oy: number, tipo: TipoSuelo, color: string, cx: number, cy: number) {
  switch (tipo) {
    case "moqueta": {
      // Losetas de moqueta de 32 px, alternando la dirección del tejido.
      px(ctx, ox, oy, T, T, color);
      const vertical = (cx + cy) % 2 === 0;
      for (let i = 2; i < T; i += 4) {
        if (vertical) px(ctx, ox + i, oy + 1, 1, T - 2, tono(color, -0.05));
        else px(ctx, ox + 1, oy + i, T - 2, 1, tono(color, -0.05));
      }
      for (let i = 0; i < 10; i++) px(ctx, ox + Math.floor(azar(cx, cy, i) * 31), oy + Math.floor(azar(cy, cx, i) * 31), 1, 1, tono(color, 0.07));
      px(ctx, ox, oy + T - 1, T, 1, tono(color, -0.1));
      px(ctx, ox + T - 1, oy, 1, T, tono(color, -0.1));
      break;
    }
    case "madera": {
      // Tarima: tablas horizontales de 8 px con juntas escalonadas.
      for (let f = 0; f < 4; f++) {
        const y = oy + f * 8;
        px(ctx, ox, y, T, 8, tono(color, (azar(cx, cy * 4 + f) - 0.5) * 0.1));
        px(ctx, ox, y + 7, T, 1, tono(color, -0.2));
        px(ctx, ox + Math.floor(azar(cx, cy, f) * 24) + 4, y + 2, 6, 1, tono(color, 0.08));
        if ((cx * 2 + f) % 3 === 0) px(ctx, ox + ((f * 11) % 28) + 2, y, 1, 7, tono(color, -0.18));
      }
      break;
    }
    case "marmol": {
      px(ctx, ox, oy, T, T, (cx + cy) % 2 === 0 ? color : tono(color, -0.06));
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(azar(cx, cy, i) * 26);
        const y = Math.floor(azar(cy, cx, i) * 26);
        px(ctx, ox + x, oy + y, 6, 1, tono(color, -0.12));
        px(ctx, ox + x + 5, oy + y + 1, 4, 1, tono(color, -0.12));
      }
      px(ctx, ox, oy + T - 1, T, 1, tono(color, -0.15));
      px(ctx, ox + T - 1, oy, 1, T, tono(color, -0.15));
      px(ctx, ox + 2, oy + 2, 8, 1, tono(color, 0.3));
      break;
    }
    case "baldosa": {
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          px(ctx, ox + i * 16, oy + j * 16, 16, 16, tono(color, (azar(cx * 2 + i, cy * 2 + j) - 0.5) * 0.06));
          px(ctx, ox + i * 16, oy + j * 16 + 15, 16, 1, tono(color, -0.15));
          px(ctx, ox + i * 16 + 15, oy + j * 16, 1, 16, tono(color, -0.15));
        }
      break;
    }
  }
}

/** Luz de techo: un círculo de luz suave en el suelo. */
export function pintarLuzTecho(ctx: Ctx, cx: number, cy: number, radio: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radio);
  g.addColorStop(0, "rgba(255, 244, 214, 0.16)");
  g.addColorStop(1, "rgba(255, 244, 214, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - radio, cy - radio, radio * 2, radio * 2);
  ctx.restore();
}

/** Luz que entra por los ventanales (franja que se desvanece hacia dentro). */
export function pintarLuzVentanal(ctx: Ctx, x: number, y: number, w: number, alto: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, y, 0, y + alto);
  g.addColorStop(0, "rgba(220, 238, 255, 0.18)");
  g.addColorStop(1, "rgba(220, 238, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, alto);
  ctx.restore();
}

/** Sombra suave que deja un muro sobre el suelo de debajo. */
export function pintarSombraMuro(ctx: Ctx, x: number, y: number, w: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + 10);
  g.addColorStop(0, "rgba(30, 24, 40, 0.25)");
  g.addColorStop(1, "rgba(30, 24, 40, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 10);
}
