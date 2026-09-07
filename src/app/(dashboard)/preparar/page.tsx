import { redirect } from "next/navigation";

// Preparação now lives under Prospecção → Selecionados. Old URL preserved as a redirect.
export default function PrepararPage() {
  redirect("/prospeccao?tab=selecionados");
}
