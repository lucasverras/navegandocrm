import { redirect } from "next/navigation";

// Fechados agora é uma aba de Resultados. URL antiga preservada como redirect.
export default function FechadosPage() {
  redirect("/resultados?tab=fechados");
}
