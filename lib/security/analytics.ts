import { NextRequest } from "next/server";
import { HttpError } from "./http";

export function dateWindow(request: NextRequest) {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(); from.setUTCDate(from.getUTCDate() - 29);
  const start = request.nextUrl.searchParams.get("start") || from.toISOString().slice(0, 10);
  const end = request.nextUrl.searchParams.get("end") || today;
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(start) || !valid(end) || start > end || end > today || Date.parse(end) - Date.parse(start) > 365 * 86400000) throw new HttpError(400, "Choose a valid date range of up to one year.");
  return { start, end };
}
