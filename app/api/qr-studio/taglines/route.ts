import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api";
import { asCategory, studioTaglines, type QrStudioTone } from "@/lib/qr-studio";
import { json, safeRoute } from "@/lib/security/http";

export const GET = safeRoute(async (request: NextRequest) => {
  const auth = await requireUser(request); if ("response" in auth) return auth.response;
  const category = asCategory(request.nextUrl.searchParams.get("category"));
  const tone: QrStudioTone = request.nextUrl.searchParams.get("tone") === "funny" || request.nextUrl.searchParams.get("tone") === "professional" ? request.nextUrl.searchParams.get("tone") as QrStudioTone : "friendly";
  const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  return json({ category, tone, taglines: studioTaglines(category, tone).filter((tagline) => tagline.toLowerCase().includes(query)) });
});
