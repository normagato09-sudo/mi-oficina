import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Módulo único de IA: todo el código llama a la IA a través de aquí.
 *
 * El proveedor se elige con IA_PROVEEDOR ("groq" por defecto, o "anthropic").
 * - Groq: GROQ_API_KEY. Modelos con IA_MODELO (texto) e IA_MODELO_VISION (con imágenes).
 * - Anthropic: ANTHROPIC_API_KEY. Modelo con IA_MODELO (sirve para texto e imágenes).
 */

export type Proveedor = "groq" | "anthropic";

/** Imagen en base64 (sin el prefijo data:). */
export type ImagenIA = {
  tipo: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
};

export type PeticionIA = {
  /** Instrucciones del agente + ficha de su proyecto. */
  sistema: string;
  mensaje: string;
  imagenes?: ImagenIA[];
  maxTokens?: number;
};

/** Esquema JSON en modo estricto: todas las propiedades en `required` y `additionalProperties: false`. */
export type EsquemaJSON = { [clave: string]: unknown };

export const MENSAJE_LIMITE = "Límite gratuito alcanzado, vuelve a intentarlo más tarde";

/** El proveedor ha rechazado la petición por límite de uso (429). */
export class LimiteIAError extends Error {
  constructor(public readonly reintentarEnSegundos?: number) {
    super(MENSAJE_LIMITE);
    this.name = "LimiteIAError";
  }
}

/** Cualquier otro fallo de la IA, con un mensaje legible. */
export class IAError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "IAError";
  }
}

// Groq: mejor modelo gratuito de producción con tool calling y salidas estructuradas estrictas,
// y el modelo con visión que también admite salidas estrictas (está en "preview").
const GROQ_MODELO = "openai/gpt-oss-120b";
const GROQ_MODELO_VISION = "qwen/qwen3.8-27b";
const GROQ_MAX_IMAGENES = 3;
// La cuenta gratuita de Groq admite 8.000 tokens por minuto (entrada + salida) por modelo.
const GROQ_MAX_TOKENS = 4096;
const ANTHROPIC_MODELO = "claude-opus-5-5";

export function proveedorIA(): Proveedor {
  return process.env.IA_PROVEEDOR?.trim().toLowerCase() === "anthropic" ? "anthropic" : "groq";
}

/** Modelo que se usará para esta petición (útil para mostrarlo o registrarlo). */
export function modeloIA(conImagenes = false): string {
  if (proveedorIA() === "anthropic") return process.env.IA_MODELO?.trim() || ANTHROPIC_MODELO;
  return conImagenes
    ? process.env.IA_MODELO_VISION?.trim() || GROQ_MODELO_VISION
    : process.env.IA_MODELO?.trim() || GROQ_MODELO;
}

/** Respuesta en texto libre. */
export async function generarTexto(peticion: PeticionIA): Promise<string> {
  return proveedorIA() === "anthropic" ? anthropicTexto(peticion) : groqTexto(peticion);
}

/**
 * Respuesta estructurada: la IA devuelve un objeto que cumple `esquema` (modo estricto).
 * `nombre` identifica el formato (letras, números y guiones bajos).
 */
export async function generarEstructurado<T>(peticion: PeticionIA & { nombre: string; esquema: EsquemaJSON }): Promise<T> {
  const texto = proveedorIA() === "anthropic" ? await anthropicEstructurado(peticion) : await groqEstructurado(peticion);
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new IAError("La IA devolvió una respuesta que no es JSON válido.");
  }
}

/* ───────────── Groq (API compatible con OpenAI) ───────────── */

type MensajeGroq = { role: "system" | "user"; content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] };

function mensajesGroq({ sistema, mensaje, imagenes = [] }: PeticionIA): MensajeGroq[] {
  if (imagenes.length > GROQ_MAX_IMAGENES) {
    throw new IAError(`Con Groq se pueden enviar como máximo ${GROQ_MAX_IMAGENES} imágenes por petición.`);
  }
  const usuario: MensajeGroq = imagenes.length
    ? {
        role: "user",
        content: [
          { type: "text", text: mensaje },
          ...imagenes.map((img) => ({ type: "image_url" as const, image_url: { url: `data:${img.tipo};base64,${img.base64}` } })),
        ],
      }
    : { role: "user", content: mensaje };
  return [{ role: "system", content: sistema }, usuario];
}

async function llamarGroq(cuerpo: Record<string, unknown>): Promise<string> {
  const clave = process.env.GROQ_API_KEY;
  if (!clave) throw new IAError("Falta GROQ_API_KEY en las variables de entorno.");

  const respuesta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });

  if (!respuesta.ok) {
    const error = (await respuesta.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    // 413: esta petición sola ya supera el límite por minuto; esperar no lo arregla.
    if (respuesta.status === 413) {
      throw new IAError("El encargo es demasiado largo para el límite gratuito de Groq. Acórtalo o divídelo en partes.");
    }
    if (respuesta.status === 429 || error?.error?.code === "rate_limit_exceeded") {
      const espera = Number(respuesta.headers.get("retry-after"));
      throw new LimiteIAError(Number.isFinite(espera) && espera > 0 ? espera : undefined);
    }
    throw new IAError(`Groq respondió ${respuesta.status}: ${error?.error?.message ?? respuesta.statusText}`);
  }

  const datos = (await respuesta.json()) as { choices?: { message?: { content?: string | null } ; finish_reason?: string }[] };
  const eleccion = datos.choices?.[0];
  const contenido = eleccion?.message?.content;
  if (!contenido) throw new IAError("Groq no devolvió ninguna respuesta.");
  if (eleccion.finish_reason === "length") throw new IAError("La respuesta de la IA se cortó por ser demasiado larga.");
  return contenido;
}

function groqTexto(peticion: PeticionIA): Promise<string> {
  return llamarGroq({
    model: modeloIA(Boolean(peticion.imagenes?.length)),
    messages: mensajesGroq(peticion),
    max_completion_tokens: peticion.maxTokens ?? GROQ_MAX_TOKENS,
  });
}

function groqEstructurado(peticion: PeticionIA & { nombre: string; esquema: EsquemaJSON }): Promise<string> {
  return llamarGroq({
    model: modeloIA(Boolean(peticion.imagenes?.length)),
    messages: mensajesGroq(peticion),
    max_completion_tokens: peticion.maxTokens ?? GROQ_MAX_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: { name: peticion.nombre, strict: true, schema: peticion.esquema },
    },
  });
}

/* ───────────── Anthropic (SDK oficial) ───────────── */

let clienteAnthropic: Anthropic | null = null;

function anthropic(): Anthropic {
  clienteAnthropic ??= new Anthropic();
  return clienteAnthropic;
}

async function llamarAnthropic(peticion: PeticionIA, esquema?: EsquemaJSON): Promise<string> {
  const { sistema, mensaje, imagenes = [] } = peticion;
  try {
    const respuesta = await anthropic().beta.messages.create({
      model: modeloIA(Boolean(imagenes.length)),
      max_tokens: peticion.maxTokens ?? 16000,
      // Si el modelo rechaza la petición, la API la reintenta sola con otro modelo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: sistema,
      messages: [
        {
          role: "user",
          content: [
            ...imagenes.map((img) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: img.tipo, data: img.base64 },
            })),
            { type: "text" as const, text: mensaje },
          ],
        },
      ],
      ...(esquema ? { output_config: { format: { type: "json_schema" as const, schema: esquema } } } : {}),
    });

    if (respuesta.stop_reason === "refusal") throw new IAError("La IA ha rechazado este encargo.");
    if (respuesta.stop_reason === "max_tokens") throw new IAError("La respuesta de la IA se cortó por ser demasiado larga.");
    const texto = respuesta.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    if (!texto) throw new IAError("Anthropic no devolvió ninguna respuesta.");
    return texto;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      const espera = Number(e.headers?.get("retry-after"));
      throw new LimiteIAError(Number.isFinite(espera) && espera > 0 ? espera : undefined);
    }
    if (e instanceof Anthropic.AuthenticationError) throw new IAError("La clave de Anthropic no es válida.");
    if (e instanceof Anthropic.APIError) throw new IAError(`Anthropic respondió ${e.status}: ${e.message}`);
    throw e;
  }
}

function anthropicTexto(peticion: PeticionIA): Promise<string> {
  return llamarAnthropic(peticion);
}

function anthropicEstructurado(peticion: PeticionIA & { esquema: EsquemaJSON }): Promise<string> {
  return llamarAnthropic(peticion, peticion.esquema);
}
