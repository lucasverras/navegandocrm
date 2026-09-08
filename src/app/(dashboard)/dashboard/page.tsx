import { redirect } from "next/navigation";

// "Radar do dia" foi absorvido pelo Hoje — uma única home de trabalho (V6 §11).
export default function DashboardRedirect() {
  redirect("/hoje");
}
