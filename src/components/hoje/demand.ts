import { nextActionLabel } from "@/types/domain";

// A demand = an active lead + its next action. Hoje is a post-it, not an analytics page:
// every row here answers "o que eu preciso fazer?" — nothing else qualifies.
export type Demand = {
  id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  website: string | null;
  maps_url: string | null;
  next_action_type: string;
  next_action_at: string | null;
  proposal_value: number | null;
  meeting_link: string | null;
  pipeline_stage: string | null;
  region: { neighborhood: string } | null;
};

export const DEMAND_SELECT =
  "id, name, phone, instagram, instagram_handle, instagram_url, website, maps_url, " +
  "next_action_type, next_action_at, proposal_value, meeting_link, pipeline_stage, region:regions(neighborhood)";

export type DemandBucket = "atrasadas" | "hoje" | "amanha" | "semana" | "depois" | "sem-data";

const TZ = "America/Sao_Paulo";

// Wall-clock conversion: the server runs in UTC, the operator lives in São Paulo. All
// day-bucket math ("atrasado", "hoje", "amanhã") must use SP calendar days.
function spWall(date: Date | string): Date {
  return new Date(new Date(date).toLocaleString("en-US", { timeZone: TZ }));
}

export function spTodayStart(now = new Date()): Date {
  const d = spWall(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

// The real UTC instant of São Paulo's midnight today (SP is fixed UTC-3, no DST since 2019).
export function spTodayStartInstant(now = new Date()): Date {
  const wall = spWall(now);
  return new Date(Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate(), 3, 0, 0));
}

function dayDiffFrom(todayStart: Date, iso: string): number {
  const at = spWall(iso);
  at.setHours(0, 0, 0, 0);
  return Math.round((at.getTime() - todayStart.getTime()) / 86_400_000);
}

export function bucketOf(d: Demand, todayStart: Date): DemandBucket {
  if (!d.next_action_at) return "sem-data";
  const dayDiff = dayDiffFrom(todayStart, d.next_action_at);
  if (dayDiff < 0) return "atrasadas";
  if (dayDiff === 0) return "hoje";
  if (dayDiff === 1) return "amanha";
  if (dayDiff <= 7) return "semana";
  return "depois";
}

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const DAY_FMT = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });

// One human line per demand — Odoo's due-date semaphore: red = late, amber = today, muted = future.
export function actionLine(d: Demand, todayStart: Date): { text: string; tone: "danger" | "warning" | "muted" } {
  const label = nextActionLabel(d.next_action_type);
  if (!d.next_action_at) return { text: label, tone: "muted" };

  const at = new Date(d.next_action_at);
  const dayDiff = dayDiffFrom(todayStart, d.next_action_at);

  if (dayDiff < 0) {
    const days = Math.abs(dayDiff);
    return { text: `${label} · ${days} ${days === 1 ? "dia atrasado" : "dias atrasados"}`, tone: "danger" };
  }
  if (dayDiff === 0) {
    const detail = d.next_action_type === "meeting" ? TIME_FMT.format(at) : "hoje";
    return { text: `${label} · ${detail}`, tone: "warning" };
  }
  if (dayDiff === 1) {
    const detail = d.next_action_type === "meeting" ? `amanhã ${TIME_FMT.format(at)}` : "amanhã";
    return { text: `${label} · ${detail}`, tone: "muted" };
  }
  return { text: `${label} · ${DAY_FMT.format(at)}`, tone: "muted" };
}

export function demandInstagramUrl(d: Pick<Demand, "instagram" | "instagram_handle" | "instagram_url">): string | null {
  if (d.instagram_url) return d.instagram_url;
  const handle = (d.instagram_handle ?? d.instagram)?.replace(/^@/, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

export function demandHandle(d: Pick<Demand, "instagram" | "instagram_handle">): string | null {
  const handle = (d.instagram_handle ?? d.instagram)?.replace(/^@/, "");
  return handle || null;
}
