"use client";

import { useEffect, useState } from "react";
import { Target, TrendingUp, Trophy } from "lucide-react";
import {
  getMotivationData,
  type MotivationData,
} from "@/app/actions/motivation-actions";
import { PanelError, PanelSkeleton } from "@/components/student/panel-ui";
import { ringMotivation } from "@/lib/motivation";

const RING_SIZE = 148;
const RING_STROKE = 11;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface MotivationSectionProps {
  refreshKey?: number;
}

function WeeklyRingCard({ ring }: { ring: MotivationData["ring"] }) {
  const { daysEntered, daysTotal, targetPct, targetSolved, targetTotal, targetLabel } =
    ring;
  const motivation = ringMotivation(targetPct, daysEntered);
  const fraction = Math.min(daysEntered / Math.max(daysTotal, 1), 1);
  const dashOffset = RING_CIRCUMFERENCE * (1 - fraction);
  const stroke = motivation.complete ? "#10b981" : "#6366f1";

  return (
    <section
      aria-label="Bu haftaki çalışman"
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <Target className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-bold text-gray-900">Bu Haftaki Çalışmam</h2>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
          {daysEntered}/{daysTotal} gün
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <div
          className="relative"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            role="img"
            aria-label={`Bu hafta ${daysEntered} gün giriş yapıldı`}
          >
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={RING_STROKE}
            />
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke={stroke}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-extrabold text-gray-900">
              {daysEntered}
              <span className="text-lg font-bold text-gray-400">/{daysTotal}</span>
            </p>
            <p className="text-[11px] font-semibold text-gray-500">gün giriş</p>
          </div>
        </div>

        {targetPct === null ? (
          <p className="mt-3 text-center text-xs text-gray-500">
            Bu hafta için hedef belirlenmemiş. Yine de {daysEntered} gün girdin!
          </p>
        ) : (
          <div className="mt-3 w-full rounded-xl bg-gray-50 px-3 py-2 text-center">
            <p className="text-xs font-semibold text-gray-600">
              Hedef:{" "}
              <span className="font-bold text-gray-900">
                {targetSolved}/{targetTotal}
              </span>{" "}
              {targetLabel} ·{" "}
              <span className="font-bold text-gray-900">
                %{Math.round(targetPct)}
              </span>
            </p>
          </div>
        )}

        {motivation.message !== null ? (
          <p
            className={
              motivation.complete
                ? "mt-3 w-full rounded-xl bg-green-50 px-3 py-2 text-center text-sm font-bold text-green-700"
                : "mt-3 w-full rounded-xl bg-indigo-50 px-3 py-2 text-center text-sm font-bold text-indigo-700"
            }
          >
            {motivation.message}
          </p>
        ) : daysEntered === 0 ? (
          <p className="mt-3 text-center text-xs text-gray-500">
            Bu hafta henüz giriş yapmadın — ilk günü kaçırma!
          </p>
        ) : null}
      </div>
    </section>
  );
}

function TrendChip({ delta, suffix }: { delta: number; suffix?: string }) {
  const up = delta >= 0;
  return (
    <span
      className={
        up
          ? "shrink-0 rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-emerald-600 ring-1 ring-inset ring-emerald-100"
          : "shrink-0 rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-rose-500 ring-1 ring-inset ring-rose-100"
      }
    >
      {up ? "↑" : "↓"}
      {Math.abs(Math.round(delta * 10) / 10)}
      {suffix}
    </span>
  );
}

function PersonalGrowthCard({ growth }: { growth: MotivationData["growth"] }) {
  const { subjectTrends, denemeTrend, record } = growth;
  const hasRows = subjectTrends.length > 0 || denemeTrend !== null;

  const formatNet = (value: number): string =>
    value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

  return (
    <section
      aria-label="Kişisel rekorlar ve gelişim"
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-amber-50 p-1.5 text-amber-600 ring-1 ring-inset ring-amber-100">
          <TrendingUp className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-gray-900">
          Kişisel Rekorlar ve Gelişim
        </h2>
      </div>

      {record !== null ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm font-bold text-amber-800">
            {record.scope === "all-time"
              ? `Yeni Rekor: En çok soru çözdüğün gün (${record.total} Soru)`
              : `Yeni Rekor: Bu haftanın en çok soru çözdüğün günü (${record.total} Soru)`}
          </p>
        </div>
      ) : null}

      {hasRows ? (
        <ul className="mt-3 space-y-2">
          {subjectTrends.map((trend) => (
            <li
              key={trend.subjectName}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5"
            >
              <p className="min-w-0 text-sm text-gray-700">
                <span className="font-bold text-gray-900">
                  {trend.subjectName}
                </span>{" "}
                başarın son 3 haftada %{Math.round(trend.fromPct)} →{" "}
                <span
                  className={
                    trend.delta >= 0
                      ? "font-bold text-emerald-600"
                      : "font-bold text-rose-500"
                  }
                >
                  %{Math.round(trend.toPct)}
                </span>
              </p>
              <TrendChip delta={trend.delta} />
            </li>
          ))}
          {denemeTrend !== null ? (
            <li className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="min-w-0 text-sm text-gray-700">
                Son 3 denemede net ortalaman{" "}
                <span className="font-bold text-gray-900">
                  {formatNet(denemeTrend.oldAvg)}
                </span>{" "}
                →{" "}
                <span
                  className={
                    denemeTrend.newAvg >= denemeTrend.oldAvg
                      ? "font-bold text-emerald-600"
                      : "font-bold text-rose-500"
                  }
                >
                  {formatNet(denemeTrend.newAvg)}
                </span>
              </p>
              <TrendChip delta={denemeTrend.newAvg - denemeTrend.oldAvg} />
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          Gelişimi görmek için birkaç hafta daha veri biriktirmen yeterli.
        </p>
      )}
    </section>
  );
}

export function MotivationSection({ refreshKey = 0 }: MotivationSectionProps) {
  const [data, setData] = useState<MotivationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getMotivationData();
      if (cancelled) return;
      if (result.success === false) {
        setError(result.message);
      } else {
        setData(result.data);
        setError(null);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!loaded) {
    return (
      <div className="mb-4">
        <PanelSkeleton rows={4} />
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="mb-4">
        <PanelError message={error} />
      </div>
    );
  }

  if (data === null) {
    return null;
  }

  return (
    <div className="mb-4 space-y-4">
      <WeeklyRingCard ring={data.ring} />
      <PersonalGrowthCard growth={data.growth} />
    </div>
  );
}
