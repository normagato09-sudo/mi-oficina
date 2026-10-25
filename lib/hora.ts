export type Cielo = "amanecer" | "dia" | "atardecer" | "noche";

export type Momento = {
  cielo: Cielo;
  /** Ángulos de las agujas del reloj de pared, en grados. */
  horas: number;
  minutos: number;
  segundos: number;
};

/** Salida y puesta de sol aproximadas en España (hora local) por mes. */
const SOL: [number, number][] = [
  [8.6, 18.2], [8.3, 18.8], [7.6, 19.4], [7.9, 20.8], [7.2, 21.3], [6.8, 21.7],
  [7.0, 21.7], [7.5, 21.2], [7.9, 20.4], [8.3, 19.5], [8.1, 17.9], [8.6, 17.8],
];

const FORMATO = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  month: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

/** Hora real de España y el cielo que se ve por la ventana. */
export function momentoEspana(fecha = new Date()): Momento {
  const partes = Object.fromEntries(FORMATO.formatToParts(fecha).map((p) => [p.type, p.value]));
  const mes = Number(partes.month) - 1;
  const h = Number(partes.hour);
  const m = Number(partes.minute);
  const s = Number(partes.second);
  const t = h + m / 60;

  const [sale, pone] = SOL[mes];
  let cielo: Cielo = "noche";
  if (Math.abs(t - sale) < 0.75) cielo = "amanecer";
  else if (Math.abs(t - pone) < 0.75) cielo = "atardecer";
  else if (t > sale && t < pone) cielo = "dia";

  return {
    cielo,
    horas: (h % 12) * 30 + m * 0.5,
    minutos: m * 6 + s * 0.1,
    segundos: s,
  };
}
