"use client";

import { startTransition, useActionState, useId } from "react";
import { guardarDatosOrganizacion, type EstadoOrganizacion } from "@/app/actions/organizacion";
import { IDIOMAS_PROYECTO } from "@/lib/idiomas";
import type { Edificio } from "@/lib/tipos";

const CAMPO =
  "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-accent";

/** Formulario para crear una organización (sin `organizacion`) o editar sus datos. */
export default function FormOrganizacion({ organizacion: proyecto }: { organizacion?: Edificio }) {
  const [estado, accion, guardando] = useActionState<EstadoOrganizacion, FormData>(guardarDatosOrganizacion, {});
  const id = useId();

  return (
    <form
      // Sin reiniciar el formulario: si hay un error, lo escrito se queda.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="flex flex-col gap-4"
    >
      {proyecto && <input type="hidden" name="id" value={proyecto.id} />}

      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${id}-nombre`} className="font-semibold">
            Nombre
          </label>
          <input id={`${id}-nombre`} name="nombre" required maxLength={80} defaultValue={proyecto?.nombre} className={CAMPO} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-color`} className="font-semibold">
            Color
          </label>
          <input
            id={`${id}-color`}
            name="color"
            type="color"
            defaultValue={proyecto?.color ?? "#3f60de"}
            className="h-[38px] w-16 cursor-pointer rounded-lg border border-line bg-ink p-1"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${id}-idioma`} className="font-semibold">
            Idioma
          </label>
          <select id={`${id}-idioma`} name="idioma" defaultValue={proyecto?.idioma ?? "es"} className={CAMPO}>
            {Object.entries(IDIOMAS_PROYECTO).map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${id}-instagram`} className="font-semibold">
            Instagram <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id={`${id}-instagram`}
            name="instagram"
            placeholder="@usuario"
            maxLength={31}
            defaultValue={proyecto?.instagram ?? ""}
            className={CAMPO}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-ficha`} className="font-semibold">
          Ficha de la organización
        </label>
        <p className="text-sm text-muted">Qué es, tono, reglas y lo que hay que poner siempre. Los agentes la leen en cada encargo y proyecto.</p>
        <textarea
          id={`${id}-ficha`}
          name="ficha"
          rows={12}
          defaultValue={proyecto?.ficha ?? ""}
          className={`${CAMPO} resize-y leading-relaxed`}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={guardando}>
          {guardando ? "Guardando…" : proyecto ? "Guardar cambios" : "Crear organización"}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {estado.error ? <span className="text-red-400">{estado.error}</span> : estado.ok ? <span className="text-muted">{estado.ok}</span> : null}
        </p>
      </div>
    </form>
  );
}
