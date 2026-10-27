import "server-only";
import { BUCKET_ENCARGOS, type Encargo } from "./encargos";
import { IAError, LimiteIAError, MENSAJE_LIMITE, type ImagenIA } from "./ia";
import { supabase } from "./supabase";

/**
 * Lo común a cada paso de la cola (el Director decide, un agente trabaja, el Director revisa):
 * tiempos de cada ejecución, el reintento por límite de Groq y lo que se le enseña a la IA del encargo.
 */

/** Tiempo útil de cada ejecución (maxDuration = 60 s, con margen para guardar). */
export const PRESUPUESTO_MS = 50_000;
/** Si ya se ha gastado esto, no se empieza otra llamada a la IA en esta ejecución. */
export const MAX_PARA_EMPEZAR_MS = 25_000;
/** Lo que se tarda, como mucho, en una llamada a la IA (para decidir si cabe esperar y reintentar). */
const DURACION_LLAMADA_MS = 20_000;
/** Mientras una ejecución procesa un paso, nadie más lo toca (y si se corta, deja de valer). */
export const DURACION_PASO_S = 70;
/** Diferencia de reloj tolerada entre este servidor y la base de datos. */
export const MARGEN_RELOJ_MS = 5_000;
const MAX_IMAGENES = 3;
/** Texto de los PDF que se le pasa a la IA (la cuenta gratuita de Groq admite 8.000 tokens por minuto). */
const MAX_CARACTERES_PDF = 6_000;

export const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "Ahora" con el margen de reloj (para comparar con fechas que pone la base de datos). */
export const ahoraConMargen = () => new Date(Date.now() + MARGEN_RELOJ_MS).toISOString();
/** Hasta cuándo es suyo un paso que se acaba de tomar. */
export const pasoHasta = () => new Date(Date.now() + DURACION_PASO_S * 1000).toISOString();

export const ENCADENADO = Symbol("encadenado");

/**
 * Límite de Groq con poca espera (menos de 60 s): espera y reintenta una sola vez, aquí mismo si
 * cabe en esta ejecución o, si no, deja el paso preparado para la siguiente (`encadenar`).
 * Con más espera, o si vuelve a fallar, lanza el error.
 */
export async function conReintento<T>(
  llamar: () => Promise<T>,
  { reintentos, inicio, encadenar }: { reintentos: number; inicio: number; encadenar: (reintentarEn: string) => Promise<void> },
): Promise<T | typeof ENCADENADO> {
  try {
    return await llamar();
  } catch (e) {
    const espera = e instanceof LimiteIAError ? e.reintentarEnSegundos : undefined;
    if (espera === undefined || espera >= 60 || reintentos >= 1) throw e;
    if (Date.now() - inicio + espera * 1000 + DURACION_LLAMADA_MS < PRESUPUESTO_MS) {
      await dormir(espera * 1000 + 500);
      return await llamar();
    }
    // + el margen de reloj: así no se toma antes de que Groq deje volver a llamar.
    await encadenar(new Date(Date.now() + espera * 1000 + 500 + MARGEN_RELOJ_MS).toISOString());
    return ENCADENADO;
  }
}

/** Texto legible de un fallo para guardarlo como aviso (rojo, "Reintentar"). */
export function avisoDeError(e: unknown): string {
  if (e instanceof LimiteIAError) {
    return `${MENSAJE_LIMITE}${e.reintentarEnSegundos ? ` (Groq pide esperar ${Math.ceil(e.reintentarEnSegundos / 60)} min)` : ""}.`;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Hasta 3 imágenes adjuntas, en base64, para que la IA las vea. */
export async function cargarImagenes(encargo: Pick<Encargo, "adjuntos">): Promise<ImagenIA[]> {
  const rutas = encargo.adjuntos.flatMap((a) => (a.tipo === "imagen" ? [a.ruta] : [])).slice(0, MAX_IMAGENES);
  const almacen = supabase().storage.from(BUCKET_ENCARGOS);
  return Promise.all(
    rutas.map(async (ruta) => {
      const { data, error } = await almacen.download(ruta);
      if (error || !data) throw new IAError(`No se pudo leer una imagen adjunta: ${error?.message ?? ruta}`);
      return { tipo: "image/jpeg" as const, base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
    }),
  );
}

/** El encargo como lo lee la IA: su texto, el de los PDF (recortado) y cuántas imágenes lleva. */
export function textoEncargo(encargo: Pick<Encargo, "texto" | "adjuntos">, imagenesEnviadas: number, maxPdf = MAX_CARACTERES_PDF): string {
  const partes = [encargo.texto.trim() || "(sin texto: mira los adjuntos)"];
  let restante = maxPdf;
  for (const pdf of encargo.adjuntos.flatMap((a) => (a.tipo === "pdf" ? [a] : []))) {
    const texto = pdf.texto.slice(0, Math.max(0, restante));
    restante -= texto.length;
    partes.push(`PDF adjunto "${pdf.nombre}" (${pdf.paginas} págs.)${texto.length < pdf.texto.length ? ", recortado" : ""}:\n${texto || "(sin texto legible)"}`);
  }
  const total = encargo.adjuntos.filter((a) => a.tipo === "imagen").length;
  if (total) {
    partes.push(
      `Imágenes adjuntas: ${total}, numeradas desde 0${imagenesEnviadas < total ? ` (te envío las ${imagenesEnviadas} primeras)` : imagenesEnviadas ? " (te las envío en ese orden)" : ""}.`,
    );
  }
  return partes.join("\n\n");
}
