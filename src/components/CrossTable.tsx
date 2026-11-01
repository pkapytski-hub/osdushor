import { cn } from "@/lib/utils";
import type { TournamentMatch, TournamentStanding } from "@/lib/types";

export interface CrossTableProps {
  title?: string;
  standings: TournamentStanding[];
  matches: TournamentMatch[];
  className?: string;
}

/** Очки в круговой системе: победа — 2, поражение — 1, техническое поражение — 0. */
const WIN_POINTS = 2;
const LOSS_POINTS = 1;
const TECH_LOSS_POINTS = 0;

const RED = "text-red-600";
const BLUE = "text-blue-700";

/**
 * Классическая турнирная таблица настольного тенниса («шахматка» / cross-table).
 * Строки и столбцы — участники по номерам посева (1..N), по диагонали — тёмное поле.
 * В ячейке сверху очки за встречу (2 — победа, 1 — поражение, 0 — техническое
 * поражение), снизу счёт по сетам. Справа — сумма очков и место в группе.
 */
export function CrossTable({ title, standings, matches, className }: CrossTableProps) {
  // Порядок строк и столбцов строго по посевному номеру (№1..N), как в протоколе
  const ordered = [...standings].sort((a, b) => (a.seed || 999) - (b.seed || 999));

  const matchMap = new Map<string, TournamentMatch>();
  for (const m of matches) {
    matchMap.set(`${m.player_a}|${m.player_b}`, m);
  }

  function cellInfo(playerId: string, opponentId: string) {
    const match = matchMap.get(`${playerId}|${opponentId}`) ?? matchMap.get(`${opponentId}|${playerId}`);
    if (!match) return null;

    const isA = match.player_a === playerId;
    const myScore = isA ? match.score_a : match.score_b;
    const theirScore = isA ? match.score_b : match.score_a;
    if (myScore === null || theirScore === null) return null;

    const techLoss = isA ? Boolean(match.tech_loss_a) : Boolean(match.tech_loss_b);
    const won = match.winner_id ? match.winner_id === playerId : myScore > theirScore;
    const points = techLoss ? TECH_LOSS_POINTS : won ? WIN_POINTS : LOSS_POINTS;

    return { points, myScore, theirScore, won, techLoss };
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table
        className="w-full min-w-[640px] border-collapse border border-graphite-500 bg-white text-center"
        aria-label={title ?? "Круговая таблица"}
      >
        <thead>
          <tr className="bg-graphite-100">
            <th scope="col" className="w-8 border border-graphite-500 px-1 py-1.5 font-display text-[12px] font-bold text-graphite-900">
              №
            </th>
            <th scope="col" className="w-48 border border-graphite-500 px-2 py-1.5 text-left font-display text-[12px] font-bold text-graphite-900">
              участник
            </th>
            {ordered.map((player, index) => (
              <th
                key={player.athlete_id}
                scope="col"
                className="w-12 border border-graphite-500 px-1 py-1.5 font-display text-[12px] font-bold text-graphite-900"
              >
                {player.seed || index + 1}
              </th>
            ))}
            <th scope="col" className="w-14 border border-graphite-500 px-1 py-1.5 font-display text-[12px] font-bold text-graphite-900">
              Очки
            </th>
            <th scope="col" className="w-14 border border-graphite-500 px-1 py-1.5 font-display text-[12px] font-bold text-graphite-900">
              Место
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, rowIndex) => {
            const points = typeof row.points === "number" ? row.points : row.wins * WIN_POINTS + row.losses * LOSS_POINTS;

            return (
              <tr key={row.athlete_id}>
                <td className="border border-graphite-500 px-1 py-1 font-display text-[13px] font-bold text-graphite-900">
                  {row.seed || rowIndex + 1}
                </td>
                <td className="border border-graphite-500 px-2 py-1 text-left text-[13px] font-medium text-graphite-900 whitespace-nowrap">
                  {row.full_name}
                </td>

                {ordered.map((col) => {
                  if (col.athlete_id === row.athlete_id) {
                    return (
                      <td
                        key={col.athlete_id}
                        className="border border-graphite-500 bg-graphite-600"
                        aria-label="—"
                      />
                    );
                  }

                  const cell = cellInfo(row.athlete_id, col.athlete_id);
                  if (!cell) {
                    return (
                      <td
                        key={col.athlete_id}
                        className="border border-graphite-500 px-1 py-1 text-[11px] text-graphite-300"
                      >
                        ·
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col.athlete_id}
                      className="border border-graphite-500 px-1 py-0.5 align-middle leading-tight select-none"
                      title={cell.techLoss ? "Техническое поражение" : undefined}
                    >
                      <div
                        className={cn(
                          "font-display text-[13px] font-bold leading-none",
                          cell.techLoss ? "text-graphite-500" : cell.won ? RED : BLUE,
                        )}
                      >
                        {cell.points}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 font-display text-[11px] font-semibold leading-none",
                          cell.won ? RED : BLUE,
                        )}
                      >
                        {cell.myScore}-{cell.theirScore}
                      </div>
                    </td>
                  );
                })}

                <td className="border border-graphite-500 px-1 py-1 font-display text-[14px] font-bold text-graphite-900">
                  {row.played > 0 ? points : "—"}
                </td>
                <td className="border border-graphite-500 px-1 py-1 font-display text-[14px] font-bold text-red-600">
                  {row.place || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
