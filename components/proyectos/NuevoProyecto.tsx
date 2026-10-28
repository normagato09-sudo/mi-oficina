"use client";

import { useId, useRef, useState } from "react";
import { enviarProyecto, prepararSubidasProyecto } from "@/app/actions/proyectos";
import { ACEPTA_ADJUNTOS, MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, esTipoAdjunto } from "@/lib/encargos-reglas";
import { MAX_CARACTERES_PROYECTO, MAX_NOMBRE_PROYECTO } from "@/lib/proyectos-reglas";

const CAMPO = "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-accent";

function tamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Nuevo proyecto": organización, nombre, objetivo, fecha límite, notas y adjuntos. Al guardarlo, el Director hace el plan. */
export default function NuevoProyecto({ organizaciones }: { organizaciones: { id: string; nombre: string }[] }) {
  const [organizacionId, setOrganizacionId] = useState(organizaciones.length === 1 ? organizaciones[0]!.id : "");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();

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
        setError(`Como máximo ${MAX_ADJUNTOS} archivos.`);
        break;
      }
      nuevos.push(f);
    }
    setArchivos(nuevos);
    if (entrada.current) entrada.current.value = "";
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const texto = (clave: string) => String(form.get(clave) ?? "");
    if (!organizacionId) return setError("Elige la organización del proyecto.");
    if (!texto("nombre").trim()) return setError("Escribe el nombre del proyecto.");
    if (!texto("objetivo").trim()) return setError("Escribe el objetivo: qué quieres conseguir.");

    try {
      let subidas: { ruta: string; nombre: string; tipo: string }[] = [];
      if (archivos.length) {
        setProgreso("Preparando la subida…");
        const preparado = await prepararSubidasProyecto(archivos.map((f) => ({ nombre: f.name, tipo: f.type, bytes: f.size })));
        if (preparado.error || !preparado.subidas) throw new Error(preparado.error ?? "No se pudo preparar la subida.");
        // Los originales van directamente a Storage (no pasan por el servidor).
        for (const [i, s] of preparado.subidas.entries()) {
          setProgreso(`Subiendo ${i + 1} de ${archivos.length}…`);
          const r = await fetch(s.url, { method: "PUT", headers: { "content-type": s.tipo, "x-upsert": "false" }, body: archivos[i] });
          if (!r.ok) throw new Error(`No se pudo subir "${s.nombre}" (${r.status}).`);
        }
        subidas = preparado.subidas.map(({ ruta, nombre, tipo }) => ({ ruta, nombre, tipo }));
      }

      setProgreso("Guardando…");
      // Si va bien, el servidor abre el proyecto recién creado.
      const r = await enviarProyecto({
        organizacionId,
        nombre: texto("nombre"),
        objetivo: texto("objetivo"),
        fechaLimite: texto("fecha"),
        notas: texto("notas"),
        subidas,
      });
      if (r?.error) throw new Error(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgreso(null);
    }
  }

  const ocupado = progreso !== null;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" aria-label="Nuevo proyecto">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-org`} className="font-semibold">
          Organización
        </label>
        <select id={`${id}-org`} value={organizacionId} onChange={(e) => setOrganizacionId(e.target.value)} disabled={ocupado} className={`${CAMPO} min-h-11`}>
          {organizaciones.length !== 1 && <option value="">Elige una organización…</option>}
          {organizaciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-nombre`} className="font-semibold">
          Nombre
        </label>
        <input id={`${id}-nombre`} name="nombre" required maxLength={MAX_NOMBRE_PROYECTO} disabled={ocupado} placeholder="Por ejemplo: Lanzar el curso de doblaje" className={CAMPO} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-objetivo`} className="font-semibold">
          Objetivo
        </label>
        <p className="text-sm text-muted">Qué quieres conseguir. Cuantos más datos, mejor plan.</p>
        <textarea id={`${id}-objetivo`} name="objetivo" rows={5} required maxLength={MAX_CARACTERES_PROYECTO} disabled={ocupado} className={`${CAMPO} resize-y leading-relaxed`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-fecha`} className="font-semibold">
          Fecha límite <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input id={`${id}-fecha`} name="fecha" type="date" disabled={ocupado} className={`${CAMPO} min-h-11 w-48`} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-notas`} className="font-semibold">
          Notas <span className="font-normal text-muted">(opcional)</span>
        </label>
        <textarea id={`${id}-notas`} name="notas" rows={4} maxLength={MAX_CARACTERES_PROYECTO} disabled={ocupado} className={`${CAMPO} resize-y leading-relaxed`} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-semibold" id={`${id}-adjuntos`}>
          Adjuntos <span className="font-normal text-muted">(opcional)</span>
        </span>
        <p className="-mt-1 text-sm text-muted">Imágenes JPEG, PNG o WEBP y PDF (máx. {MAX_ADJUNTOS}, 20 MB cada uno).</p>
        {archivos.length > 0 && (
          <ul className="flex flex-col gap-1" aria-labelledby={`${id}-adjuntos`}>
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
        <label htmlFor={`${id}-archivos`} className={`btn-secondary cursor-pointer self-start ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
          + Añadir archivos
        </label>
        <input
          ref={entrada}
          id={`${id}-archivos`}
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

      <button type="submit" className="btn-primary self-start" disabled={ocupado}>
        {ocupado ? "Guardando…" : "Crear proyecto y pedir el plan"}
      </button>
    </form>
  );
}
