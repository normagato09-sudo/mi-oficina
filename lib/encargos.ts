import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { supabase } from "./supabase";
import { MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, MAX_CARACTERES_ENCARGO, TIPOS_ADJUNTO, esTipoAdjunto, type EstadoEncargo } from "./encargos-reglas";
import type { Agente } from "./tipos";

export const BUCKET_ENCARGOS = "encargos";

export type AdjuntoImagen = { tipo: "imagen"; nombre: string; ruta: string; ancho: number; alto: number };
export type AdjuntoPdf = { tipo: "pdf"; nombre: string; paginas: number; texto: string };
export type Adjunto = AdjuntoImagen | AdjuntoPdf;

export type Encargo = {
  id: string;
  edificio_id: string;
  director_id: string;
  texto: string;
  destinos: string[];
  adjuntos: Adjunto[];
  estado: EstadoEncargo;
  creado_en: string;
  actualizado_en: string;
};

/** Encargo listo para mostrar: imágenes con URL firmada y destinos con nombre. */
export type EncargoVista = Omit<Encargo, "adjuntos"> & {
  adjuntos: ((AdjuntoImagen & { url: string | null }) | (Omit<AdjuntoPdf, "texto"> & { caracteres: number }))[];
  nombresDestinos: string[];
};

/* ───────────── Imágenes y PDF ───────────── */

const ANCHO_MAX = 1080;
const PROPORCION_MIN = 4 / 5; // vertical: 4:5
const PROPORCION_MAX = 1.91; // horizontal: 1.91:1
/** Límite de texto que se guarda de cada PDF (de sobra para un currículum o un dossier). */
const MAX_CARACTERES_PDF = 60_000;

/**
 * Convierte una imagen a JPEG para redes: máx. 1080 px de ancho y proporción
 * entre 4:5 y 1.91:1, recortando al centro si hace falta.
 */
export async function procesarImagen(original: Buffer): Promise<{ jpeg: Buffer; ancho: number; alto: number }> {
  // rotate() sin argumentos aplica la orientación EXIF (fotos de móvil) antes de medir.
  const girada = await sharp(original, { failOn: "error" }).rotate().toBuffer({ resolveWithObject: true });
  let { width: ancho, height: alto } = girada.info;
  let recorte: { left: number; top: number; width: number; height: number } | null = null;

  const proporcion = ancho / alto;
  if (proporcion < PROPORCION_MIN) {
    const nuevoAlto = Math.round(ancho / PROPORCION_MIN);
    recorte = { left: 0, top: Math.round((alto - nuevoAlto) / 2), width: ancho, height: nuevoAlto };
  } else if (proporcion > PROPORCION_MAX) {
    const nuevoAncho = Math.round(alto * PROPORCION_MAX);
    recorte = { left: Math.round((ancho - nuevoAncho) / 2), top: 0, width: nuevoAncho, height: alto };
  }

  let imagen = sharp(girada.data);
  if (recorte) {
    imagen = imagen.extract(recorte);
    ancho = recorte.width;
    alto = recorte.height;
  }
  const { data, info } = await imagen
    .resize({ width: Math.min(ancho, ANCHO_MAX), withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // PNG/WEBP con transparencia → fondo blanco
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, ancho: info.width, alto: info.height };
}

/** Extrae el texto de un PDF (todas las páginas, unidas). */
export async function extraerTextoPdf(pdf: Buffer): Promise<{ texto: string; paginas: number }> {
  const documento = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(documento, { mergePages: true });
  const limpio = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { texto: limpio.slice(0, MAX_CARACTERES_PDF), paginas: totalPages };
}

/* ───────────── Subidas directas del navegador a Storage ───────────── */

export type ArchivoPedido = { nombre: string; tipo: string; bytes: number };
export type SubidaPreparada = { ruta: string; url: string; nombre: string; tipo: string };

const RUTA_SUBIDA = /^subidas\/[0-9a-f-]{36}\/\d{1,2}\.(jpg|png|webp|pdf)$/;

/**
 * Crea una URL firmada por archivo para que el navegador suba el original directamente
 * a Storage (así no pasa por el servidor, que en Vercel solo admite 4,5 MB por petición).
 */
export async function prepararSubidas(archivos: ArchivoPedido[]): Promise<SubidaPreparada[]> {
  if (archivos.length > MAX_ADJUNTOS) throw new Error(`Como máximo ${MAX_ADJUNTOS} archivos por encargo.`);
  const carpeta = `subidas/${randomUUID()}`;
  const almacen = supabase().storage.from(BUCKET_ENCARGOS);

  return Promise.all(
    archivos.map(async (archivo, i) => {
      if (!esTipoAdjunto(archivo.tipo)) throw new Error(`"${archivo.nombre}" no es una imagen JPEG/PNG/WEBP ni un PDF.`);
      if (archivo.bytes > MAX_BYTES_ADJUNTO) throw new Error(`"${archivo.nombre}" pesa más de 20 MB.`);
      const ruta = `${carpeta}/${i}.${TIPOS_ADJUNTO[archivo.tipo]}`;
      const { data, error } = await almacen.createSignedUploadUrl(ruta);
      if (error) throw new Error(`No se pudo preparar la subida: ${error.message}`);
      return { ruta, url: data.signedUrl, nombre: archivo.nombre.slice(0, 200), tipo: archivo.tipo };
    }),
  );
}

/* ───────────── Crear y leer encargos ───────────── */

export type NuevoEncargo = {
  director: Agente & { edificio_id: string };
  texto: string;
  destinos: string[];
  subidas: { ruta: string; nombre: string; tipo: string }[];
};

/**
 * Guarda un encargo en estado "recibido": convierte las imágenes, extrae el texto de los PDF
 * y borra los originales subidos.
 */
export async function crearEncargo({ director, texto, destinos, subidas }: NuevoEncargo): Promise<string> {
  const textoLimpio = texto.replace(/\r\n/g, "\n").trim();
  if (!textoLimpio && !subidas.length) throw new Error("Escribe el encargo o adjunta algún archivo.");
  if (textoLimpio.length > MAX_CARACTERES_ENCARGO) throw new Error(`Máximo ${MAX_CARACTERES_ENCARGO.toLocaleString("es-ES")} caracteres.`);
  if (subidas.length > MAX_ADJUNTOS) throw new Error(`Como máximo ${MAX_ADJUNTOS} archivos por encargo.`);
  for (const s of subidas) {
    if (!RUTA_SUBIDA.test(s.ruta) || !esTipoAdjunto(s.tipo)) throw new Error("Adjunto no válido.");
  }

  const db = supabase();
  const almacen = db.storage.from(BUCKET_ENCARGOS);
  const id = randomUUID();
  const guardadas: string[] = [];

  try {
    const adjuntos: Adjunto[] = [];
    let n = 0;
    for (const subida of subidas) {
      const { data: blob, error } = await almacen.download(subida.ruta);
      if (error || !blob) throw new Error(`No se encontró "${subida.nombre}". Vuelve a adjuntarlo.`);
      const original = Buffer.from(await blob.arrayBuffer());

      if (subida.tipo === "application/pdf") {
        const { texto: textoPdf, paginas } = await extraerTextoPdf(original).catch(() => {
          throw new Error(`No se pudo leer el PDF "${subida.nombre}". ¿Está protegido o dañado?`);
        });
        adjuntos.push({ tipo: "pdf", nombre: subida.nombre, paginas, texto: textoPdf });
      } else {
        const { jpeg, ancho, alto } = await procesarImagen(original).catch(() => {
          throw new Error(`No se pudo leer la imagen "${subida.nombre}".`);
        });
        const ruta = `${director.edificio_id}/${id}/${++n}.jpg`;
        const { error: e2 } = await almacen.upload(ruta, jpeg, { contentType: "image/jpeg" });
        if (e2) throw new Error(`No se pudo guardar "${subida.nombre}": ${e2.message}`);
        guardadas.push(ruta);
        adjuntos.push({ tipo: "imagen", nombre: subida.nombre, ruta, ancho, alto });
      }
    }

    const { error } = await db.from("encargos").insert({
      id,
      edificio_id: director.edificio_id,
      director_id: director.id,
      texto: textoLimpio,
      destinos,
      adjuntos,
      estado: "recibido" satisfies EstadoEncargo,
    });
    if (error) throw new Error(`No se pudo guardar el encargo: ${error.message}`);
  } catch (e) {
    if (guardadas.length) await almacen.remove(guardadas);
    throw e;
  } finally {
    // Los originales ya no hacen falta (ni si ha ido bien ni si ha fallado).
    if (subidas.length) await almacen.remove(subidas.map((s) => s.ruta));
  }
  return id;
}

/** Historial de encargos de un Director, del más reciente al más antiguo. */
export async function cargarEncargos(directorId: string, nombres: Map<string, string>, limite = 30): Promise<EncargoVista[]> {
  const db = supabase();
  const { data, error } = await db
    .from("encargos")
    .select("*")
    .eq("director_id", directorId)
    .order("creado_en", { ascending: false })
    .limit(limite)
    .returns<Encargo[]>();
  if (error) throw new Error(`No se pudieron leer los encargos: ${error.message}`);
  const encargos = data ?? [];

  // Miniaturas: URLs firmadas (el bucket es privado), válidas una hora.
  const rutas = encargos.flatMap((e) => e.adjuntos.flatMap((a) => (a.tipo === "imagen" ? [a.ruta] : [])));
  const urls = new Map<string, string>();
  if (rutas.length) {
    const { data: firmadas } = await db.storage.from(BUCKET_ENCARGOS).createSignedUrls(rutas, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  return encargos.map((e) => ({
    ...e,
    adjuntos: e.adjuntos.map((a) =>
      a.tipo === "imagen"
        ? { ...a, url: urls.get(a.ruta) ?? null }
        : { tipo: "pdf" as const, nombre: a.nombre, paginas: a.paginas, caracteres: a.texto.length },
    ),
    nombresDestinos: e.destinos.map((d) => nombres.get(d) ?? "Agente"),
  }));
}

/**
 * El Director de un edificio y los agentes de redes activos a los que puede mandar publicar.
 * Devuelve null si el agente no existe o no es un Director.
 */
export async function cargarDirector(agenteId: string): Promise<{
  director: Agente & { edificio_id: string };
  redes: { id: string; nombre: string }[];
} | null> {
  const db = supabase();
  const { data: director } = await db
    .from("agentes")
    .select("*, departamentos!inner(edificio_id)")
    .eq("id", agenteId)
    .eq("tipo", "direccion")
    .maybeSingle<Agente & { departamentos: { edificio_id: string } }>();
  if (!director) return null;
  const { departamentos, ...resto } = director;

  const { data: redes } = await db
    .from("agentes")
    .select("id, nombre, activo, departamentos!inner(edificio_id)")
    .eq("tipo", "redes")
    .eq("departamentos.edificio_id", departamentos.edificio_id)
    .order("creado_en")
    .returns<{ id: string; nombre: string; activo?: boolean }[]>();

  return {
    director: { ...resto, edificio_id: departamentos.edificio_id },
    redes: (redes ?? []).filter((r) => r.activo !== false).map((r) => ({ id: r.id, nombre: r.nombre })),
  };
}
