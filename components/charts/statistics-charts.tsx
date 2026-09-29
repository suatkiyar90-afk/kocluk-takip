"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, ChartEmpty } from "@/components/charts/chart-ui";
import type { StudentTrendsData } from "@/app/actions/quiz-actions";

const COLORS = {
  blue: "#0072B2",
  orange: "#E69F00",
  green: "#009E73",
  red: "#D55E00",
  gray: "#999999",
};

const legendStyle = { fontSize: 12 } as const;

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

function formatDayNumber(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "numeric",
  });
}

export default function StatisticsCharts({
  data,
}: {
  data: StudentTrendsData;
}) {
  const hasWeekly = data.weeks.some((w) => w.total > 0);
  const hasSubjects = data.subjects.length > 0;
  const hasDaily = data.daily.some((d) => d.total > 0);

  const subjectLabelProps = {
    angle: -35,
    textAnchor: "end" as const,
    height: 56,
    interval: 0,
  };

  return (
    <div className="space-y-4">
      <ChartCard
        title="Haftalık Toplam Soru ve Net"
        subtitle={`Son ${data.weeks.length} hafta`}
        ariaLabel="Son haftalarda çözülen soru sayısı ve net grafiği"
      >
        {hasWeekly ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeks} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="weekStart"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis yAxisId="total" tick={{ fontSize: 11 }} width={44} />
              <YAxis
                yAxisId="net"
                orientation="right"
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip />
              <Legend wrapperStyle={legendStyle} />
              <Line
                yAxisId="total"
                type="monotone"
                dataKey="total"
                name="Toplam Soru"
                stroke={COLORS.blue}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="net"
                type="monotone"
                dataKey="net"
                name="Net"
                stroke={COLORS.orange}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty hint="Son haftalarda günlük soru kaydı girilmemiş. Günlük giriş ekranından soru çözdükçe grafik dolmaya başlar." />
        )}
      </ChartCard>

      <ChartCard
        title="Ders Bazında Doğru / Yanlış / Boş"
        ariaLabel="Ders bazında doğru, yanlış ve boş soru dağılımı grafiği"
      >
        {hasSubjects ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.subjects} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="subjectName"
                tick={{ fontSize: 11 }}
                {...subjectLabelProps}
              />
              <YAxis tick={{ fontSize: 11 }} width={44} />
              <Tooltip />
              <Legend wrapperStyle={legendStyle} />
              <Bar
                dataKey="correct"
                name="Doğru"
                stackId="a"
                fill={COLORS.green}
              />
              <Bar
                dataKey="wrong"
                name="Yanlış"
                stackId="a"
                fill={COLORS.red}
              />
              <Bar dataKey="blank" name="Boş" stackId="a" fill={COLORS.gray} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty hint="Ders bazında soru kaydı bulunmuyor. Günlük giriş ekranından kayıt yaptığında grafik burada görünür." />
        )}
      </ChartCard>

      <ChartCard
        title="Son 30 Gün Günlük Soru"
        ariaLabel="Son 30 günün günlük çözülen soru sayısı grafiği"
      >
        {hasDaily ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayNumber}
                tick={{ fontSize: 11 }}
                interval={4}
              />
              <YAxis tick={{ fontSize: 11 }} width={44} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={legendStyle} />
              <Bar
                dataKey="total"
                name="Çözülen Soru"
                fill={COLORS.blue}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty hint="Son 30 gün için kayıt bulunmuyor. Günlük giriş ekranından soru çözdükçe grafik dolmaya başlar." />
        )}
      </ChartCard>
    </div>
  );
}
