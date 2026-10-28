import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { supabase } from "./supabase";
import { MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, MAX_CARACTERES_ENCARGO, TIPOS_ADJUNTO, esTipoAdjunto, type EstadoEncargo } from "./encargos-reglas";
import type { Resultado } from "./trabajos";
import type { Agente, Edificio } from "./tipos";

export const BUCKET_ENCARGOS = "encargos";

export type AdjuntoImagen = { tipo: "imagen"; nombre: string; ruta: string; ancho: number; alto: number };
export type AdjuntoPdf = { tipo: "pdf"; nombre: string; paginas: number; texto: string };
export type Adjunto = AdjuntoImagen | AdjuntoPdf;

export type Encargo = {
  id: string;
  /** Organización del encargo (tabla edificios). */
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

/**
 * pendiente → en_curso (el agente trabaja) → revision → revisando (el Director revisa)
 *   → revisada (bien, o a la tercera vuelta) → lista (todo el encargo revisado: te necesita)
 *   → aprobada (la CEO la aprueba) | vuelve a pendiente si la CEO pide cambios.
 */
export type EstadoTarea = "pendiente" | "en_curso" | "revision" | "revisando" | "revisada" | "lista" | "aprobada" | "error";

/** Lo que el Director ha encargado a un agente (migración 0010). */
export type Tarea = {
  id: string;
  encargo_id: string;
  agente_id: string;
  instrucciones: string;
  estado: EstadoTarea;
  /** El resultado en texto plano (para revisar y copiar). */
  resultado: string;
  creado_en: string;
  actualizado_en: string;
  // Trabajo y revisión (migración 0011):
  /** Resultado estructurado del agente. */
  resultado_json?: Resultado | null;
  /** Qué ha hecho el agente y por qué. */
  nota_agente?: string | null;
  /** Nota del Director para la CEO (p. ej. si a la tercera vuelta sigue sin estar bien). */
  nota_director?: string | null;
  /** Comentarios del Director para que el agente lo rehaga. */
  comentarios?: string | null;
  /** Veces que el Director se lo ha devuelto. */
  vueltas?: number;
  aviso?: string | null;
  reintentar_en?: string | null;
  paso_hasta?: string | null;
  reintentos?: number;
  // Revisión de la CEO (migración 0012):
  aprobada_en?: string | null;
  /** La versión del agente antes de que la CEO la editara. */
  resultado_agente?: Resultado | null;
  resultado_agente_texto?: string | null;
  /** Texto editado por la CEO cuando el resultado no tiene campos propios (código, informes…). */
  texto_editado?: string | null;
  /** Comentario de la CEO al pedir cambios. */
  comentario_ceo?: string | null;
};

/** Encargo listo para mostrar: imágenes con URL firmada, el proyecto con nombre y color y a quién se ha repartido. */
export type EncargoVista = Omit<Encargo, "adjuntos"> & {
  adjuntos: ((AdjuntoImagen & { url: string | null }) | (Omit<AdjuntoPdf, "texto"> & { caracteres: number }))[];
  /** El proyecto, con los datos de su cartel (para montar los carteles del Diseñador). */
  proyecto: { nombre: string; color: string; colorSecundario: string; letrero: string; letreroSecundario: string | null };
  tareas: (Pick<Tarea, "id" | "agente_id" | "instrucciones" | "estado" | "aviso" | "paso_hasta" | "actualizado_en"> & { agente: string })[];
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

/**
 * Columnas de un encargo para mostrarlo: con su proyecto y sus tareas en la MISMA consulta
 * (joins de PostgREST), para no hacer más viajes a la base de datos.
 */
const SELECT_VISTA =
  "*, edificios(nombre, color, color_secundario, letrero, letrero_secundario), tareas(id, agente_id, instrucciones, estado, aviso, paso_hasta, creado_en, actualizado_en, agentes(nombre))";

type FilaVista = Encargo & {
  edificios: Pick<Edificio, "nombre" | "color" | "color_secundario" | "letrero" | "letrero_secundario"> | null;
  tareas:
    | (Pick<Tarea, "id" | "agente_id" | "instrucciones" | "estado" | "aviso" | "paso_hasta" | "creado_en" | "actualizado_en"> & {
        agentes: { nombre: string } | null;
      })[]
    | null;
};

/** Firma las miniaturas (una sola petición, solo si hay imágenes) y da forma a cada encargo. */
async function paraMostrar(encargos: FilaVista[]): Promise<EncargoVista[]> {
  const rutas = encargos.flatMap((e) => e.adjuntos.flatMap((a) => (a.tipo === "imagen" ? [a.ruta] : [])));
  const urls = new Map<string, string>();
  if (rutas.length) {
    // Miniaturas: URLs firmadas (el bucket es privado), válidas una hora.
    const { data: firmadas } = await supabase().storage.from(BUCKET_ENCARGOS).createSignedUrls(rutas, 3600);
    for (const f of firmadas ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  }

  return encargos.map(({ edificios, tareas, ...e }) => ({
    ...e,
    adjuntos: e.adjuntos.map((a) =>
      a.tipo === "imagen"
        ? { ...a, url: urls.get(a.ruta) ?? null }
        : { tipo: "pdf" as const, nombre: a.nombre, paginas: a.paginas, caracteres: a.texto.length },
    ),
    proyecto: {
      nombre: edificios?.nombre ?? "Organización",
      color: edificios?.color ?? "#8a93ad",
      colorSecundario: edificios?.color_secundario || edificios?.color || "#8a93ad",
      letrero: edificios?.letrero || edificios?.nombre || "Organización",
      letreroSecundario: edificios?.letrero_secundario || null,
    },
    tareas: [...(tareas ?? [])]
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
      .map((t) => ({
        id: t.id,
        agente_id: t.agente_id,
        instrucciones: t.instrucciones,
        estado: t.estado,
        aviso: t.aviso,
        paso_hasta: t.paso_hasta,
        actualizado_en: t.actualizado_en,
        agente: t.agentes?.nombre ?? "Agente",
      })),
  }));
}

/** La cola del Director en el orden en que se atenderá: urgentes primero y después por orden. */
export async function cargarCola(): Promise<EncargoVista[]> {
  const { data, error } = await supabase()
    .from("encargos")
    .select(SELECT_VISTA)
    .eq("estado", "en_cola")
    .order("urgente", { ascending: false })
    .order("orden")
    .order("id")
    .returns<FilaVista[]>();
  if (error) throw new Error(`No se pudo leer la cola: ${error.message}. ¿Has ejecutado la migración 0007?`);
  return paraMostrar(data ?? []);
}

/** Encargos que el Director tiene entre manos: el que reparte, el que hace el equipo (o en error) y los que esperan mi respuesta. */
export async function cargarActivos(): Promise<EncargoVista[]> {
  const { data, error } = await supabase()
    .from("encargos")
    .select(SELECT_VISTA)
    .in("estado", ["en_curso", "repartido", "error", "esperando_respuesta"] satisfies EstadoEncargo[])
    .order("actualizado_en")
    .returns<FilaVista[]>();
  // Sin la migración 0010 estos estados no existen: no hay nada activo.
  if (error) return [];
  return paraMostrar(data ?? []);
}

/** Encargos listos para revisar, terminados o cancelados, del más reciente al más antiguo. */
export async function cargarHistorial(limite = 20): Promise<EncargoVista[]> {
  const { data, error } = await supabase()
    .from("encargos")
    .select(SELECT_VISTA)
    .not("estado", "in", "(en_cola,en_curso,repartido,error,esperando_respuesta)")
    .order("actualizado_en", { ascending: false })
    .limit(limite)
    .returns<FilaVista[]>();
  if (error) throw new Error(`No se pudieron leer los encargos: ${error.message}`);
  return paraMostrar(data ?? []);
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

export function estaAtascado(
  e: Pick<Encargo, "estado" | "actualizado_en" | "reintentar_en"> & { tareas?: Pick<Tarea, "estado" | "paso_hasta" | "actualizado_en">[] | null },
): boolean {
  const viejo = (fecha: string) => Date.now() - Date.parse(fecha) > MINUTOS_ATASCADO * 60_000;
  if (e.estado === "en_curso") return !e.reintentar_en && viejo(e.actualizado_en);
  // El equipo trabaja: una tarea a medias cuya ejecución se cortó (nadie la tiene y lleva mucho sin moverse).
  if (e.estado === "repartido") {
    return (e.tareas ?? []).some(
      (t) => (t.estado === "en_curso" || t.estado === "revisando") && (!t.paso_hasta || Date.parse(t.paso_hasta) < Date.now()) && viejo(t.actualizado_en),
    );
  }
  return false;
}

export type TareaVista = Pick<
  Tarea,
  | "id"
  | "instrucciones"
  | "creado_en"
  | "estado"
  | "resultado_json"
  | "resultado"
  | "nota_agente"
  | "nota_director"
  | "vueltas"
  | "aprobada_en"
  | "texto_editado"
  | "comentario_ceo"
> & { encargo: EncargoVista };

/** Últimos trabajos aprobados que se ven (plegados) en cada ficha. */
const MAX_APROBADOS = 10;

/**
 * Tareas de un agente con su encargo (proyecto, adjuntos): las que tiene entre manos y las ya listas,
 * de la más antigua a la más reciente. Una sola consulta (más las miniaturas).
 */
export async function cargarTareasAgente(agenteId: string): Promise<TareaVista[]> {
  const db = supabase();
  const columnas = `*, encargos(${SELECT_VISTA})`;
  // Las que tiene entre manos o listas y, a la vez, sus últimos trabajos aprobados.
  const [{ data: tareas, error }, { data: aprobadas, error: e2 }] = await Promise.all([
    db
      .from("tareas")
      .select(columnas)
      .eq("agente_id", agenteId)
      .in("estado", ["pendiente", "en_curso", "revision", "revisando", "revisada", "lista"] satisfies EstadoTarea[])
      .order("creado_en")
      .returns<(Tarea & { encargos: FilaVista | null })[]>(),
    db
      .from("tareas")
      .select(columnas)
      .eq("agente_id", agenteId)
      .eq("estado", "aprobada" satisfies EstadoTarea)
      .order("aprobada_en", { ascending: false })
      .limit(MAX_APROBADOS)
      .returns<(Tarea & { encargos: FilaVista | null })[]>(),
  ]);
  if (error || e2) throw new Error(`No se pudieron leer las tareas: ${(error ?? e2)!.message}. ¿Has ejecutado la migración 0012?`);
  const conEncargo = [...(tareas ?? []), ...(aprobadas ?? [])].filter((t) => t.encargos);
  const encargos = await paraMostrar(conEncargo.map((t) => t.encargos!));
  return conEncargo.map((t, i) => ({
    id: t.id,
    instrucciones: t.instrucciones,
    creado_en: t.creado_en,
    estado: t.estado,
    resultado: t.resultado,
    resultado_json: t.resultado_json ?? null,
    nota_agente: t.nota_agente ?? null,
    nota_director: t.nota_director ?? null,
    vueltas: t.vueltas ?? 0,
    aprobada_en: t.aprobada_en ?? null,
    texto_editado: t.texto_editado ?? null,
    comentario_ceo: t.comentario_ceo ?? null,
    encargo: encargos[i]!,
  }));
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

/**
 * "Reintentar" (encargo en error) o "Reanudar" (atascado): se vuelve a poner en marcha.
 * Si ya estaba repartido, siguen las tareas donde se quedaron; si no, el Director vuelve a decidir.
 */
export async function reanudarEncargo(id: string): Promise<void> {
  const db = supabase();
  const { data: encargo, error } = await db
    .from("encargos")
    .select("*, tareas(id, estado, aviso, paso_hasta, actualizado_en)")
    .eq("id", id)
    .maybeSingle<Encargo & { tareas: Pick<Tarea, "id" | "estado" | "aviso" | "paso_hasta" | "actualizado_en">[] | null }>();
  if (error) throw new Error(`No se pudo leer el encargo: ${error.message}`);
  const tareas = encargo?.tareas ?? [];
  if (!encargo || !(encargo.estado === "error" || estaAtascado(encargo))) {
    throw new Error("Este encargo ya no necesita reintentarse.");
  }

  if (tareas.length) {
    // Las tareas a medias vuelven a su paso anterior y se quitan los avisos: la cola las retoma.
    const ahora = new Date().toISOString();
    const deshacer: [EstadoTarea, EstadoTarea][] = [
      ["en_curso", "pendiente"],
      ["revisando", "revision"],
    ];
    for (const [de, a] of deshacer) {
      const { error: e } = await db.from("tareas").update({ estado: a, paso_hasta: null }).eq("encargo_id", id).eq("estado", de);
      if (e) throw new Error(`No se pudo reanudar: ${e.message}`);
    }
    const { error: e1 } = await db.from("tareas").update({ aviso: null, reintentos: 0, reintentar_en: ahora }).eq("encargo_id", id);
    if (e1) throw new Error(`No se pudo reanudar: ${e1.message}`);
  }

  const { error: e2 } = await db
    .from("encargos")
    .update({
      estado: (tareas.length ? "repartido" : "en_curso") satisfies EstadoEncargo,
      reintentar_en: tareas.length ? null : new Date().toISOString(),
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
