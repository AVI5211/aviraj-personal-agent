"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/types";
import { paiseToRupees } from "@/lib/money";

interface TrendChartProps {
  trends: TrendPoint[];
  showMoneyLent?: boolean;
}

export function TrendChart({ trends, showMoneyLent = false }: TrendChartProps) {
  const data = trends.map((point) => ({
    month: point.month,
    Income: paiseToRupees(point.income),
    Expense: paiseToRupees(point.expense),
    "Money Lent / Deposit": paiseToRupees(point.moneyLent ?? 0),
  }));

  return (
    <div className="h-64 rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} />
          <Legend />
          <Bar dataKey="Income" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Expense" fill="#dc2626" radius={[4, 4, 0, 0]} />
          {showMoneyLent && <Bar dataKey="Money Lent / Deposit" fill="#d97706" radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
