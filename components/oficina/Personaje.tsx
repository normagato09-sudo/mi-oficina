import type { CSSProperties } from "react";

export type Pose = "trabajando" | "libre" | "inactivo";

export type Aspecto = {
  camiseta: string;
  sombra: string;
  pelo: string;
  piel: string;
  /** Peinado: corto, largo (melena) o moño. */
  peinado?: "corto" | "largo" | "mono";
  /** Color con el que la pantalla ilumina la cara al trabajar. */
  luz?: string;
  /** Corbata (para el Director). */
  corbata?: string;
};

export const ASPECTO_AGENTE: Aspecto = {
  camiseta: "#da1415",
  sombra: "#b10f10",
  pelo: "#3b2a20",
  piel: "#f1c7a1",
  peinado: "corto",
};

/** Muñeco visto de frente, sentado tras la mesa. Las poses se animan solo con CSS. */
export default function Personaje({ pose, aspecto = ASPECTO_AGENTE }: { pose: Pose; aspecto?: Aspecto }) {
  const estilo = {
    "--camiseta": aspecto.camiseta,
    "--camiseta-sombra": aspecto.sombra,
    "--pelo": aspecto.pelo,
    "--piel": aspecto.piel,
    ...(aspecto.luz ? { "--luz-cara": aspecto.luz } : {}),
  } as CSSProperties;

  return (
    <span className={`personaje pose-${pose} peinado-${aspecto.peinado ?? "corto"}`} style={estilo} aria-hidden="true">
      <span className="respira">
        <span className="melena" />
        <span className="brazo izq" />
        <span className="brazo der" />
        <span className="cuerpo">
          {aspecto.corbata && <span className="corbata" style={{ background: aspecto.corbata }} />}
        </span>
        <span className="cabeza">
          <span className="pelo" />
          <span className="ojo izq" />
          <span className="ojo der" />
          <span className="moflete izq" />
          <span className="moflete der" />
          <span className="boca" />
          <span className="luz-pantalla" />
        </span>
        <span className="taza-mano" />
        <span className="movil" />
      </span>
    </span>
  );
}
