import type { Metadata } from "next";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · Mi Oficina" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Logo />
          <h1 className="font-display text-2xl font-extrabold">Mi Oficina</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
