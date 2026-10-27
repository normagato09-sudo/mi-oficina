import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { supabase } from "./supabase";
import { MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, MAX_CARACTERES_ENCARGO, TIPOS_ADJUNTO, esTipoAdjunto, type EstadoEncargo } from "./encargos-reglas";
import type { Agente, Edificio } from "./tipos";

export const BUCKET_ENCARGOS = "encargos";

export type AdjuntoImagen = { tipo: "imagen"; nombre: string; ruta: string; ancho: number; alto: number };
export type AdjuntoPdf = { tipo: "pdf"; nombre: string; paginas: number; texto: string };
export type Adjunto = AdjuntoImagen | AdjuntoPdf;

export type Encargo = {
  id: string;
  /** Proyecto del encargo (tabla edificios). */
  edificio_id: string;
  director_id: string;
  texto: string;
  destinos: string[];
  adjuntos: Adjunto[];
  estado: EstadoEncargo;
  /** Los urgentes van primero en la cola (migración 0007). */
  urgente: boolean;
  /** Orden dentro de la cola: menor = antes (migración 0007). */
  orden: number;
  creado_en: string;
  actualizado_en: string;
  // Reparto con la IA (migración 0010; pueden faltar si aún no se ha ejecutado):
  /** Preguntas del Director y mis respuestas. */
  preguntas?: Pregunta[];
  /** Resumen del Director al repartir (o al preguntar). */
  nota_director?: string | null;
  /** Qué ha fallado (p. ej. límite de la IA): el encargo se ve en rojo con "Reintentar". */
  aviso?: string | null;
  /** Cuándo puede continuar la cola con este encargo (null = nadie debe tocarlo). */
  reintentar_en?: string | null;
  /** Hasta cuándo lo está procesando una ejecución. */
  paso_hasta?: string | null;
  reintentos?: number;
};

export type Pregunta = { pregunta: string; respuesta: string | null };

export type EstadoTarea = "pendiente" | "en_curso" | "terminada" | "error";

/** Lo que el Director ha encargado a un agente (migración 0010). */
export type Tarea = {
  id: string;
  encargo_id: string;
  agente_id: string;
  instrucciones: string;
  estado: EstadoTarea;
  resultado: string;
  creado_en: string;
  actualizado_en: string;
};

/** Encargo listo para mostrar: imágenes con URL firmada, el proyecto con nombre y color y a quién se ha repartido. */
export type EncargoVista = Omit<Encargo, "adjuntos"> & {
  adjuntos: ((AdjuntoImagen & { url: string | null }) | (Omit<AdjuntoPdf, "texto"> & { caracteres: number }))[];
  proyecto: { nombre: string; color: string };
  tareas: (Pick<Tarea, "id" | "agente_id" | "instrucciones" | "estado"> & { agente: string })[];
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

/* ───────────── Crear encargos ───────────── */

export type NuevoEncargo = {
  director: Agente;
  proyectoId: string;
  texto: string;
  urgente: boolean;
  subidas: { ruta: string; nombre: string; tipo: string }[];
};

/**
 * Guarda un encargo al final de la cola del Director ("en_cola"): convierte las imágenes,
 * extrae el texto de los PDF y borra los originales subidos.
 */
export async function crearEncargo({ director, proyectoId, texto, urgente, subidas }: NuevoEncargo): Promise<string> {
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
        const ruta = `${proyectoId}/${id}/${++n}.jpg`;
        const { error: e2 } = await almacen.upload(ruta, jpeg, { contentType: "image/jpeg" });
        if (e2) throw new Error(`No se pudo guardar "${subida.nombre}": ${e2.message}`);
        guardadas.push(ruta);
        adjuntos.push({ tipo: "imagen", nombre: subida.nombre, ruta, ancho, alto });
      }
    }

    // El orden lo pone la base de datos: al final de la cola.
    const { error } = await db.from("encargos").insert({
      id,
      edificio_id: proyectoId,
      director_id: director.id,
      texto: textoLimpio,
      adjuntos,
      urgente,
      estado: "en_cola" satisfies EstadoEncargo,
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

/* ───────────── Leer la cola ───────────── */

/** Firma las miniaturas y pone nombre y color al proyecto de cada encargo. */
async function paraMostrar(encargos: Encargo[]): Promise<EncargoVista[]> {
  const db = supabase();
  const rutas = encargos.flatMap((e) => e.adjuntos.flatMap((a) => (a.tipo === "imagen" ? [a.ruta] : [])));
  const idsProyecto = [...new Set(encargos.map((e) => e.edificio_id))];

  const urls = new Map<string, string>();
  if (rutas.length) {
    // Miniaturas: URLs firmadas (el bucket es privado), válidas una hora.
    const { data: firmadas } = await db.storage.from(BUCKET_ENCARGOS).createSignedUrls(rutas, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }
  const { data: proyectos } = idsProyecto.length
    ? await db.from("edificios").select("id, nombre, color").in("id", idsProyecto).returns<Pick<Edificio, "id" | "nombre" | "color">[]>()
    : { data: [] };
  const porId = new Map((proyectos ?? []).map((p) => [p.id, p]));

  // A quién se ha repartido cada encargo (sin la migración 0010 la tabla no existe: sin tareas).
  const { data: tareas } = encargos.length
    ? await db
        .from("tareas")
        .select("id, encargo_id, agente_id, instrucciones, estado, agentes(nombre)")
        .in("encargo_id", encargos.map((e) => e.id))
        .order("creado_en")
        .returns<(Pick<Tarea, "id" | "encargo_id" | "agente_id" | "instrucciones" | "estado"> & { agentes: { nombre: string } | null })[]>()
    : { data: [] };

  return encargos.map((e) => ({
    ...e,
    adjuntos: e.adjuntos.map((a) =>
      a.tipo === "imagen"
        ? { ...a, url: urls.get(a.ruta) ?? null }
        : { tipo: "pdf" as const, nombre: a.nombre, paginas: a.paginas, caracteres: a.texto.length },
    ),
    proyecto: { nombre: porId.get(e.edificio_id)?.nombre ?? "Proyecto", color: porId.get(e.edificio_id)?.color ?? "#8a93ad" },
    tareas: (tareas ?? [])
      .filter((t) => t.encargo_id === e.id)
      .map((t) => ({ id: t.id, agente_id: t.agente_id, instrucciones: t.instrucciones, estado: t.estado, agente: t.agentes?.nombre ?? "Agente" })),
  }));
}

/** La cola del Director en el orden en que se atenderá: urgentes primero y después por orden. */
export async function cargarCola(): Promise<EncargoVista[]> {
  const { data, error } = await supabase()
    .from("encargos")
    .select("*")
    .eq("estado", "en_cola")
    .order("urgente", { ascending: false })
    .order("orden")
    .order("id")
    .returns<Encargo[]>();
  if (error) throw new Error(`No se pudo leer la cola: ${error.message}. ¿Has ejecutado la migración 0007?`);
  return paraMostrar(data ?? []);
}

/** Encargos que el Director tiene entre manos: el que está en curso (o en error) y los que esperan mi respuesta. */
export async function cargarActivos(): Promise<EncargoVista[]> {
  const { data, error } = await supabase()
    .from("encargos")
    .select("*")
    .in("estado", ["en_curso", "error", "esperando_respuesta"] satisfies EstadoEncargo[])
    .order("actualizado_en")
    .returns<Encargo[]>();
  // Sin la migración 0010 estos estados no existen: no hay nada activo.
  if (error) return [];
  return paraMostrar(data ?? []);
}

/** Encargos ya repartidos, terminados o cancelados, del más reciente al más antiguo. */
export async function cargarHistorial(limite = 20): Promise<EncargoVista[]> {
  const { data, error } = await supabase()
    .from("encargos")
    .select("*")
    .not("estado", "in", "(en_cola,en_curso,error,esperando_respuesta)")
    .order("actualizado_en", { ascending: false })
    .limit(limite)
    .returns<Encargo[]>();
  if (error) throw new Error(`No se pudieron leer los encargos: ${error.message}`);
  return paraMostrar(data ?? []);
}

/** Cuántos encargos hay en cola y de qué proyecto es el primero (para la mesa del Director). */
export async function resumenCola(): Promise<{ total: number; primerProyecto: string | null }> {
  const { data, count, error } = await supabase()
    .from("encargos")
    .select("edificio_id", { count: "exact" })
    .eq("estado", "en_cola")
    .order("urgente", { ascending: false })
    .order("orden")
    .order("id")
    .limit(1)
    .returns<{ edificio_id: string }[]>();
  // Sin la migración 0007 no hay cola: la oficina se ve igual, con la bandeja vacía.
  if (error) return { total: 0, primerProyecto: null };
  return { total: count ?? 0, primerProyecto: data?.[0]?.edificio_id ?? null };
}

/** Proyecto del encargo que el Director tiene en curso (el que empezó antes), o null si no hay ninguno. */
export async function proyectoEnCurso(): Promise<string | null> {
  const { data, error } = await supabase()
    .from("encargos")
    .select("edificio_id")
    .eq("estado", "en_curso")
    .order("actualizado_en")
    .limit(1)
    .returns<{ edificio_id: string }[]>();
  if (error) return null;
  return data?.[0]?.edificio_id ?? null;
}

/* ───────────── Cambiar la cola (solo encargos que aún no han empezado) ───────────── */

/** Sube o baja un encargo un puesto, dentro de su grupo (urgentes o normales). */
export async function moverEncargo(id: string, arriba: boolean): Promise<void> {
  const { data, error } = await supabase().rpc("mover_encargo", { p_id: id, p_arriba: arriba });
  if (error) throw new Error(`No se pudo cambiar el orden: ${error.message}`);
  if (data !== true) throw new Error("No se puede mover más.");
}

export async function marcarUrgente(id: string, urgente: boolean): Promise<void> {
  const { data, error } = await supabase()
    .from("encargos")
    .update({ urgente })
    .eq("id", id)
    .eq("estado", "en_cola")
    .select("id");
  if (error) throw new Error(`No se pudo cambiar la urgencia: ${error.message}`);
  if (!data?.length) throw new Error("Este encargo ya no está en la cola.");
}

/** Cancela un encargo que aún no ha empezado. No se borra: queda en el historial. */
export async function cancelarEncargo(id: string): Promise<void> {
  const { data, error } = await supabase()
    .from("encargos")
    .update({ estado: "cancelado" satisfies EstadoEncargo })
    .eq("id", id)
    .eq("estado", "en_cola")
    .select("id");
  if (error) throw new Error(`No se pudo cancelar: ${error.message}`);
  if (!data?.length) throw new Error("Este encargo ya ha empezado o ya no está en la cola.");
}

/* ───────────── Reparto: tareas, respuestas y reintentos ───────────── */

/** Minutos "en curso" sin avanzar a partir de los cuales el encargo se da por atascado ("Reanudar"). */
export const MINUTOS_ATASCADO = 10;

export function estaAtascado(e: Pick<Encargo, "estado" | "actualizado_en" | "reintentar_en">): boolean {
  return e.estado === "en_curso" && !e.reintentar_en && Date.now() - Date.parse(e.actualizado_en) > MINUTOS_ATASCADO * 60_000;
}

export type TareaVista = Pick<Tarea, "id" | "instrucciones" | "creado_en"> & { encargo: EncargoVista };

/** Tareas pendientes de un agente, de la más antigua a la más reciente, con el proyecto y los adjuntos de su encargo. */
export async function cargarTareasPendientes(agenteId: string): Promise<TareaVista[]> {
  const db = supabase();
  const { data: tareas, error } = await db
    .from("tareas")
    .select("*")
    .eq("agente_id", agenteId)
    .eq("estado", "pendiente" satisfies EstadoTarea)
    .order("creado_en")
    .returns<Tarea[]>();
  if (error) throw new Error(`No se pudieron leer las tareas: ${error.message}. ¿Has ejecutado la migración 0010?`);
  if (!tareas?.length) return [];

  const { data: encargos, error: e2 } = await db
    .from("encargos")
    .select("*")
    .in("id", [...new Set(tareas.map((t) => t.encargo_id))])
    .returns<Encargo[]>();
  if (e2) throw new Error(`No se pudieron leer los encargos: ${e2.message}`);
  const porId = new Map((await paraMostrar(encargos ?? [])).map((e) => [e.id, e]));
  return tareas.flatMap((t) => {
    const encargo = porId.get(t.encargo_id);
    return encargo ? [{ id: t.id, instrucciones: t.instrucciones, creado_en: t.creado_en, encargo }] : [];
  });
}

/**
 * Mi respuesta a la pregunta del Director: el encargo vuelve a la cola, el primero de su grupo
 * (urgentes o normales), para que vuelva a decidir con el dato que faltaba.
 */
export async function responderPregunta(id: string, respuesta: string): Promise<void> {
  const texto = respuesta.replace(/\r\n/g, "\n").trim();
  if (!texto) throw new Error("Escribe tu respuesta.");
  if (texto.length > MAX_CARACTERES_ENCARGO) throw new Error(`Máximo ${MAX_CARACTERES_ENCARGO.toLocaleString("es-ES")} caracteres.`);

  const db = supabase();
  const { data: encargo, error } = await db
    .from("encargos")
    .select("*")
    .eq("id", id)
    .eq("estado", "esperando_respuesta" satisfies EstadoEncargo)
    .maybeSingle<Encargo>();
  if (error) throw new Error(`No se pudo leer el encargo: ${error.message}`);
  if (!encargo) throw new Error("Este encargo ya no está esperando respuesta.");

  const preguntas = [...(encargo.preguntas ?? [])];
  const ultima = preguntas.at(-1);
  if (ultima && ultima.respuesta === null) preguntas[preguntas.length - 1] = { ...ultima, respuesta: texto };
  else preguntas.push({ pregunta: "(sin pregunta)", respuesta: texto });

  const { data: primero } = await db
    .from("encargos")
    .select("orden")
    .eq("estado", "en_cola" satisfies EstadoEncargo)
    .eq("urgente", encargo.urgente)
    .order("orden")
    .limit(1)
    .returns<{ orden: number }[]>();
  const orden = Math.min(primero?.[0]?.orden ?? encargo.orden, encargo.orden) - 1;

  const { data, error: e2 } = await db
    .from("encargos")
    .update({ preguntas, orden, estado: "en_cola" satisfies EstadoEncargo })
    .eq("id", id)
    .eq("estado", "esperando_respuesta" satisfies EstadoEncargo)
    .select("id");
  if (e2) throw new Error(`No se pudo guardar la respuesta: ${e2.message}`);
  if (!data?.length) throw new Error("Este encargo ya no está esperando respuesta.");
}

/** "Reintentar" (encargo en error) o "Reanudar" (atascado en curso): el Director vuelve a empezar con él. */
export async function reanudarEncargo(id: string): Promise<void> {
  const db = supabase();
  const { data: encargo, error } = await db.from("encargos").select("*").eq("id", id).maybeSingle<Encargo>();
  if (error) throw new Error(`No se pudo leer el encargo: ${error.message}`);
  if (!encargo || !(encargo.estado === "error" || estaAtascado(encargo))) {
    throw new Error("Este encargo ya no necesita reintentarse.");
  }
  const { error: e2 } = await db
    .from("encargos")
    .update({
      estado: "en_curso" satisfies EstadoEncargo,
      reintentar_en: new Date().toISOString(),
      paso_hasta: null,
      reintentos: 0,
      aviso: null,
    })
    .eq("id", id)
    .eq("estado", encargo.estado);
  if (e2) throw new Error(`No se pudo reanudar: ${e2.message}`);
}

/** El Director de la oficina (activo y en su despacho), o null si `agenteId` no lo es. */
export async function cargarDirector(agenteId: string): Promise<Agente | null> {
  const { data } = await supabase()
    .from("agentes")
    .select("*")
    .eq("id", agenteId)
    .eq("tipo", "direccion")
    .eq("despacho", "direccion")
    .maybeSingle<Agente>();
  return data && data.activo !== false ? data : null;
}
