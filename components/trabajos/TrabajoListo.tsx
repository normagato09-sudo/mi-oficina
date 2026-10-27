"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { aprobarTrabajo, editarTrabajo, pedirCambiosTrabajo } from "@/app/actions/trabajos";
import Cartel from "@/components/carteles/Cartel";
import { CAMPOS, PLANTILLAS, TAMANOS, leerCartel, type CartelDiseñador, type MarcaCartel, type Plantilla, type Tamano } from "@/lib/carteles";
import type { EncargoVista, TareaVista } from "@/lib/encargos";
import { textoDeResultado, type Resultado } from "@/lib/trabajos";
import ResultadoTrabajo, { BotonCopiar } from "./ResultadoTrabajo";

const CAMPO = "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-accent";
const BOTON = "min-h-9 rounded-md border border-line px-3 text-xs font-semibold hover:border-muted disabled:opacity-50";

type Modo = "ver" | "editar" | "cambios";

/** El texto que se copia de un trabajo (mi versión si lo edité entero). */
function textoParaCopiar(t: TareaVista): string {
  return t.texto_editado || (t.resultado_json ? textoDeResultado(t.resultado_json) : t.resultado);
}

/**
 * Un trabajo listo en la ficha de su agente: el resultado y tres botones.
 * Editar (mi versión; el Director aprende de la diferencia), Pedir cambios (vuelve a la cola con mi
 * comentario) y Aprobar: Publicar (Instagram), Descargar PNG (Diseñador) o Copiar (los demás).
 */
export default function TrabajoListo({ tarea }: { tarea: TareaVista }) {
  const [modo, setModo] = useState<Modo>("ver");
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [publicar, setPublicar] = useState(false);
  const r = tarea.resultado_json!;

  function lanzar(accion: () => Promise<{ error?: string }>, alTerminar?: () => void) {
    setError(null);
    empezar(async () => {
      const res = await accion();
      if (res.error) setError(res.error);
      else alTerminar?.();
    });
  }
  const aprobar = () => lanzar(() => aprobarTrabajo(tarea.id));

  return (
    <div className="flex flex-col gap-3">
      {modo === "editar" ? (
        <Editor tarea={tarea} pendiente={pendiente} alCancelar={() => setModo("ver")} alGuardar={(e) => lanzar(() => editarTrabajo(tarea.id, e), () => setModo("ver"))} />
      ) : (
        <ResultadoTrabajo
          resultado={r}
          encargo={tarea.encargo}
          textoEditado={tarea.texto_editado}
          alDescargarCartel={r.tipo === "diseno" ? async () => aprobar() : undefined}
        />
      )}

      {modo === "cambios" && (
        <PedirCambios
          pendiente={pendiente}
          alCancelar={() => setModo("ver")}
          alEnviar={(comentario) => lanzar(() => pedirCambiosTrabajo(tarea.id, comentario), () => setModo("ver"))}
        />
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {modo === "ver" && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <button type="button" className={BOTON} disabled={pendiente} onClick={() => setModo("editar")}>
            Editar
          </button>
          <button type="button" className={BOTON} disabled={pendiente} onClick={() => setModo("cambios")}>
            Pedir cambios
          </button>
          {r.tipo === "redes" ? (
            <button type="button" className="btn-primary min-h-9 text-xs" disabled={pendiente} onClick={() => setPublicar(true)}>
              Publicar
            </button>
          ) : r.tipo === "diseno" ? (
            <span className="self-center text-xs text-muted">Para aprobar: «Descargar PNG y aprobar».</span>
          ) : (
            <button
              type="button"
              className="btn-primary min-h-9 text-xs"
              disabled={pendiente}
              onClick={async () => {
                await navigator.clipboard.writeText(textoParaCopiar(tarea));
                aprobar();
              }}
            >
              {pendiente ? "Aprobando…" : "Copiar y aprobar"}
            </button>
          )}
        </div>
      )}

      {publicar && r.tipo === "redes" && (
        <VentanaPublicar
          caption={r.datos.caption}
          hashtags={r.datos.hashtags}
          imagenes={r.datos.imagenes.flatMap((img) => {
            const a = tarea.encargo.adjuntos.filter((x) => x.tipo === "imagen")[img.numero];
            return a && a.tipo === "imagen" && a.url ? [{ url: a.url, nombre: a.nombre, alt: img.alt }] : [];
          })}
          pendiente={pendiente}
          alCerrar={() => setPublicar(false)}
          alPublicar={() => lanzar(() => aprobarTrabajo(tarea.id), () => setPublicar(false))}
        />
      )}
    </div>
  );
}

/* ───────────── Pedir cambios ───────────── */

function PedirCambios({ pendiente, alCancelar, alEnviar }: { pendiente: boolean; alCancelar: () => void; alEnviar: (c: string) => void }) {
  const [comentario, setComentario] = useState("");
  const id = useId();
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        alEnviar(comentario);
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold">
        ¿Qué hay que cambiar?
      </label>
      <textarea id={id} rows={3} maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)} className={`${CAMPO} resize-y`} autoFocus />
      <p className="text-xs text-muted">El agente lo rehará teniendo en cuenta tu comentario y el Director lo revisará otra vez.</p>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary min-h-9 text-xs" disabled={pendiente || !comentario.trim()}>
          {pendiente ? "Enviando…" : "Pedir cambios"}
        </button>
        <button type="button" className={BOTON} onClick={alCancelar} disabled={pendiente}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ───────────── Editar ───────────── */

type Edicion = Parameters<typeof editarTrabajo>[1];

function Editor({ tarea, pendiente, alCancelar, alGuardar }: { tarea: TareaVista; pendiente: boolean; alCancelar: () => void; alGuardar: (e: Edicion) => void }) {
  const r = tarea.resultado_json!;
  const id = useId();
  // Campos propios para Instagram, el cartel, la traducción y la redacción; el texto entero para el resto.
  const [caption, setCaption] = useState(r.tipo === "redes" ? r.datos.caption : "");
  const [hashtags, setHashtags] = useState(r.tipo === "redes" ? r.datos.hashtags.join(" ") : "");
  const [traduccion, setTraduccion] = useState(r.tipo === "traduccion" ? r.datos.texto : "");
  const [titulo, setTitulo] = useState(r.tipo === "redaccion" ? r.datos.titulo : "");
  const [cuerpo, setCuerpo] = useState(r.tipo === "redaccion" ? r.datos.texto : "");
  const [cartel, setCartel] = useState<CartelDiseñador | null>(r.tipo === "diseno" ? r.datos : null);
  const [texto, setTexto] = useState(textoParaCopiar(tarea));

  function guardar() {
    let resultado: Resultado | null = null;
    if (r.tipo === "redes") resultado = { tipo: "redes", datos: { ...r.datos, caption, hashtags: hashtags.split(/\s+/).filter(Boolean) } };
    else if (r.tipo === "traduccion") resultado = { tipo: "traduccion", datos: { ...r.datos, texto: traduccion } };
    else if (r.tipo === "redaccion") resultado = { tipo: "redaccion", datos: { titulo, texto: cuerpo } };
    else if (r.tipo === "diseno" && cartel) resultado = { tipo: "diseno", datos: cartel };
    alGuardar(resultado ? { tipo: "datos", resultado } : { tipo: "texto", texto });
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/5 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <p className="text-sm font-semibold">Editar</p>
      {r.tipo === "redes" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Texto de la publicación
            <textarea rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} className={`${CAMPO} resize-y`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hashtags (separados por espacios)
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={CAMPO} />
          </label>
        </>
      ) : r.tipo === "traduccion" ? (
        <label className="flex flex-col gap-1 text-sm">
          Texto traducido
          <textarea rows={8} value={traduccion} onChange={(e) => setTraduccion(e.target.value)} className={`${CAMPO} resize-y`} />
        </label>
      ) : r.tipo === "redaccion" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Texto (# títulos, - listas, **negrita**)
            <textarea rows={10} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} className={`${CAMPO} resize-y font-mono text-xs`} />
          </label>
        </>
      ) : r.tipo === "diseno" && cartel ? (
        <EditorCartel cartel={cartel} encargo={tarea.encargo} onChange={setCartel} />
      ) : (
        <label htmlFor={id} className="flex flex-col gap-1 text-sm">
          Texto
          <textarea id={id} rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} className={`${CAMPO} resize-y font-mono text-xs`} />
        </label>
      )}
      <p className="text-xs text-muted">Al guardar, el Director compara tu versión con la del agente y anota lo que debe aprender.</p>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary min-h-9 text-xs" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className={BOTON} onClick={alCancelar} disabled={pendiente}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

const ANCHO_PREVIA = 340;

/** Los campos del cartel con su vista previa en vivo. */
function EditorCartel({ cartel, encargo, onChange }: { cartel: CartelDiseñador; encargo: EncargoVista; onChange: (c: CartelDiseñador) => void }) {
  const { ancho, alto } = TAMANOS[cartel.tamano];
  const escala = ANCHO_PREVIA / ancho;
  const imagenes = encargo.adjuntos.filter((a) => a.tipo === "imagen");
  const urlFoto = cartel.plantilla === "foto" && cartel.foto !== null ? (imagenes[cartel.foto] as { url?: string | null } | undefined)?.url : null;
  const marca: MarcaCartel = {
    nombre: encargo.proyecto.letrero,
    secundario: encargo.proyecto.letreroSecundario,
    color: encargo.proyecto.color,
    colorSecundario: encargo.proyecto.colorSecundario,
  };
  const textos = cartel.textos as Record<string, string>;
  // Cambiar de plantilla conserva los textos que coinciden (título…) y valida como lo que devuelve la IA.
  const cambiar = (c: { plantilla?: Plantilla; tamano?: Tamano; textos?: Record<string, string>; foto?: number | null }) =>
    onChange(
      leerCartel({
        plantilla: c.plantilla ?? cartel.plantilla,
        tamano: c.tamano ?? cartel.tamano,
        textos: c.textos ?? textos,
        foto: c.foto !== undefined ? c.foto : cartel.plantilla === "foto" ? cartel.foto : imagenes.length ? 0 : null,
        explicacion: cartel.explicacion,
      }),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Plantilla
          <select value={cartel.plantilla} onChange={(e) => cambiar({ plantilla: e.target.value as Plantilla })} className={CAMPO}>
            {Object.entries(PLANTILLAS).map(([k, n]) => (
              <option key={k} value={k} disabled={k === "foto" && !imagenes.length}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tamaño
          <select value={cartel.tamano} onChange={(e) => cambiar({ tamano: e.target.value as Tamano })} className={CAMPO}>
            {Object.entries(TAMANOS).map(([k, t]) => (
              <option key={k} value={k}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-hidden rounded-lg border border-line" style={{ width: ANCHO_PREVIA, height: alto * escala }} aria-label="Vista previa del cartel" role="img">
        <div style={{ width: ancho, height: alto, transform: `scale(${escala})`, transformOrigin: "top left" }}>
          <Cartel plantilla={cartel.plantilla} tamano={cartel.tamano} textos={textos} marca={marca} foto={urlFoto ?? null} />
        </div>
      </div>
      {CAMPOS[cartel.plantilla].map((campo) => (
        <label key={campo.clave} className="flex flex-col gap-1 text-sm">
          {campo.etiqueta}
          {campo.largo ? (
            <textarea
              rows={2}
              maxLength={campo.max}
              value={textos[campo.clave] ?? ""}
              onChange={(e) => cambiar({ textos: { ...textos, [campo.clave]: e.target.value } })}
              className={`${CAMPO} resize-y`}
            />
          ) : (
            <input
              maxLength={campo.max}
              value={textos[campo.clave] ?? ""}
              onChange={(e) => cambiar({ textos: { ...textos, [campo.clave]: e.target.value } })}
              className={CAMPO}
            />
          )}
        </label>
      ))}
    </div>
  );
}

/* ───────────── Publicar en Instagram (de momento, a mano) ───────────── */

function VentanaPublicar({
  caption,
  hashtags,
  imagenes,
  pendiente,
  alCerrar,
  alPublicar,
}: {
  caption: string;
  hashtags: string[];
  imagenes: { url: string; nombre: string; alt: string }[];
  pendiente: boolean;
  alCerrar: () => void;
  alPublicar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const texto = `${caption}${hashtags.length ? `\n\n${hashtags.join(" ")}` : ""}`;
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  async function descargar(img: { url: string; nombre: string }, i: number) {
    // Descarga real (la URL firmada es de otro dominio: el atributo download no basta).
    const blob = await (await fetch(img.url)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(i + 1).padStart(2, "0")}-${img.nombre.replace(/\.[^.]+$/, "")}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <dialog
      ref={dialogo}
      onClose={alCerrar}
      aria-labelledby="publicar-titulo"
      className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-text backdrop:bg-ink/70"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 id="publicar-titulo" className="font-display text-lg font-extrabold">
          Publicar en Instagram
        </h2>
        <button type="button" onClick={() => dialogo.current?.close()} aria-label="Cerrar" className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-muted hover:text-text">
          ×
        </button>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted">De momento se publica a mano: copia el texto, descarga las imágenes y súbelo a Instagram. Después pulsa «Ya lo he publicado».</p>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">1. Texto</p>
            <BotonCopiar texto={texto} />
          </div>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line rounded-lg border border-line bg-ink/60 p-3 text-sm">{texto}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">2. Imágenes, en este orden</p>
          {imagenes.length ? (
            <ol className="mt-2 flex flex-col gap-2">
              {imagenes.map((img, i) => (
                <li key={i} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura firmada de Storage */}
                  <img src={img.url} alt={img.alt} className="size-14 shrink-0 rounded-md border border-line object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {i + 1}. {img.nombre}
                  </span>
                  <button type="button" className={BOTON} onClick={() => void descargar(img, i)}>
                    Descargar
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm text-muted">Esta publicación no lleva imágenes del encargo (si es el cartel, descárgalo desde la ficha del Diseñador).</p>
          )}
        </div>
        <button type="button" className="btn-primary" disabled={pendiente} onClick={alPublicar}>
          {pendiente ? "Aprobando…" : "3. Ya lo he publicado"}
        </button>
      </div>
    </dialog>
  );
}
