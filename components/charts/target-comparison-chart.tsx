"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmpty } from "@/components/charts/chart-ui";

const COLORS = {
  blue: "#0072B2",
  gray: "#999999",
};

const legendStyle = { fontSize: 12 } as const;

export interface TargetComparisonItem {
  subjectName: string;
  target: number;
  actual: number;
}

export default function TargetComparisonChart({
  items,
}: {
  items: TargetComparisonItem[];
}) {
  if (items.length === 0) {
    return (
      <ChartEmpty hint="Bu hafta için henüz hedef girilmemiş. Öğretmenin hedef belirlediğinde karşılaştırma burada görünür." />
    );
  }

  return (
    <div
      role="img"
      aria-label="Ders bazında hedef ve gerçekleşen soru sayısı karşılaştırması"
      className="h-[260px] w-full overflow-hidden"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={items}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            allowDecimals={false}
            width={36}
          />
          <YAxis
            type="category"
            dataKey="subjectName"
            tick={{ fontSize: 11 }}
            width={88}
          />
          <Tooltip />
          <Legend wrapperStyle={legendStyle} />
          <Bar
            dataKey="target"
            name="Hedef"
            fill={COLORS.gray}
            barSize={12}
          />
          <Bar
            dataKey="actual"
            name="Gerçekleşen"
            fill={COLORS.blue}
            barSize={12}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
