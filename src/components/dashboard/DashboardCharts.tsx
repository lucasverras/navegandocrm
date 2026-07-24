"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const COLORS = ["#c8601f", "#e4802f", "#a89e8f", "#4a9d6f", "#c99a2e"];

export function DashboardCharts({ categoryData }: { categoryData: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição por categoria</CardTitle>
      </CardHeader>
      <CardContent>
        {categoryData.length === 0 ? (
          <p className="text-sm text-muted">Sem dados ainda.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b2620" />
                <XAxis dataKey="name" stroke="#a89e8f" fontSize={11} tickLine={false} />
                <YAxis stroke="#a89e8f" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1c1916", border: "1px solid #2b2620", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#f3ede4" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {categoryData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
