// Vercel production builds must fail before publishing an unsafe configuration.
// Local/CI fixtures are intentionally separate and never require hosted secrets.
if (process.env.VERCEL_ENV !== "production") process.exit(0);
const failures = [];
if (process.env.REVIEWFLOW_LOCAL_BACKEND === "true") failures.push("local backend enabled");
for(const name of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY"]) if(!process.env[name]) failures.push(`${name} missing`);
try { const url=new URL(process.env.NEXT_PUBLIC_SITE_URL); if(url.protocol!=="https:" || url.username || url.password || /^(localhost|127\.)/.test(url.hostname)) throw new Error(); } catch { failures.push("NEXT_PUBLIC_SITE_URL must be the public HTTPS origin"); }
for(const name of ["SESSION_ENCRYPTION_KEY","DATABASE_API_SECRET"]) if(!/^[a-f0-9]{64}$/i.test(process.env[name] || "")) failures.push(`${name} must be an independent 32-byte hex key`);
for(const name of ["RATE_LIMIT_SECRET","CRON_SECRET"]) if((process.env[name] || "").length<32) failures.push(`${name} too short or missing`);
const secrets=["SESSION_ENCRYPTION_KEY","DATABASE_API_SECRET","RATE_LIMIT_SECRET","CRON_SECRET"].map(name=>process.env[name]).filter(Boolean);
if(new Set(secrets).size!==secrets.length) failures.push("security keys must not be reused");
if(process.env.AI_ENABLED === "true") {
  if(!process.env.OPENAI_API_KEY || process.env.AI_PRICING_VERIFIED!=="true") failures.push("AI key/pricing review missing");
  for(const name of ["AI_QR_MAX_CALL_CENTS","AI_GLOBAL_DAILY_CENTS","AI_GLOBAL_MONTHLY_CENTS","AI_USER_DAILY_CENTS","AI_USER_MONTHLY_CENTS"]) {
    const value=Number(process.env[name]); if(!Number.isSafeInteger(value) || value<1 || value>1000000) failures.push(`${name} invalid`);
  }
}
if(failures.length) { console.error("Production release blocked:\n"+failures.join("\n")); process.exit(1); }
import("node:fs").then(({ readFileSync }) => { const open = (readFileSync("lib/legal-config.ts", "utf8").match(/"\[[^"]+\]"/g) || []).length; if (open) console.warn(`WARNING: ${open} legal detail(s) in lib/legal-config.ts are still [placeholders]. Fill them in and have a lawyer review the legal pages before relying on them.`); });
console.log("Production environment shape checks passed. This does not verify hosted migration, WAF or provider billing settings; complete the release checklist.");
