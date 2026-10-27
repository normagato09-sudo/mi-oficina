import { after, connection } from "next/server";
import AutoRefresco from "@/components/AutoRefresco";
import Header from "@/components/Header";
import Oficina, { estiloAgente, letreroDe } from "@/components/oficina/Oficina";
import PanelFicha from "@/components/ficha/PanelFicha";
import { SinFicha } from "@/components/ficha/navegacion";
import PanelProyecto from "@/components/panel/PanelProyecto";
import PanelProyectos from "@/components/panel/PanelProyectos";
import { avanzarCola } from "@/lib/cola";
import { cargarOficina, cargarTodosLosProyectos, type DatosOficina } from "@/lib/datos";
import { plural } from "@/lib/estado";
import type { Edificio } from "@/lib/tipos";

/** La cola del Director corre en segundo plano (after) en la página y en sus acciones: hasta 60 s. */
export const maxDuration = 60;

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const params = await searchParams;
  // La ficha de un agente se abre y se cierra en el navegador (PanelFicha): aquí solo importa para no abrir otros paneles.
  const hayFicha = typeof params.agente === "string";
  const panel = hayFicha ? undefined : params.panel;

  let datos: DatosOficina;
  let todosLosProyectos: Edificio[] | undefined;
  let errorProyectos: string | null = null;
  try {
    // Todo a la vez: la oficina y, si está abierto, el panel "Proyectos".
    [datos, todosLosProyectos] = await Promise.all([
      cargarOficina(),
      panel === "proyectos"
        ? cargarTodosLosProyectos().catch((e: unknown) => {
            errorProyectos = e instanceof Error ? e.message : String(e);
            return undefined;
          })
        : undefined,
    ]);
  } catch (e) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
            <h1 className="font-display text-xl font-extrabold">No se pudo abrir la oficina</h1>
            <p className="mt-2 text-muted">{e instanceof Error ? e.message : String(e)}</p>
          </div>
        </main>
      </>
    );
  }

  // Al abrir la oficina la cola sigue avanzando (empieza el siguiente o continúa el que espera), sin hacer esperar a la página.
  after(avanzarCola);

  const director = datos.agentes.find((a) => a.despacho === "direccion" && a.tipo === "direccion");
  // El cartel de Dirección: el proyecto del encargo en curso o, si no hay ninguno, "MI OFICINA".
  const proyectoCartel = datos.proyectos.find((p) => p.id === datos.proyectoEnCurso);
  const corbata = proyectoCartel ? letreroDe(proyectoCartel).colorSecundario : "#F5B841";
  const equipoAbierto = panel === "equipo";

  return (
    <>
      {/* Mientras el Director trabaja (o hay cola que puede empezar), se mira si algo cambia. */}
      <AutoRefresco activo={datos.hayEnCurso} firma={datos.firma} />
      <Header directorId={director?.id} avisos={datos.avisos} proyectosAbierto={panel === "proyectos"} />
      <div className="mx-auto flex max-w-[1600px] items-start gap-6 px-6 py-4">
        <main className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="font-display text-xl font-extrabold tracking-tight">Mi Oficina</h1>
            <p className="text-sm text-muted">
              {plural(datos.agentes.length, "agente", "agentes")} · trabajando para{" "}
              {datos.proyectos.length === 1 ? datos.proyectos[0]!.nombre : plural(datos.proyectos.length, "proyecto", "proyectos")}
            </p>
          </div>
          <div className="mt-3">
            <Oficina datos={datos} enCola={datos.enCola} proyectoCartel={proyectoCartel} equipoAbierto={equipoAbierto} />
          </div>
        </main>

        <SinFicha>
          {todosLosProyectos && (
            <PanelProyectos
              proyectos={todosLosProyectos}
              seleccionado={typeof params.proyecto === "string" ? params.proyecto : undefined}
            />
          )}
          {errorProyectos && (
            <p role="alert" className="w-[460px] shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
              {errorProyectos}
            </p>
          )}
          {equipoAbierto && <PanelProyecto agentes={datos.agentes} />}
        </SinFicha>

        <PanelFicha
          agentes={datos.agentes}
          colores={Object.fromEntries(datos.agentes.map((a) => [a.id, estiloAgente(a, corbata).aspecto.camiseta]))}
          proyectos={datos.proyectos.map((p) => {
            const l = letreroDe(p);
            return { id: p.id, nombre: l.principal, secundario: l.secundario, color: l.color, colorSecundario: l.colorSecundario };
          })}
          enCola={datos.enCola}
          firma={datos.firma}
        />
      </div>
    </>
  );
}
