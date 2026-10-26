import { leerAvisos } from "@/app/actions/encargos";
import type { Aviso } from "@/lib/tipos";

const FECHA = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Campana de avisos de la cabecera: los avisos sin leer en un desplegable. */
export default function Campana({ avisos }: { avisos: Aviso[] }) {
  const n = avisos.length;
  return (
    <details className="relative">
      <summary
        className="relative flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-muted hover:text-text [&::-webkit-details-marker]:hidden"
        aria-label={n ? `Avisos: ${n} sin leer` : "Avisos: ninguno sin leer"}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {n > 0 && (
          <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white">
            {n > 9 ? "9+" : n}
          </span>
        )}
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-line bg-panel p-3 shadow-xl">
        <p className="px-1 font-semibold">Avisos</p>
        {n === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-muted">No tienes avisos nuevos.</p>
        ) : (
          <>
            <ul className="mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto">
              {avisos.map((a) => (
                <li key={a.id} className="rounded-lg bg-panel-2 px-3 py-2 text-sm">
                  <p>{a.mensaje}</p>
                  <time dateTime={a.creado_en} className="text-xs text-muted">
                    {FECHA.format(new Date(a.creado_en))}
                  </time>
                </li>
              ))}
            </ul>
            <form action={leerAvisos} className="mt-2">
              <button type="submit" className="btn-secondary w-full text-sm">
                Marcar como leídos
              </button>
            </form>
          </>
        )}
      </div>
    </details>
  );
}
