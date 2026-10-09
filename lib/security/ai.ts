import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { HttpError } from "./http";

type Feature = "qr" | "competitors";
const approvedModels = { qr: "gpt-image-2.5-flare", competitors: "gpt-5.5" };
function cents(name: string) {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1000000) throw new HttpError(503, "AI spending protection is not configured.");
  return value;
}
export function aiConfiguration(feature: Feature) {
  // Local tests must never reach hosted storage, auth, or a paid provider.
  if (process.env.REVIEWFLOW_LOCAL_BACKEND === "true" || process.env.AI_ENABLED !== "true" || process.env.AI_PRICING_VERIFIED !== "true" || !process.env.OPENAI_API_KEY) throw new HttpError(503, "AI features are currently unavailable.");
  const model = process.env[feature === "qr" ? "QR_DESIGN_IMAGE_MODEL" : "COMPETITOR_SEARCH_MODEL"] || approvedModels[feature];
  if (model !== approvedModels[feature]) throw new HttpError(503, "The AI model requires a reviewed spending configuration.");
  return { apiKey: process.env.OPENAI_API_KEY, model, cost: cents(feature === "qr" ? "AI_QR_MAX_CALL_CENTS" : "AI_SEARCH_MAX_CALL_CENTS"), globalDay: cents("AI_GLOBAL_DAILY_CENTS"), globalMonth: cents("AI_GLOBAL_MONTHLY_CENTS"), userDay: cents("AI_USER_DAILY_CENTS"), userMonth: cents("AI_USER_MONTHLY_CENTS") };
}
export function aiCacheKey(feature: Feature, owner: string, parameters: unknown) {
  return `${feature}:${createHash("sha256").update(JSON.stringify([owner, parameters])).digest("hex")}`;
}
export async function reserveAi(key: string, owner: string, feature: Feature) {
  const config = aiConfiguration(feature);
  const { data, error } = await supabaseAdmin().rpc("security_reserve_ai", { p_key: key, p_owner: owner, p_cost: config.cost, p_global_day: config.globalDay, p_global_month: config.globalMonth, p_user_day: config.userDay, p_user_month: config.userMonth });
  if (error || !data) throw new HttpError(503, "AI spending protection is unavailable.");
  if (!data.allowed) throw new HttpError(429, data.busy ? "An AI request is already running. Please try again later." : "The AI usage limit has been reached.");
  return { ...config, reservation: String(data.reservation_id) };
}
export async function finishAi(key: string, reservation: string, state: "complete" | "failed") {
  // A failed write leaves the lease occupied until expiry. Never refund a call.
  const { error } = await supabaseAdmin().from("ai_jobs").update({ state }).eq("cache_key", key).eq("reservation_id", reservation);
  if (error) throw new Error("AI job storage unavailable");
}
