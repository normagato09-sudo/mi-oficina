import { connection } from "next/server";
import Header from "@/components/Header";
import Oficina from "@/components/oficina/Oficina";
import FichaAgente from "@/components/ficha/FichaAgente";
import { cargarOficina, type DatosOficina } from "@/lib/datos";
import { plural } from "@/lib/estado";

function resumenEstado(datos: DatosOficina): string {
  const total = { preparando: 0, publicando: 0, lista: 0, error: 0 };
  for (const a of datos.agentes) {
    total.preparando += a.estados.preparando;
    total.publicando += a.estados.publicando;
    total.lista += a.estados.lista;
    total.error += a.estados.error;
  }
  if (total.preparando + total.publicando > 0) return "Trabajando…";
  if (total.error > 0) return plural(total.error, "error", "errores");
  if (total.lista > 0) return plural(total.lista, "publicación lista", "publicaciones listas");
  return "Todo en calma";
}

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const params = await searchParams;
  const agenteId = typeof params.agente === "string" ? params.agente : undefined;

  let datos: DatosOficina;
  try {
    datos = await cargarOficina();
  } catch (e) {
    return (
      <>
        <Header edificio={{ nombre: "Mi Oficina", color: "#298D3B" }} />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
            <h1 className="font-display text-xl font-extrabold">No se pudo abrir la oficina</h1>
            <p className="mt-2 text-muted">{e instanceof Error ? e.message : String(e)}</p>
          </div>
        </main>
      </>
    );
  }

  const agente = datos.agentes.find((a) => a.id === agenteId);
  const numAgentes = datos.agentes.length;

  return (
    <>
      <Header edificio={datos.edificio} />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <main className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {datos.edificio.nombre}
          </h1>
          <p className="mt-1 text-muted">
            {plural(datos.departamentos.length, "departamento", "departamentos")} ·{" "}
            {plural(numAgentes, "agente", "agentes")} · {resumenEstado(datos)}
          </p>
          <div className="mt-6">
            <Oficina datos={datos} agenteSeleccionado={agente?.id} />
          </div>
        </main>

        {agente && (
          <FichaAgente agente={agente} edificioNombre={datos.edificio.nombre}>
            <div className="mt-6">
              <button
                type="button"
                className="btn-primary w-full"
                disabled
                title="Disponible en el siguiente paso"
              >
                Nueva publicación
              </button>
            </div>
            <section aria-labelledby="pubs-titulo" className="mt-8">
              <h3 id="pubs-titulo" className="font-display text-lg font-extrabold">
                Publicaciones
              </h3>
              <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
                Aún no hay publicaciones.
              </p>
            </section>
          </FichaAgente>
        )}
      </div>
    </>
  );
}
