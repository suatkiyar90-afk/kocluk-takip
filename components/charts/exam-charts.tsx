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
import { ChartCard } from "@/components/charts/chart-ui";
import {
  buildSubjectRows,
  buildTimeline,
  hasPreviousExam,
} from "@/lib/exam-stats";
import type { MockExamRecord } from "@/app/actions/mock-exam-actions";

const COLORS = {
  blue: "#0072B2",
  orange: "#E69F00",
  gray: "#999999",
  lightGray: "#CCCCCC",
};

const legendStyle = { fontSize: 12 } as const;

function formatNet(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${formatNet(Math.abs(delta))}`;
}

export default function ExamCharts({
  records,
}: {
  records: MockExamRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-6 text-center">
        <p className="text-sm font-medium leading-relaxed text-gray-500">
          Henüz deneme sınavı sonucu yok. Okulun deneme sonuçlarını
          yüklediğinde burada grafiklerin görünecek.
        </p>
      </div>
    );
  }

  const timeline = buildTimeline(records);
  const hasPrev = hasPreviousExam(records);
  const subjectRows = buildSubjectRows(records);

  const deltaFooter = hasPrev ? (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
        Önceki denemeye göre fark
      </p>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {subjectRows.map((row) => (
          <li
            key={row.label}
            className="rounded-lg bg-gray-50 px-2.5 py-1.5 ring-1 ring-gray-200"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-medium text-gray-500">
                {row.label}
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900">
                {formatNet(row.last)}
              </span>
            </div>
            <p
              className={`mt-0.5 text-[11px] font-bold tabular-nums ${
                row.delta !== null && row.delta > 0
                  ? "text-emerald-700"
                  : row.delta !== null && row.delta < 0
                    ? "text-red-600"
                    : "text-gray-500"
              }`}
            >
              {row.delta !== null && row.delta > 0
                ? "▲"
                : row.delta !== null && row.delta < 0
                  ? "▼"
                  : "•"}{" "}
              {row.delta !== null ? formatDelta(row.delta) : "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <ChartCard
        title="TYT Puanı ve Toplam Net"
        subtitle="Denemelere göre zaman çizgisi"
        ariaLabel="Deneme sınavlarında TYT puanı ve toplam net zaman çizgisi"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={timeline}
            margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis yAxisId="puan" tick={{ fontSize: 11 }} width={48} />
            <YAxis
              yAxisId="net"
              orientation="right"
              tick={{ fontSize: 11 }}
              width={40}
            />
            <Tooltip />
            <Legend wrapperStyle={legendStyle} />
            <Line
              yAxisId="puan"
              type="monotone"
              dataKey="puan"
              name="TYT Puanı"
              stroke={COLORS.blue}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              yAxisId="net"
              type="monotone"
              dataKey="net"
              name="Toplam Net"
              stroke={COLORS.orange}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Ders Bazlı Net Karşılaştırması"
        subtitle={
          hasPrev
            ? "Son deneme ve önceki deneme netleri"
            : "Son deneme netleri"
        }
        ariaLabel="Ders bazında son deneme ile önceki deneme net karşılaştırması"
        footer={deltaFooter}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={subjectRows}
            margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              height={56}
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} width={44} />
            <Tooltip />
            <Legend wrapperStyle={legendStyle} />
            <Bar dataKey="last" name="Son deneme" fill={COLORS.blue} />
            {hasPrev ? (
              <Bar
                dataKey="prev"
                name="Önceki deneme"
                fill={COLORS.lightGray}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
