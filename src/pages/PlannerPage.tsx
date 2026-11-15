import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Clock, Plus, Printer, RotateCcw, Table2, TimerReset, Trash2 } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/site/PageHero";
import { cn } from "@/lib/utils";
import {
  calculatePlan,
  DEFAULT_PLANNER_INPUT,
  FINAL_SYSTEMS,
  formatDuration,
  formatMinutes,
  normalizeTime,
  type CategoryDistribution,
  type CategoryInput,
  type FinalSystem,
  type PlannerInput,
  type PlannerResult,
} from "@/lib/competition-timing";

const STORAGE_KEY = "osdushor:planner:v1";

type Category = "boys" | "girls";

const numberOr = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function mergeCategory(raw: unknown, base: CategoryInput): CategoryInput {
  const source = (raw ?? {}) as Partial<CategoryInput>;
  const finals = Array.isArray(source.finals)
    ? source.finals.map((final) => ({
        system: (FINAL_SYSTEMS.some((item) => item.value === final?.system) ? final.system : "rr") as FinalSystem,
        size: Math.max(0, Math.round(numberOr(final?.size, 0))),
      }))
    : base.finals;
  return {
    participants: Math.max(0, Math.round(numberOr(source.participants, base.participants))),
    groups: Math.max(0, Math.round(numberOr(source.groups, base.groups))),
    extra: Math.max(0, Math.round(numberOr(source.extra, base.extra))),
    finals,
  };
}

/** Сохранённый план мог остаться от прежней версии — недостающее берём из значений по умолчанию. */
function mergeInput(raw: unknown): PlannerInput {
  const base = DEFAULT_PLANNER_INPUT;
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Partial<PlannerInput>;
  return {
    tables: Math.max(1, Math.round(numberOr(source.tables, base.tables))),
    start: typeof source.start === "string" && source.start ? source.start : base.start,
    deadline: typeof source.deadline === "string" && source.deadline ? source.deadline : base.deadline,
    extraDays: Array.isArray(source.extraDays)
      ? source.extraDays.map((day) => ({
          start: typeof day?.start === "string" ? day.start : base.start,
          end: typeof day?.end === "string" ? day.end : base.deadline,
        }))
      : [],
    prelimMinutes: Math.max(1, Math.round(numberOr(source.prelimMinutes, base.prelimMinutes))),
    finalMinutes: Math.max(1, Math.round(numberOr(source.finalMinutes, base.finalMinutes))),
    briefMinutes: Math.max(0, Math.round(numberOr(source.briefMinutes, base.briefMinutes))),
    pauseMinutes: Math.max(0, Math.round(numberOr(source.pauseMinutes, base.pauseMinutes))),
    awardsMinutes: Math.max(0, Math.round(numberOr(source.awardsMinutes, base.awardsMinutes))),
    includeGirls: Boolean(source.includeGirls),
    boys: mergeCategory(source.boys, base.boys),
    girls: mergeCategory(source.girls, base.girls),
  };
}

function loadInput(): PlannerInput {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? mergeInput(JSON.parse(stored)) : DEFAULT_PLANNER_INPUT;
  } catch {
    return DEFAULT_PLANNER_INPUT;
  }
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-navy-100 bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-display text-[13px] font-medium uppercase tracking-[0.16em] text-graphite-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className="field-input"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(event) => {
          const next = event.target.value === "" ? 0 : Math.round(Number(event.target.value));
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
    </Field>
  );
}

function distributionHint(dist: CategoryDistribution | undefined): string {
  if (!dist || dist.participants < 2) return "";
  if (dist.left < 0) {
    return `В финалах ${dist.explicit} мест, а участников ${dist.participants} — на ${-dist.left} больше, чем есть. Уменьшите финал или уберите его.`;
  }
  if (dist.autoIndex >= 0 && dist.autoSize !== null) {
    return `Распределено ${dist.explicit} из ${dist.participants}. Финал ${dist.autoIndex + 1} автоматически получает ${dist.autoSize} — это все оставшиеся.`;
  }
  if (dist.left > 0) {
    return `Распределено ${dist.explicit} из ${dist.participants}, осталось ${dist.left}. Впишите их в финал или оставьте 0 — финал заберёт остаток сам.`;
  }
  return `Распределено ${dist.explicit} из ${dist.participants} — все участники заняты.`;
}

const VERDICT_STYLES: Record<PlannerResult["verdictTone"], string> = {
  ok: "border-emerald-600 bg-emerald-50 text-emerald-900",
  warn: "border-amber-500 bg-amber-50 text-amber-900",
  bad: "border-accent-600 bg-accent-50 text-accent-800",
  info: "border-navy-300 bg-navy-50 text-navy-900",
};

function StatCard({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "break-inside-avoid border p-5",
        accent ? "border-navy-200 bg-navy-50" : "border-navy-100 bg-white",
      )}
    >
      <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-graphite-500">{label}</span>
      <strong
        className={cn(
          "mt-2 block font-display text-[30px] leading-none tabular-nums",
          accent ? "text-navy-800" : "text-navy-900",
        )}
      >
        {value}
      </strong>
      <span className="mt-2 block text-xs leading-relaxed text-graphite-500">{note}</span>
    </div>
  );
}

export default function PlannerPage() {
  const [input, setInput] = useState<PlannerInput>(loadInput);
  const plan = useMemo(() => calculatePlan(input), [input]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      // Приватный режим браузера может запрещать запись — страница продолжает работать.
    }
  }, [input]);

  useEffect(() => {
    document.body.classList.add("planner-print");
    return () => document.body.classList.remove("planner-print");
  }, []);

  const updateCategory = (category: Category, patch: Partial<CategoryInput>) =>
    setInput((prev) => ({ ...prev, [category]: { ...prev[category], ...patch } }));

  const addFinal = (category: Category) =>
    setInput((prev) => ({
      ...prev,
      [category]: { ...prev[category], finals: [...prev[category].finals, { system: "rr" as FinalSystem, size: 0 }] },
    }));

  const updateFinal = (category: Category, index: number, patch: { system?: FinalSystem; size?: number }) =>
    setInput((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        finals: prev[category].finals.map((final, i) => (i === index ? { ...final, ...patch } : final)),
      },
    }));

  const removeFinal = (category: Category, index: number) =>
    setInput((prev) => ({
      ...prev,
      [category]: { ...prev[category], finals: prev[category].finals.filter((_, i) => i !== index) },
    }));

  const addDay = () =>
    setInput((prev) => ({ ...prev, extraDays: [...prev.extraDays, { start: prev.start, end: prev.deadline }] }));

  const updateDay = (index: number, field: "start" | "end", value: string) =>
    setInput((prev) => ({
      ...prev,
      extraDays: prev.extraDays.map((day, i) => (i === index ? { ...day, [field]: value } : day)),
    }));

  const removeDay = (index: number) =>
    setInput((prev) => ({ ...prev, extraDays: prev.extraDays.filter((_, i) => i !== index) }));

  const reset = () => {
    setInput(DEFAULT_PLANNER_INPUT);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // см. выше: без сохранения страница тоже работает
    }
  };

  const renderFinals = (category: Category) => {
    const finals = input[category].finals;
    return (
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-graphite-700">Финалы</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => addFinal(category)}>
            <Plus size={14} aria-hidden="true" /> Добавить
          </button>
        </div>
        {finals.length === 0 && (
          <p className="text-xs leading-relaxed text-graphite-500">
            Финалов нет. Если после групп нужен второй этап — добавьте его кнопкой выше.
          </p>
        )}
        <div className="space-y-2">
          {finals.map((final, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_76px_40px] items-center gap-2">
              <select
                className="field-input"
                aria-label={`Система финала ${index + 1}`}
                value={final.system}
                onChange={(event) => updateFinal(category, index, { system: event.target.value as FinalSystem })}
              >
                {FINAL_SYSTEMS.map((system) => (
                  <option key={system.value} value={system.value}>
                    {system.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="field-input"
                inputMode="numeric"
                min={0}
                step={1}
                aria-label={`Участников в финале ${index + 1}`}
                value={final.size === 0 ? "" : final.size}
                placeholder="0"
                onChange={(event) => {
                  const next = event.target.value === "" ? 0 : Math.max(0, Math.round(Number(event.target.value)));
                  updateFinal(category, index, { size: Number.isFinite(next) ? next : 0 });
                }}
              />
              <button
                type="button"
                className="flex h-11 w-10 items-center justify-center border border-navy-200 text-graphite-500 transition-colors hover:border-accent-600 hover:text-accent-600"
                aria-label={`Удалить финал ${index + 1}`}
                onClick={() => removeFinal(category, index)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-graphite-500">{distributionHint(plan.distribution.find((item) => item.category === category))}</p>
      </div>
    );
  };

  const printTitle = (
    <div className="mb-6 hidden print:block">
      <p className="section-label">Планировщик</p>
      <h1 className="mt-2 font-display text-3xl uppercase text-navy-900">Хронометраж соревнований</h1>
      <p className="mt-1 text-sm text-graphite-600">
        {input.start}–{input.deadline}
        {input.extraDays.length > 0 ? ` и ещё ${input.extraDays.length} дн.` : ""} · столы: {input.tables} · группы{" "}
        {input.prelimMinutes} мин, финалы {input.finalMinutes} мин
      </p>
    </div>
  );

  return (
    <>
      <Seo
        title="Калькулятор времени соревнований — настольный теннис, Гродно"
        description="Расчёт времени турнира по настольному теннису: группы, финалы по системам, число столов, расписание по дням и проверка, успевает ли соревнование закончиться к награждению."
        path="/planner"
      />

      <div className="print:hidden">
        <PageHero
          label="Планировщик"
          title="Хронометраж соревнований"
          description="Посчитайте, сколько времени займёт турнир: группы, финалы, столы и расписание по дням. Расчёт идёт по волнам туров, а не делением всех матчей на столы."
          crumbs={[{ label: "Календарь", to: "/kalendar" }, { label: "Планировщик" }]}
          compact
        >
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> Печать или PDF
            </button>
            <button type="button" className="btn btn-light" onClick={reset}>
              <RotateCcw size={16} aria-hidden="true" /> Сбросить
            </button>
          </div>
        </PageHero>
      </div>

      <section className="section bg-mist">
        <div className="container-site">
          {printTitle}

          <div className="grid gap-5 lg:grid-cols-2 print:hidden">
            <div className="space-y-5">
              <Panel
                title="Данные соревнования"
                action={
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addDay}>
                    <Plus size={14} aria-hidden="true" /> День
                  </button>
                }
              >
                <div className="space-y-2">
                  <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-2">
                    <span className="text-[13px] font-medium text-graphite-600">День 1</span>
                    <input
                      type="text"
                      className="field-input"
                      inputMode="numeric"
                      maxLength={5}
                      aria-label="Начало дня 1"
                      placeholder={DEFAULT_PLANNER_INPUT.start}
                      value={input.start}
                      onChange={(event) => setInput((prev) => ({ ...prev, start: event.target.value }))}
                      onBlur={() => setInput((prev) => ({ ...prev, start: normalizeTime(prev.start, DEFAULT_PLANNER_INPUT.start) }))}
                    />
                    <input
                      type="text"
                      className="field-input"
                      inputMode="numeric"
                      maxLength={5}
                      aria-label="Конец дня 1"
                      placeholder={DEFAULT_PLANNER_INPUT.deadline}
                      value={input.deadline}
                      onChange={(event) => setInput((prev) => ({ ...prev, deadline: event.target.value }))}
                      onBlur={() =>
                        setInput((prev) => ({ ...prev, deadline: normalizeTime(prev.deadline, DEFAULT_PLANNER_INPUT.deadline) }))
                      }
                    />
                    <span aria-hidden="true" />
                  </div>

                  {input.extraDays.map((day, index) => (
                    <div key={index} className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-2">
                      <span className="text-[13px] font-medium text-graphite-600">День {index + 2}</span>
                      <input
                        type="text"
                        className="field-input"
                        inputMode="numeric"
                        maxLength={5}
                        aria-label={`Начало дня ${index + 2}`}
                        value={day.start}
                        onChange={(event) => updateDay(index, "start", event.target.value)}
                        onBlur={() => updateDay(index, "start", normalizeTime(day.start, input.start))}
                      />
                      <input
                        type="text"
                        className="field-input"
                        inputMode="numeric"
                        maxLength={5}
                        aria-label={`Конец дня ${index + 2}`}
                        value={day.end}
                        onChange={(event) => updateDay(index, "end", event.target.value)}
                        onBlur={() => updateDay(index, "end", normalizeTime(day.end, input.deadline))}
                      />
                      <button
                        type="button"
                        className="flex h-11 w-10 items-center justify-center border border-navy-200 text-graphite-500 transition-colors hover:border-accent-600 hover:text-accent-600"
                        aria-label={`Удалить день ${index + 2}`}
                        onClick={() => removeDay(index)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 border-t border-navy-100 pt-4 sm:grid-cols-3">
                  <NumberField
                    label="Столов"
                    min={1}
                    value={input.tables}
                    onChange={(value) => setInput((prev) => ({ ...prev, tables: Math.max(1, value) }))}
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-graphite-500">
                  Слева начало дня, справа конец. Столов — на все дни.
                </p>
              </Panel>

              <Panel title="Параметры">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Матч в группах, мин"
                    min={1}
                    value={input.prelimMinutes}
                    onChange={(value) => setInput((prev) => ({ ...prev, prelimMinutes: Math.max(1, value) }))}
                  />
                  <NumberField
                    label="Матч в финалах, мин"
                    min={1}
                    value={input.finalMinutes}
                    onChange={(value) => setInput((prev) => ({ ...prev, finalMinutes: Math.max(1, value) }))}
                  />
                  <NumberField
                    label="Сбор и брифинг, мин"
                    value={input.briefMinutes}
                    onChange={(value) => setInput((prev) => ({ ...prev, briefMinutes: Math.max(0, value) }))}
                  />
                  <NumberField
                    label="Перерыв между этапами, мин"
                    value={input.pauseMinutes}
                    onChange={(value) => setInput((prev) => ({ ...prev, pauseMinutes: Math.max(0, value) }))}
                  />
                  <NumberField
                    label="Награждение, мин"
                    value={input.awardsMinutes}
                    onChange={(value) => setInput((prev) => ({ ...prev, awardsMinutes: Math.max(0, value) }))}
                  />
                </div>
              </Panel>
            </div>

            <div className="space-y-5">
              <Panel title="Юноши">
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField
                    label="Участников"
                    min={2}
                    value={input.boys.participants}
                    onChange={(value) => updateCategory("boys", { participants: Math.max(0, value) })}
                  />
                  <NumberField
                    label="Групп"
                    min={1}
                    value={input.boys.groups}
                    onChange={(value) => updateCategory("boys", { groups: Math.max(0, value) })}
                  />
                  <NumberField
                    label="Стыковые матчи"
                    value={input.boys.extra}
                    onChange={(value) => updateCategory("boys", { extra: Math.max(0, value) })}
                  />
                </div>
                {renderFinals("boys")}
              </Panel>

              <Panel title="Девушки">
                <label className="mb-4 flex cursor-pointer items-center gap-3 border border-navy-100 bg-mist px-4 py-3 text-sm text-graphite-800">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-accent-600"
                    checked={input.includeGirls}
                    onChange={(event) => setInput((prev) => ({ ...prev, includeGirls: event.target.checked }))}
                  />
                  Считать девушек на тех же столах
                </label>

                {input.includeGirls ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <NumberField
                        label="Участников"
                        min={2}
                        value={input.girls.participants}
                        onChange={(value) => updateCategory("girls", { participants: Math.max(0, value) })}
                      />
                      <NumberField
                        label="Групп"
                        min={1}
                        value={input.girls.groups}
                        onChange={(value) => updateCategory("girls", { groups: Math.max(0, value) })}
                      />
                      <NumberField
                        label="Стыковые матчи"
                        value={input.girls.extra}
                        onChange={(value) => updateCategory("girls", { extra: Math.max(0, value) })}
                      />
                    </div>
                    {renderFinals("girls")}
                  </>
                ) : (
                  <p className="text-xs leading-relaxed text-graphite-500">
                    Отметьте, если девушки играют в тот же день на тех же столах — иначе расчёт идёт только по юношам.
                  </p>
                )}
              </Panel>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div className={cn("border-l-4 px-5 py-4 text-[15px] leading-relaxed", VERDICT_STYLES[plan.verdictTone])}>
              {plan.verdictText}
            </div>

            {!plan.blank && !plan.hasErrors && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Всего матчей"
                    value={String(plan.matchesTotal)}
                    note={`${plan.groupMatches} в группах + ${plan.finalMatches} в финалах`}
                  />
                  <StatCard
                    label="Чистое время игры"
                    value={formatDuration(plan.playMinutes)}
                    note={`${plan.tableMinutes} столов-минут на ${input.tables} столах`}
                  />
                  <StatCard
                    accent
                    label="Финиш"
                    value={formatMinutes(plan.finishMinutes)}
                    note={`${plan.daysUsed > 1 ? `день ${plan.daysUsed} · ` : ""}${
                      plan.marginMinutes >= 0
                        ? `запас ${formatDuration(plan.marginMinutes)}`
                        : `перебор ${formatDuration(-plan.marginMinutes)}`
                    }`}
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="break-inside-avoid border border-navy-100 bg-white p-5 sm:p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <Table2 size={16} className="text-accent-600" aria-hidden="true" />
                      <h2 className="font-display text-[13px] font-medium uppercase tracking-[0.16em] text-graphite-500">Групповой этап</h2>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-navy-100 text-[11px] uppercase tracking-[0.1em] text-graphite-500">
                          <th className="py-2 pr-3 text-left font-medium">Группа</th>
                          <th className="py-2 pr-3 text-right font-medium">Игроков</th>
                          <th className="py-2 pr-3 text-right font-medium">Матчей</th>
                          <th className="py-2 text-right font-medium">Туров</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-50">
                        {plan.groups.map((group) => (
                          <tr key={group.label}>
                            <td className="py-2 pr-3 text-graphite-800">{group.label}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{group.size}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{group.matches}</td>
                            <td className="py-2 text-right tabular-nums">{group.rounds}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-xs leading-relaxed text-graphite-500">
                      Матчей: {plan.preliminary.matches}, туров: {plan.preliminary.rounds}, волн на столах: {plan.preliminary.waves} ×{" "}
                      {input.prelimMinutes} мин = {plan.preliminary.minutes} мин.
                    </p>
                  </section>

                  <section className="break-inside-avoid border border-navy-100 bg-white p-5 sm:p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <TimerReset size={16} className="text-accent-600" aria-hidden="true" />
                      <h2 className="font-display text-[13px] font-medium uppercase tracking-[0.16em] text-graphite-500">Финальный этап</h2>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-navy-100 text-[11px] uppercase tracking-[0.1em] text-graphite-500">
                          <th className="py-2 pr-3 text-left font-medium">Финал</th>
                          <th className="py-2 pr-3 text-right font-medium">Игроков</th>
                          <th className="py-2 text-right font-medium">Матчей</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-50">
                        {plan.finals.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-3 text-graphite-500">
                              Финалы не заданы
                            </td>
                          </tr>
                        )}
                        {plan.finals.map((final) => (
                          <tr key={final.label}>
                            <td className="py-2 pr-3 text-graphite-800">{final.label}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{final.size || "—"}</td>
                            <td className="py-2 text-right tabular-nums">{final.matches}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-xs leading-relaxed text-graphite-500">
                      Матчей: {plan.finalStage.matches} (круговые {plan.finalStage.roundRobinMatches}, олимпийские{" "}
                      {plan.finalStage.olympicMatchesCount}
                      {plan.finalStage.extraMatches ? `, стыковые ${plan.finalStage.extraMatches}` : ""}), волн:{" "}
                      {plan.finalStage.waves} × {input.finalMinutes} мин = {plan.finalStage.minutes} мин.
                    </p>
                  </section>
                </div>

                <section className="break-inside-avoid border border-navy-100 bg-white p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <CalendarDays size={16} className="text-accent-600" aria-hidden="true" />
                    <h2 className="font-display text-[13px] font-medium uppercase tracking-[0.16em] text-graphite-500">
                      {plan.daysUsed > 1 ? "Расписание по дням" : "Расписание дня"}
                    </h2>
                  </div>
                  <ol className="space-y-1">
                    {plan.timeline.map((day) => (
                      <li key={day.number} className="break-inside-avoid">
                        {plan.daysUsed > 1 && (
                          <p className="mt-3 border-b border-navy-100 pb-2 font-display text-[12px] uppercase tracking-[0.12em] text-graphite-500">
                            День {day.number}: {day.window} · финиш {day.finish}
                          </p>
                        )}
                        <ul className="divide-y divide-navy-50">
                          {day.events.map((event, index) => (
                            <li key={index} className="flex gap-4 py-2.5">
                              <span className="w-[118px] shrink-0 tabular-nums text-sm text-graphite-500">
                                {event.from}–{event.to}
                              </span>
                              <span>
                                <b className="block text-[15px] font-semibold text-navy-900">{event.title}</b>
                                <small className="text-[13px] text-graphite-500">{event.note}</small>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </section>

                <div className="flex items-start gap-2 text-xs leading-relaxed text-graphite-500">
                  <Clock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <p>
                    Время считается по турам и по вашим {input.prelimMinutes} и {input.finalMinutes} минутам, а не делением всех
                    матчей на столы. Круговая — все со всеми; олимпийская −1 разыгрывает все места, −2 добавляет вторую сетку.
                    Введённые данные сохраняются в этом браузере.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
