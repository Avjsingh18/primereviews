import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const fresh = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const paths = new Set([...tracked, ...fresh]);
function tree(path) {
  if (!existsSync(path)) return;
  for (const name of readdirSync(path)) { const child = join(path, name); if (statSync(child).isDirectory()) tree(child); else paths.add(child); }
}
tree(".next/static");
const privateValues = new Map();
for (const file of readdirSync(".").filter(x => x.startsWith(".env") && x !== ".env.example")) {
  if (!statSync(file).isFile()) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_0-9]+)\s*=\s*["']?([^"'\r\n]+?)["']?\s*$/);
    if (match && !match[1].startsWith("NEXT_PUBLIC_") && /SECRET|API_KEY|SERVICE_ROLE|PASSWORD|ENCRYPTION|DATABASE_URL/.test(match[1]) && match[2].length >= 16) privateValues.set(match[1], match[2]);
  }
}
const patterns = [/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/, /\bsb_secret_[A-Za-z0-9_-]{20,}\b/, /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}\b/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[A-Z0-9]{16}\b/];
const failures = [];
for (const file of paths) {
  if (!existsSync(file) || statSync(file).size > 10000000) continue;
  if (tracked.includes(file) && /(?:^|\/)\.env[^/]*$/.test(file) && !file.endsWith(".env.example")) failures.push(`${file}: tracked environment file`);
  if (!/\.(?:[cm]?[jt]sx?|json|ya?ml|sql|md|txt|sh|example|xml|properties)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  if (patterns.some(pattern => pattern.test(content))) failures.push(`${file}: possible credential pattern`);
  for (const [name, value] of privateValues) if (content.includes(value)) failures.push(`${file}: private ${name} value exposed`);
  for (const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try { if (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).role === "service_role") failures.push(`${file}: service-role JWT exposed`); } catch {}
  }
}
if (failures.length) { console.error([...new Set(failures)].join("\n")); process.exit(1); }
if (process.argv.includes("--history")) {
  const history = execFileSync("git", ["log", "--all", "-p", "--format=commit %H", "--", ".", ":(exclude)package-lock.json", ":(exclude)demo-assets/**", ":(exclude)reviewflow-demo/**"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let exposed = patterns.some(pattern => pattern.test(history)) || [...privateValues.values()].some(value => history.includes(value));
  for (const token of history.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try { if (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).role === "service_role") exposed = true; } catch {}
  }
  if (exposed) { console.error("Possible credential found in Git history. Review privately and rotate affected credentials before release; values are not printed."); process.exit(1); }
  console.log("Git history credential-pattern scan passed for all available local refs.");
}
console.log(`Secret scan passed: ${paths.size} source/artifact files; no matching private environment values or credential patterns. This is a release check, not proof of absence of all secrets.`);
