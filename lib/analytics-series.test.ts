import assert from "node:assert/strict";
import test from "node:test";
import { dailyScanSeries, dailySnapshotSeries } from "./analytics-series";

test("daily snapshot series carries the last confirmed metric through the selected range", () => {
  const result = dailySnapshotSeries([
    { snapshot_date: "2026-10-01", rating: 4.7 },
    { snapshot_date: "2026-10-03", rating: 4.9 },
  ], "2026-10-01", "2026-10-04", "rating");
  assert.deepEqual(result, [
    { date: "2026-10-01", value: 4.7 }, { date: "2026-10-02", value: 4.7 },
    { date: "2026-10-03", value: 4.9 }, { date: "2026-10-04", value: 4.9 },
  ]);
});

test("daily QR scan series includes zero-scan days instead of connecting unrelated visits", () => {
  assert.deepEqual(dailyScanSeries([{ visit_date: "2026-10-02", visits: 3 }], "2026-10-01", "2026-10-03"), [
    { date: "2026-10-01", value: 0 }, { date: "2026-10-02", value: 3 }, { date: "2026-10-03", value: 0 },
  ]);
});
