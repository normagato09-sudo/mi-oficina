/** Idiomas en los que puede trabajar un proyecto (los comparten el navegador y el servidor). */
export const IDIOMAS_PROYECTO = { es: "Español", ca: "Catalán", en: "Inglés" } as const;
export type IdiomaProyecto = keyof typeof IDIOMAS_PROYECTO;
