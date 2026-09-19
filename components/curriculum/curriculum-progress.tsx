import type { CurriculumSnapshot } from "@/app/actions/curriculum-actions";

const STATUS_DOT: Record<string, string> = {
  bitti: "bg-green-500",
  calisiliyor: "bg-amber-500",
  baslamadi: "bg-gray-300",
};

export function CurriculumSummaryCard({
  snapshot,
}: {
  snapshot: CurriculumSnapshot;
}) {
  const pct =
    snapshot.totalTopics > 0
      ? Math.round((snapshot.doneTopics / snapshot.totalTopics) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">
          Biten Konu: {snapshot.doneTopics}/{snapshot.totalTopics}
        </p>
        <p className="text-sm font-bold text-indigo-700">%{pct}</p>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex gap-2 text-[11px] font-semibold">
        <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">
          Çalışılıyor: {snapshot.inProgressTopics}
        </span>
        <span className="rounded-lg bg-gray-100 px-2 py-1 text-gray-500">
          Başlamadı: {snapshot.notStartedTopics}
        </span>
      </div>
    </div>
  );
}

export function CurriculumSubjectGroup({
  title,
  groups,
}: {
  title: string;
  groups: CurriculumSnapshot["tyt"];
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
        {title}
      </h2>
      <div className="space-y-2">
        {groups.map((g) => {
          const subjectPct =
            g.totalTopics > 0
              ? Math.round((g.doneTopics / g.totalTopics) * 100)
              : 0;
          return (
            <div
              key={g.subjectId}
              className="rounded-xl border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {g.subjectName}
                </p>
                <span className="text-xs font-bold text-indigo-700">
                  {g.doneTopics}/{g.totalTopics} (%{subjectPct})
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${subjectPct}%` }}
                />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {g.topics.map((t) => (
                  <span
                    key={t.topicId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[t.status]}`}
                    />
                    {t.topicName}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CurriculumProgress({ snapshot }: { snapshot: CurriculumSnapshot }) {
  return (
    <div className="space-y-6">
      <CurriculumSummaryCard snapshot={snapshot} />
      {snapshot.tyt.length > 0 && (
        <CurriculumSubjectGroup title="TYT" groups={snapshot.tyt} />
      )}
      {snapshot.ayt.length > 0 && (
        <CurriculumSubjectGroup title="AYT" groups={snapshot.ayt} />
      )}
    </div>
  );
}