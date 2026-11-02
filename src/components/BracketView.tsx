import type { TournamentMatch, TournamentPlayoffRound } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Высота одной «дорожки» сетки: карточка занимает три дорожки. */
const ROW_HEIGHT = 20;

function groupBlocks(rounds: TournamentPlayoffRound[]): TournamentPlayoffRound[][] {
  const blocks: TournamentPlayoffRound[][] = [];
  const indexByPlace = new Map<string, number>();
  for (const round of rounds) {
    const key = String(round.place_from ?? 0);
    const found = indexByPlace.get(key);
    if (found === undefined) {
      indexByPlace.set(key, blocks.length);
      blocks.push([round]);
      continue;
    }
    blocks[found].push(round);
  }
  return blocks;
}

function blockTitle(block: TournamentPlayoffRound[]): string {
  const from = block[0]?.place_from ?? null;
  if (from === null) return "Плей-офф";
  const to = Math.max(...block.map((round) => round.place_to ?? round.place_from ?? 0));
  if (from === 1) return `Основная сетка · места 1–${to}`;
  return `За места ${from}–${to}`;
}

function MatchCard({ match, places }: { match: TournamentMatch; places?: Map<string, number> }) {
  const played = match.score_a !== null && match.score_b !== null;
  const rows = [
    {
      id: match.player_a,
      name: match.player_a_name,
      score: match.score_a,
      winner: match.winner_id !== null && match.winner_id === match.player_a,
    },
    {
      id: match.player_b,
      name: match.player_b_name,
      score: match.score_b,
      winner: match.winner_id !== null && match.winner_id === match.player_b,
    },
  ];
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-center gap-0.5 border bg-white px-2",
        played ? "border-navy-200" : "border-dashed border-navy-100",
      )}
    >
      {rows.map((row, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-1.5 text-[11px] leading-tight",
            row.winner ? "font-semibold text-navy-900" : played ? "text-graphite-500" : "text-graphite-700",
          )}
        >
          <span className={cn("h-2.5 w-0.5 shrink-0", row.winner ? "bg-accent-600" : "bg-transparent")} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{row.name || "—"}</span>
          {places?.get(row.id) !== undefined && (
            <span
              className="shrink-0 border border-accent-600/40 bg-accent-50 px-1 font-display text-[9px] leading-[1.5] text-accent-700"
              title={`Занятое место: ${places.get(row.id)}`}
            >
              {places.get(row.id)}-е
            </span>
          )}
          <span className={cn("w-4 shrink-0 text-right font-display tabular-nums", row.winner ? "text-navy-900" : "text-graphite-500")}>
            {row.score ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function BlockBracket({ block, places }: { block: TournamentPlayoffRound[]; places?: Map<string, number> }) {
  const firstRoundMatches = block[0]?.matches.length ?? 0;
  const rowsCount = Math.max(firstRoundMatches, 1) * 4;
  const allMatches = block.flatMap((round) => round.matches);
  const played = allMatches.filter((match) => match.score_a !== null && match.score_b !== null).length;
  // Встречи заводятся по мере определения участников, поэтому полное число
  // берём из диапазона мест блока: за N мест играют N − 1 встречу.
  const blockFrom = block[0]?.place_from ?? null;
  const blockTo = block.every((round) => round.place_to !== null)
    ? Math.max(...block.map((round) => Number(round.place_to)))
    : null;
  const planned =
    blockFrom !== null && blockTo !== null ? Math.max(allMatches.length, blockTo - blockFrom) : allMatches.length;

  return (
    <div className="border border-navy-100 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-navy-100 bg-mist px-3.5 py-2">
        <h3 className="font-display text-[12px] uppercase tracking-[0.14em] text-navy-900">{blockTitle(block)}</h3>
        <span className="text-[11px] uppercase tracking-[0.08em] text-graphite-500">
          {played} из {planned} встреч
        </span>
      </div>
      <div className="overflow-x-auto p-3">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${block.length}, minmax(160px, 220px))`,
            gridTemplateRows: `auto repeat(${rowsCount}, ${ROW_HEIGHT}px)`,
            columnGap: "0.75rem",
            rowGap: "4px",
          }}
        >
          {block.map((round, roundIndex) => (
            <div
              key={`${round.place_from ?? 0}:${round.round}`}
              style={{ gridColumn: roundIndex + 1, gridRow: 1 }}
              className="pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-graphite-500"
            >
              {round.label}
            </div>
          ))}
          {block.flatMap((round, roundIndex) =>
            round.matches.map((match, matchIndex) => {
              // Каждая пара стоит напротив своей пары в предыдущем круге:
              // встреча круга r сдвигается на 2^(r+1) дорожек и занимает три.
              const start = 2 ** (roundIndex + 2) * matchIndex + 2 ** (roundIndex + 1) - 1;
              return (
                <div
                  key={match.id}
                  style={{ gridColumn: roundIndex + 1, gridRow: `${start + 1} / span 3` }}
                  className="min-h-0"
                >
                  <MatchCard match={match} places={places} />
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

export function BracketView({
  rounds,
  places,
  className,
}: {
  rounds: TournamentPlayoffRound[];
  /** Занятые места по id спортсмена: показываются рядом с фамилией, как только место определилось. */
  places?: Map<string, number>;
  className?: string;
}) {
  const blocks = groupBlocks(rounds);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("space-y-5", className)}>
      {blocks.map((block) => (
        <BlockBracket key={block[0].place_from ?? block[0].round} block={block} places={places} />
      ))}
    </div>
  );
}
