"use client";

// Analytics tab for Resultados. Data is computed server-side (see analytics-data.ts)
// and passed in as plain props. recharts is heavy and was previously pulled out of the
// dashboard for bundle size, so we lazy-load the whole module on mount via a dynamic
// import — it lands in its own chunk fetched only when this tab is opened.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { BRL } from "@/lib/finance";
import type { AnalyticsData, FunnelStep, NamedCount, MrrPoint } from "./analytics-data";

type Recharts = typeof import("recharts");

// Light-theme chart palette (design tokens).
const ACCENT = "#c8601f"; // --accent
const AXIS = "#6b6660"; // --muted
const GRID = "#e7e5e1"; // --border

const tooltipStyle = {
  background: "#ffffff",
  border: `1px solid ${GRID}`,
  borderRadius: 8,
  fontSize: 12,
  color: "#1a1a18",
  padding: "6px 10px",
} as const;
const tooltipLabelStyle = { color: AXIS, fontSize: 11 } as const;

const compactBRL = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 1,
});

const trunc = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function useRecharts() {
  const [rc, setRc] = useState<Recharts | null>(null);
  useEffect(() => {
    let on = true;
    import("recharts").then((m) => {
      if (on) setRc(m);
    });
    return () => {
      on = false;
    };
  }, []);
  return rc;
}

export function Analytics({ data }: { data: AnalyticsData }) {
  const rc = useRecharts();
  const funnelHasData = data.funnel.some((s) => s.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        className="lg:col-span-2"
        title="Funil de conversão"
        subtitle={
          data.funnelTotalPct != null
            ? `Conversão total: ${data.funnelTotalPct}% (Selecionados → Fechados)`
            : undefined
        }
      >
        {!funnelHasData ? <Note /> : !rc ? <Loading /> : <FunnelChart rc={rc} data={data.funnel} />}
      </ChartCard>

      <ChartCard title="Fechados por região">
        {data.regions.length === 0 ? <Note /> : !rc ? <Loading /> : <BarsChart rc={rc} data={data.regions} />}
      </ChartCard>

      <ChartCard title="Motivos de perda">
        {data.lossReasons.length === 0 ? (
          <Note />
        ) : !rc ? (
          <Loading />
        ) : (
          <BarsChart rc={rc} data={data.lossReasons} labelWidth={130} />
        )}
      </ChartCard>

      <ChartCard className="lg:col-span-2" title="MRR ao longo do tempo" subtitle="MRR bruto acumulado (ignora churn)">
        {data.mrr.length < 2 ? <Note /> : !rc ? <Loading /> : <MrrChart rc={rc} data={data.mrr} />}
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="px-5 pt-4">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs tabular-nums text-muted">{subtitle}</p>}
      </div>
      <div className="px-2 pb-3 pt-2">
        <div className="h-60 w-full" style={{ fontVariantNumeric: "tabular-nums" }}>
          {children}
        </div>
      </div>
    </Card>
  );
}

function Note() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted">Amostra pequena / sem dados</div>
  );
}

function Loading() {
  return <div className="flex h-full items-center justify-center text-xs text-muted">Carregando gráfico…</div>;
}

// Horizontal "funnel": one bar per stage, count + step-over-step conversion % as labels.
function FunnelChart({ rc, data }: { rc: Recharts; data: FunnelStep[] }) {
  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } = rc;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="stage"
          width={92}
          interval={0}
          tick={{ fontSize: 11, fill: AXIS }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "rgba(200,96,31,0.06)" }} />
        <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey="label" position="right" fill={AXIS} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Generic horizontal bar chart for {name, value} tallies (regions, loss reasons).
function BarsChart({ rc, data, labelWidth = 110 }: { rc: Recharts; data: NamedCount[]; labelWidth?: number }) {
  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } = rc;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          interval={0}
          tickFormatter={(v: string) => trunc(String(v), labelWidth >= 130 ? 20 : 16)}
          tick={{ fontSize: 11, fill: AXIS }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "rgba(200,96,31,0.06)" }} />
        <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="value" position="right" fill={AXIS} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MrrChart({ rc, data }: { rc: Recharts; data: MrrPoint[] }) {
  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } = rc;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 20, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
        <YAxis
          width={64}
          tick={{ fontSize: 11, fill: AXIS }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => compactBRL.format(Number(v))}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ stroke: GRID }}
          formatter={(v: number | string | readonly (number | string)[] | undefined) => [
            BRL.format(Number(Array.isArray(v) ? v[0] : v)),
            "MRR acumulado",
          ]}
        />
        <Line type="monotone" dataKey="mrr" stroke={ACCENT} strokeWidth={2} dot={{ r: 2, fill: ACCENT }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
