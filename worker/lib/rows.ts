export function toNews(row: Record<string, unknown>) {
  return {
    ...row,
    is_demo: Boolean(row.is_demo),
    is_published: Boolean(row.is_published),
  };
}

export function toCompetition(row: Record<string, unknown>) {
  let categories: string[] = [];
  try {
    const parsed = JSON.parse(String(row.age_categories ?? "[]"));
    if (Array.isArray(parsed)) categories = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    categories = [];
  }
  return {
    ...row,
    age_categories: categories,
    is_demo: Boolean(row.is_demo),
    is_published: Boolean(row.is_published),
  };
}

export function toBooleanRow(row: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...row };
  for (const key of ["is_demo", "is_published", "is_indexable"]) {
    if (key in result) result[key] = Boolean(result[key]);
  }
  return result;
}

export function toCount(row: { count?: number } | null): number {
  return row?.count ?? 0;
}
