import Link from "next/link";
import Logo from "./Logo";
import { logout } from "@/app/actions/auth";

type Props = {
  edificio: { nombre: string; color: string };
  avisos?: React.ReactNode;
};

export default function Header({ edificio, avisos }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-3">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg pr-1">
          <Logo />
          <span className="hidden font-display text-lg font-extrabold tracking-tight sm:inline">
            Mi Oficina
          </span>
        </Link>

        <nav aria-label="Proyectos" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          <Link
            href="/"
            aria-current="page"
            className="flex min-h-11 min-w-0 shrink items-center gap-2 rounded-lg border-2 bg-panel px-3 text-sm font-semibold"
            style={{ borderColor: edificio.color }}
          >
            <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px]" style={{ background: edificio.color }} />
            <span className="truncate">{edificio.nombre}</span>
          </Link>
          <button
            type="button"
            disabled
            title="Próximamente"
            aria-label="Nuevo proyecto (próximamente)"
            className="min-h-11 shrink-0 cursor-not-allowed whitespace-nowrap rounded-lg border-2 border-dashed border-line px-3 text-sm text-muted"
          >
            + Nuevo proyecto
          </button>
        </nav>

        {avisos}

        <form action={logout}>
          <button
            type="submit"
            className="min-h-11 min-w-11 rounded-lg px-2 text-sm text-muted hover:text-text"
            title="Cerrar sesión"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
