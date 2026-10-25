"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { momentoEspana, type Momento } from "@/lib/hora";

type Props = {
  inicial: Momento;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Mantiene el cielo de las ventanas y los relojes al día con la hora de España. */
export default function Ambiente({ inicial, className, style, children }: Props) {
  const [momento, setMomento] = useState(inicial);
  // El segundero gira solo con CSS; su desfase se fija una vez para que no dé saltos.
  const [retrasoSegundero, setRetrasoSegundero] = useState(-inicial.segundos);

  useEffect(() => {
    const tick = () => setMomento(momentoEspana());
    const arranque = setTimeout(() => {
      const ahora = momentoEspana();
      setMomento(ahora);
      setRetrasoSegundero(-ahora.segundos);
    }, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(arranque);
      clearInterval(id);
    };
  }, []);

  const estilo = {
    ...style,
    "--aguja-h": `${momento.horas}deg`,
    "--aguja-m": `${momento.minutos}deg`,
    "--aguja-s-retraso": `${retrasoSegundero}s`,
  } as CSSProperties;

  return (
    <div className={className} data-cielo={momento.cielo} style={estilo}>
      {children}
    </div>
  );
}
