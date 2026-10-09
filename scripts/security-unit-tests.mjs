import { spawnSync } from "node:child_process";
// Explicit disposable fixture values: never load .env or use real provider keys.
const env = { ...process.env, NODE_ENV: process.argv.includes("--production") ? "production" : "test", NEXT_PUBLIC_SUPABASE_URL: "https://supabase.fixture.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-placeholder", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-placeholder", OPENAI_API_KEY: "", REVIEWFLOW_LOCAL_BACKEND: "false" };
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "lib/security/security.test.ts", "lib/competitor-discovery.test.ts", "lib/qr-design.test.ts"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
