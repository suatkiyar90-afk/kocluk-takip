"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface MyDenemeTrendPoint {
  date: string;
  net: number;
}

export default function MyDenemeTrend({
  points,
}: {
  points: MyDenemeTrendPoint[];
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-500">
        Trend için en az 2 deneme kaydı gerekli.
      </div>
    );
  }

  const nets = points.map((point) => point.net);
  const minNet = Math.floor(Math.min(...nets));
  const maxNet = Math.ceil(Math.max(...nets));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          domain={[minNet, maxNet]}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          width={50}
        />
        <Tooltip
          formatter={(value: number | string) => [String(value).replace(".", ","), "Net"]}
          contentStyle={{
            borderRadius: 12,
            fontSize: 12,
            border: "1px solid #e5e7eb",
          }}
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke="#4f46e5"
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: "#4f46e5" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
