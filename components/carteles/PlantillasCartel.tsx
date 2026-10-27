"use client";

import { useId, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { CAMPOS, EJEMPLOS, PLANTILLAS, TAMANOS, type MarcaCartel, type Plantilla, type Tamano } from "@/lib/carteles";
import Cartel from "./Cartel";

export type ProyectoCartel = MarcaCartel & { id: string };
/** Foto adjunta a un encargo. */
export type FotoEncargo = { url: string; nombre: string; proyecto: string };

type Props = {
  proyectos: ProyectoCartel[];
  fotos: FotoEncargo[];
};

/** Ancho de la vista previa (px de pantalla). */
const ANCHO_PREVIA = 378;

const CAMPO =
  "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-accent";

function leerComoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });
}

function nombreArchivo(...partes: string[]): string {
  return (
    partes
      .join("-")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) + ".png"
  );
}

/** Sección "Plantillas" de la ficha del Diseñador: elegir plantilla, escribir textos, vista previa y PNG. */
export default function PlantillasCartel({ proyectos, fotos }: Props) {
  const id = useId();
  const [proyectoId, setProyectoId] = useState(proyectos[0]?.id ?? "");
  const [plantilla, setPlantilla] = useState<Plantilla>("convocatoria");
  const [tamano, setTamano] = useState<Tamano>("cuadrado");
  const [textos, setTextos] = useState<{ [P in Plantilla]: Record<string, string> }>(EJEMPLOS);
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoElegida, setFotoElegida] = useState("");
  const [mensaje, setMensaje] = useState<{ error?: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cartel = useRef<HTMLDivElement>(null);

  const proyecto = proyectos.find((p) => p.id === proyectoId) ?? proyectos[0];
  const marca: MarcaCartel = proyecto ?? { nombre: "Mi Oficina", secundario: null, color: "#3f60de", colorSecundario: "#f5b841" };
  const { ancho, alto } = TAMANOS[tamano];
  const escala = ANCHO_PREVIA / ancho;

  // La foto se convierte en data URL: así la vista previa y el PNG no dependen de otro dominio.
  async function usarFoto(origen: Blob | string, etiqueta: string) {
    setOcupado(true);
    setMensaje(null);
    try {
      const blob = typeof origen === "string" ? await (await fetch(origen)).blob() : origen;
      if (!blob.type.startsWith("image/")) throw new Error("no es una imagen");
      setFoto(await leerComoDataUrl(blob));
      setFotoElegida(etiqueta);
    } catch (e) {
      setMensaje({ error: true, texto: `No se pudo cargar la foto (${e instanceof Error ? e.message : String(e)}).` });
    } finally {
      setOcupado(false);
    }
  }

  // Si un encargo trae una foto, la plantilla con foto la usa directamente.
  function elegirPlantilla(nueva: Plantilla) {
    setPlantilla(nueva);
    const primera = fotos[0];
    if (nueva === "foto" && !foto && primera) void usarFoto(primera.url, `${primera.proyecto} · ${primera.nombre}`);
  }

  async function descargar() {
    if (!cartel.current) return;
    setOcupado(true);
    setMensaje(null);
    try {
      await document.fonts?.ready;
      const png = await toPng(cartel.current, { width: ancho, height: alto, pixelRatio: 1, cacheBust: true });
      const enlace = document.createElement("a");
      enlace.href = png;
      enlace.download = nombreArchivo(marca.nombre, PLANTILLAS[plantilla], `${ancho}x${alto}`);
      enlace.click();
      setMensaje({ texto: "Cartel descargado." });
    } catch (e) {
      setMensaje({ error: true, texto: `No se pudo crear el PNG (${e instanceof Error ? e.message : String(e)}).` });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-seccion`} className="mt-8 flex flex-col gap-4">
      <h3 id={`${id}-seccion`} className="font-display text-lg font-extrabold">
        Plantillas
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor={`${id}-proyecto`} className="text-sm font-semibold">
            Proyecto
          </label>
          <select id={`${id}-proyecto`} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={CAMPO}>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-plantilla`} className="text-sm font-semibold">
            Plantilla
          </label>
          <select id={`${id}-plantilla`} value={plantilla} onChange={(e) => elegirPlantilla(e.target.value as Plantilla)} className={CAMPO}>
            {Object.entries(PLANTILLAS).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-tamano`} className="text-sm font-semibold">
            Tamaño
          </label>
          <select id={`${id}-tamano`} value={tamano} onChange={(e) => setTamano(e.target.value as Tamano)} className={CAMPO}>
            {Object.entries(TAMANOS).map(([clave, t]) => (
              <option key={clave} value={clave}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vista previa en vivo: el cartel a tamaño real, escalado */}
      <div
        className="overflow-hidden rounded-lg border border-line"
        style={{ width: ANCHO_PREVIA, height: alto * escala }}
        aria-label={`Vista previa del cartel (${ancho}×${alto})`}
        role="img"
      >
        <div style={{ width: ancho, height: alto, transform: `scale(${escala})`, transformOrigin: "top left" }}>
          <Cartel ref={cartel} plantilla={plantilla} tamano={tamano} textos={textos[plantilla]} marca={marca} foto={foto} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {CAMPOS[plantilla].map((campo) => {
          const valor = textos[plantilla][campo.clave] ?? "";
          const cambiar = (v: string) => setTextos((t) => ({ ...t, [plantilla]: { ...t[plantilla], [campo.clave]: v } }));
          return (
            <div key={`${plantilla}-${campo.clave}`} className="flex flex-col gap-1">
              <label htmlFor={`${id}-${campo.clave}`} className="text-sm font-semibold">
                {campo.etiqueta}
              </label>
              {campo.largo ? (
                <textarea id={`${id}-${campo.clave}`} rows={2} maxLength={campo.max} value={valor} onChange={(e) => cambiar(e.target.value)} className={`${CAMPO} resize-y`} />
              ) : (
                <input id={`${id}-${campo.clave}`} maxLength={campo.max} value={valor} onChange={(e) => cambiar(e.target.value)} className={CAMPO} />
              )}
            </div>
          );
        })}

        {plantilla === "foto" && (
          <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Foto de fondo</legend>
            {fotos.length > 0 && (
              <select
                aria-label="Foto de un encargo"
                value=""
                onChange={(e) => {
                  const f = fotos[Number(e.target.value)];
                  if (f) void usarFoto(f.url, `${f.proyecto} · ${f.nombre}`);
                }}
                className={CAMPO}
              >
                <option value="">Usar una foto de un encargo…</option>
                {fotos.map((f, i) => (
                  <option key={i} value={i}>
                    {f.proyecto} · {f.nombre}
                  </option>
                ))}
              </select>
            )}
            <label className="btn-secondary cursor-pointer text-sm">
              Subir una foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) void usarFoto(archivo, archivo.name);
                  e.target.value = "";
                }}
              />
            </label>
            {foto && (
              <p className="flex items-center justify-between gap-2 text-sm text-muted">
                <span className="truncate">{fotoElegida}</span>
                <button type="button" className="shrink-0 underline hover:text-text" onClick={() => setFoto(null)}>
                  Quitar
                </button>
              </p>
            )}
          </fieldset>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={descargar} disabled={ocupado}>
          {ocupado ? "Un momento…" : "Descargar PNG"}
        </button>
        <p role="status" aria-live="polite" className={`text-sm ${mensaje?.error ? "text-red-400" : "text-muted"}`}>
          {mensaje?.texto}
        </p>
      </div>
    </section>
  );
}
