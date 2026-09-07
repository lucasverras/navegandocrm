import { redirect } from "next/navigation";

// Triagem now lives under Prospecção → Encontrados. Old URL preserved as a redirect.
export default function SelecionarPage() {
  redirect("/prospeccao?tab=encontrados");
}
