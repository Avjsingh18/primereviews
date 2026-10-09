type Snapshot = { snapshot_date: string; rating?: number; total_reviews?: number };
type Scan = { visit_date: string; visits: number | bigint };

function dateAtOffset(start: string, offset: number) {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dayCount(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Carries the most recent Google snapshot forward so charts are daily and never invent a change. */
export function dailySnapshotSeries(snapshots: Snapshot[], start: string, end: string, metric: "rating" | "total_reviews") {
  const byDate = new Map(snapshots.map((snapshot) => [snapshot.snapshot_date, Number(snapshot[metric])]));
  let value: number | null = null;
  const result: Array<{ date: string; value: number | null }> = [];
  for (let index = 0; index < dayCount(start, end); index += 1) {
    const date = dateAtOffset(start, index);
    const next = byDate.get(date);
    if (next != null && Number.isFinite(next)) value = next;
    result.push({ date, value });
  }
  return result;
}

/** Emits every date in the range; no-scan days are explicitly zero rather than joined by a misleading line. */
export function dailyScanSeries(scans: Scan[], start: string, end: string) {
  const byDate = new Map(scans.map((scan) => [scan.visit_date, Number(scan.visits)]));
  return Array.from({ length: dayCount(start, end) }, (_, index) => {
    const date = dateAtOffset(start, index);
    return { date, value: byDate.get(date) ?? 0 };
  });
}
