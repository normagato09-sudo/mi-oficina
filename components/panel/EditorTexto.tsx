"use client";

import { useActionState, useId, useState } from "react";
import { guardarTexto, type EstadoGuardado } from "@/app/actions/organizacion";

type Props = {
  tipo: "ficha" | "perfil";
  id: string;
  etiqueta: string;
  ayuda?: string;
  inicial: string;
  filas?: number;
};

/** Un texto editable (ficha de la organización o perfil de un agente) con su botón Guardar. */
export default function EditorTexto({ tipo, id, etiqueta, ayuda, inicial, filas = 8 }: Props) {
  const [estado, accion, guardando] = useActionState<EstadoGuardado, FormData>(guardarTexto, {});
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [estadoVisto, setEstadoVisto] = useState(estado);
  // Cuando el servidor confirma, su texto pasa a ser lo guardado.
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado.texto !== undefined) setGuardado(estado.texto);
  }
  const campo = useId();
  const cambiado = texto.trim() !== guardado.trim();

  return (
    <form
      action={accion}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <label htmlFor={campo} className="font-semibold">
        {etiqueta}
      </label>
      {ayuda && <p className="-mt-1 text-sm text-muted">{ayuda}</p>}
      <textarea
        id={campo}
        name="texto"
        rows={filas}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-ink px-3 py-2 text-sm leading-relaxed text-text outline-none focus:border-accent"
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={guardando || !cambiado}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {estado.error ? (
            <span className="text-red-400">{estado.error}</span>
          ) : estado.ok && !cambiado ? (
            <span className="text-muted">{estado.ok}</span>
          ) : cambiado ? (
            <span className="text-muted">Cambios sin guardar</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
