"use client";

import { useId, useRef, useState } from "react";
import { enviarEncargo, prepararSubidasEncargo } from "@/app/actions/encargos";
import { ACEPTA_ADJUNTOS, MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, MAX_CARACTERES_ENCARGO, esTipoAdjunto } from "@/lib/encargos-reglas";

type Props = {
  agenteId: string;
  /** Agentes de redes activos del edificio: si hay, se elige dónde publicar. */
  redes: { id: string; nombre: string }[];
};

function tamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Botón "Nuevo encargo" y su formulario: texto, adjuntos y (si el edificio tiene redes) dónde publicar. */
export default function NuevoEncargo({ agenteId, redes }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [destinos, setDestinos] = useState<string[]>(() => redes.map((r) => r.id));
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const idTexto = useId();
  const idArchivos = useId();

  function anadir(lista: FileList | null) {
    if (!lista) return;
    setError(null);
    const nuevos = [...archivos];
    for (const f of Array.from(lista)) {
      if (!esTipoAdjunto(f.type)) {
        setError(`"${f.name}" no es una imagen JPEG/PNG/WEBP ni un PDF.`);
        continue;
      }
      if (f.size > MAX_BYTES_ADJUNTO) {
        setError(`"${f.name}" pesa más de 20 MB.`);
        continue;
      }
      if (nuevos.length >= MAX_ADJUNTOS) {
        setError(`Como máximo ${MAX_ADJUNTOS} archivos por encargo.`);
        break;
      }
      nuevos.push(f);
    }
    setArchivos(nuevos);
    if (entrada.current) entrada.current.value = "";
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!texto.trim() && !archivos.length) return setError("Escribe el encargo o adjunta algún archivo.");
    if (redes.length && !destinos.length) return setError("Elige al menos una red donde publicar.");

    try {
      let subidas: { ruta: string; nombre: string; tipo: string }[] = [];
      if (archivos.length) {
        setProgreso("Preparando la subida…");
        const preparado = await prepararSubidasEncargo(
          agenteId,
          archivos.map((f) => ({ nombre: f.name, tipo: f.type, bytes: f.size })),
        );
        if (preparado.error || !preparado.subidas) throw new Error(preparado.error ?? "No se pudo preparar la subida.");

        // Los originales van directamente a Storage (no pasan por el servidor).
        for (const [i, s] of preparado.subidas.entries()) {
          setProgreso(`Subiendo ${i + 1} de ${archivos.length}…`);
          const r = await fetch(s.url, {
            method: "PUT",
            headers: { "content-type": s.tipo, "x-upsert": "false" },
            body: archivos[i],
          });
          if (!r.ok) throw new Error(`No se pudo subir "${s.nombre}" (${r.status}).`);
        }
        subidas = preparado.subidas.map(({ ruta, nombre, tipo }) => ({ ruta, nombre, tipo }));
      }

      setProgreso(archivos.some((f) => f.type.startsWith("image/")) ? "Preparando las imágenes…" : "Guardando…");
      const r = await enviarEncargo({ agenteId, texto, destinos, subidas });
      if (r.error) throw new Error(r.error);

      setTexto("");
      setArchivos([]);
      setDestinos(redes.map((x) => x.id));
      setAbierto(false);
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgreso(null);
    }
  }

  if (!abierto) {
    return (
      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            setAbierto(true);
            setEnviado(false);
          }}
        >
          Nuevo encargo
        </button>
        {enviado && (
          <p role="status" className="mt-2 text-center text-sm text-muted">
            Encargo enviado al Director.
          </p>
        )}
      </div>
    );
  }

  const ocupado = progreso !== null;

  return (
    <form onSubmit={enviar} className="mt-6 flex flex-col gap-4 rounded-xl border border-line bg-ink/40 p-4" aria-label="Nuevo encargo">
      <div className="flex flex-col gap-2">
        <label htmlFor={idTexto} className="font-semibold">
          ¿Qué necesitas?
        </label>
        <textarea
          id={idTexto}
          rows={6}
          maxLength={MAX_CARACTERES_ENCARGO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={ocupado}
          placeholder="Cuéntale al Director el encargo con todos los datos que tengas."
          className="w-full resize-y rounded-lg border border-line bg-ink px-3 py-2 text-sm leading-relaxed text-text outline-none focus:border-accent"
        />
      </div>

      {redes.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">¿Dónde publicar?</legend>
          <div className="flex flex-wrap gap-2">
            {redes.map((r) => {
              const marcada = destinos.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${marcada ? "border-accent bg-accent/10" : "border-line"}`}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-accent)]"
                    checked={marcada}
                    disabled={ocupado}
                    onChange={(e) =>
                      setDestinos((d) => (e.target.checked ? [...d, r.id] : d.filter((x) => x !== r.id)))
                    }
                  />
                  {r.nombre}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-semibold" id={`${idArchivos}-titulo`}>
          Adjuntos
        </span>
        <p className="-mt-1 text-sm text-muted">Imágenes JPEG, PNG o WEBP y PDF (máx. {MAX_ADJUNTOS}, 20 MB cada uno).</p>
        {archivos.length > 0 && (
          <ul className="flex flex-col gap-1" aria-labelledby={`${idArchivos}-titulo`}>
            {archivos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-panel-2 px-3 py-2 text-sm">
                <span aria-hidden="true">{f.type === "application/pdf" ? "📄" : "🖼️"}</span>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-muted">{tamano(f.size)}</span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setArchivos((a) => a.filter((_, j) => j !== i))}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg leading-none text-muted hover:text-text"
                  aria-label={`Quitar ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor={idArchivos} className={`btn-secondary cursor-pointer ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
          + Añadir archivos
        </label>
        <input
          ref={entrada}
          id={idArchivos}
          type="file"
          multiple
          accept={ACEPTA_ADJUNTOS}
          className="sr-only"
          disabled={ocupado}
          onChange={(e) => anadir(e.target.files)}
        />
      </div>

      <p role="status" aria-live="polite" className="text-sm">
        {error ? <span className="text-red-400">{error}</span> : progreso ? <span className="text-muted">{progreso}</span> : null}
      </p>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={ocupado}>
          {ocupado ? "Enviando…" : "Enviar encargo"}
        </button>
        <button type="button" className="btn-secondary" disabled={ocupado} onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
