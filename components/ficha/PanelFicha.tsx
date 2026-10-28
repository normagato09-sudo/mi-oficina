"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import FichaAgente from "./FichaAgente";
import { useFichaAbierta } from "./navegacion";
import NuevoEncargo from "@/components/encargos/NuevoEncargo";
import ColaDirector from "@/components/encargos/ColaDirector";
import HistorialEncargos from "@/components/encargos/HistorialEncargos";
import RepartoDirector from "@/components/encargos/RepartoDirector";
import TareasAgente from "@/components/encargos/TareasAgente";
import PlantillasCartel, { type ProyectoCartel } from "@/components/carteles/PlantillasCartel";
import ProyectosDirector from "@/components/proyectos/ProyectosDirector";
import type { AgenteConEstado } from "@/lib/datos";
import type { DatosFicha } from "@/lib/ficha";

type Props = {
  agentes: AgenteConEstado[];
  /** Color de la ficha de cada agente (el de su camiseta). */
  colores: Record<string, string>;
  /** Proyectos activos, con los datos de su cartel (Nuevo encargo y plantillas del Diseñador). */
  proyectos: ProyectoCartel[];
  enCola: number;
  /** Huella de la oficina: si cambia (algo se ha movido), la ficha abierta vuelve a pedir sus datos. */
  firma: string;
};

type Carga = { agenteId: string; firma: string; datos?: DatosFicha; error?: string };

/**
 * Ficha del agente seleccionado. Al abrirla solo se piden sus datos (/api/ficha), sin recargar la oficina;
 * mientras tanto se ve "Cargando…" con lo que ya se sabe del agente (nombre y estado).
 */
export default function PanelFicha({ agentes, colores, proyectos, enCola, firma }: Props) {
  const agenteId = useFichaAbierta();
  const nuevo = useSearchParams().get("nuevo") === "1";
  const agente = agentes.find((a) => a.id === agenteId);
  const [carga, setCarga] = useState<Carga | null>(null);
  // El navegador ya sabe qué agente es: así el servidor no tiene que buscarlo antes de cargar.
  const tipo = !agente ? null : agente.despacho === "direccion" && agente.tipo === "direccion" ? "director" : agente.despacho === "diseno" ? "diseno" : "agente";

  // ¿Es la primera carga de esta ficha (se acaba de abrir)? Solo entonces cuenta como "vista".
  const yaCargada = carga?.agenteId === agenteId;

  useEffect(() => {
    if (!agenteId || !tipo) return;
    let vigente = true;
    fetch(`/api/ficha?agente=${encodeURIComponent(agenteId)}&tipo=${tipo}${yaCargada ? "" : "&abrir=1"}`, { cache: "no-store" })
      .then(async (r) => {
        const cuerpo = (await r.json()) as DatosFicha | { error: string };
        if (!vigente) return;
        setCarga("error" in cuerpo ? { agenteId, firma, error: cuerpo.error } : { agenteId, firma, datos: cuerpo });
      })
      .catch((e: unknown) => vigente && setCarga({ agenteId, firma, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      vigente = false;
    };
    // yaCargada no es dependencia: cambia justo con la respuesta y no debe volver a pedirla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenteId, tipo, firma]);

  if (!agente) return null;
  const esDirector = agente.despacho === "direccion" && agente.tipo === "direccion";
  // Mientras se vuelve a pedir (por un cambio), se siguen viendo los datos anteriores de este mismo agente.
  const suya = carga?.agenteId === agente.id ? carga : null;

  return (
    <FichaAgente agente={agente} color={colores[agente.id] ?? "#5b6378"} enCola={esDirector ? enCola : 0}>
      {esDirector && (
        <NuevoEncargo
          key={`${agente.id}-${nuevo}`}
          agenteId={agente.id}
          proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre }))}
          abiertoInicial={nuevo}
        />
      )}
      {!suya ? (
        <p role="status" className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-accent" />
          Cargando…
        </p>
      ) : suya.error ? (
        <p role="alert" className="mt-8 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {suya.error}
        </p>
      ) : suya.datos?.tipo === "director" ? (
        <>
          <RepartoDirector activos={suya.datos.activos} />
          <ProyectosDirector proyectos={suya.datos.proyectos} />
          <ColaDirector cola={suya.datos.cola} />
          <HistorialEncargos encargos={suya.datos.historial} />
        </>
      ) : suya.datos?.tipo === "agente" ? (
        <>
          <TareasAgente tareas={suya.datos.tareas} />
          {agente.despacho === "diseno" && <PlantillasCartel proyectos={proyectos} fotos={suya.datos.fotos} />}
        </>
      ) : null}
    </FichaAgente>
  );
}
