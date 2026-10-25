import Header from "@/components/Header";

export default function Home() {
  return (
    <>
      <Header edificio={{ nombre: "DEFENSEM L'EMPORDANET", color: "#298D3B" }} />
      <main className="mx-auto max-w-7xl px-4 py-8" />
    </>
  );
}
