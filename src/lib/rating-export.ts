import type { AthleteRating } from "@/lib/types";
import type { Row, Sheet, SheetData } from "write-excel-file/universal";

// Ширины в символах: место, место в лиге, имя, год рождения, пол, рейтинг.
const COLUMNS = [{ width: 9 }, { width: 8 }, { width: 40 }, { width: 13 }, { width: 7 }, { width: 11 }];

const HEADER = { fontWeight: "bold", backgroundColor: "#E8EEF5" } as const;

function genderLabel(value: string): string {
  if (value === "f") return "Ж";
  if (value === "m") return "М";
  return "";
}

/** Собирает листы: по одному на каждую лигу, места в лиге считаются заново. */
function buildSheets(items: AthleteRating[]): Sheet<Blob>[] {
  const byLeague = new Map<number, AthleteRating[]>();
  for (const item of items) {
    // Архивные спортсмены вне рейтинга и в лигах не участвуют — в выгрузку не идут.
    if (!item.league || item.place === null) continue;
    const list = byLeague.get(item.league);
    if (list) list.push(item);
    else byLeague.set(item.league, [item]);
  }

  return [...byLeague.entries()]
    .sort(([a], [b]) => a - b)
    .map(([league, rows]) => {
      const data: SheetData = [
        [
          { value: "Место в школе", ...HEADER },
          { value: "Место в лиге", ...HEADER },
          { value: "Спортсмен", ...HEADER },
          { value: "Год рождения", ...HEADER },
          { value: "Пол", ...HEADER },
          { value: "Рейтинг", ...HEADER },
        ],
        ...rows.map((row, index): Row => [
          { value: row.place ?? 0, type: Number, align: "left" },
          { value: index + 1, type: Number, align: "left" },
          { value: row.full_name, type: String },
          row.birth_year ? { value: row.birth_year, type: Number, align: "left" } : null,
          { value: genderLabel(row.gender), type: String },
          { value: Math.round(row.rating), type: Number, format: "0" },
        ]),
      ];

      return { data, sheet: `${league} лига`, columns: COLUMNS, stickyRowsCount: 1 } satisfies Sheet<Blob>;
    });
}

/** Скачивает текущий список рейтинга в .xlsx: листы «1 лига», «2 лига», «3 лига». */
export async function downloadRatingExcel(items: AthleteRating[], fileName?: string): Promise<void> {
  if (items.length === 0) return;
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  const blob = await writeXlsxFile(buildSheets(items)).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName ?? `reiting-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.rel = "noopener";
  link.click();
  // Ссылку освобождаем после того, как браузер начал скачивание.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
