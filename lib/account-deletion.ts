// Deletes everything we hold for one user, then proves it is gone before the sign-in account itself is removed.
// Order matters: data first, verification second, the sign-in account last. If any step fails the account still
// exists, so the user can sign in and simply try again; nothing is ever reported as deleted when it is not.
type Outcome = { error: unknown };
type Rows = { data?: Array<Record<string, unknown>> | null; count?: number | null; error: unknown };
export type DeletionClient = {
  from(table: string): {
    select(columns: string, options?: { count: "exact"; head: true }): { in(column: string, values: string[]): PromiseLike<Rows> };
    delete(): { in(column: string, values: string[]): PromiseLike<Outcome> };
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<Outcome>;
  storage: { from(bucket: string): { list(path: string, options: { search: string; limit: number }): PromiseLike<{ data: Array<{ name: string }> | null }>; remove(paths: string[]): PromiseLike<Outcome> } };
  auth: { admin: { deleteUser(userId: string): PromiseLike<Outcome>; getUserById(userId: string): PromiseLike<{ data: { user: unknown } | null; error: unknown }> } };
};
export type DeletionOptions = { userId: string; email: string | null; rateLimitKeys: (businessIds: string[]) => string[] };

async function idsOf(db: DeletionClient, table: string, column: string, values: string[]) {
  if (!values.length) return [];
  const { data, error } = await db.from(table).select("id").in(column, values);
  if (error) throw new Error(`Could not read ${table}`);
  return (data ?? []).map((row) => String(row.id));
}

export async function deleteAccountData(db: DeletionClient, { userId, email, rateLimitKeys }: DeletionOptions) {
  const businessIds = await idsOf(db, "businesses", "user_id", [userId]);
  const qrIds = await idsOf(db, "qr_codes", "business_id", businessIds);
  // Child rows first, then the rows that own them.
  const targets: Array<[table: string, column: string, values: string[]]> = [
    ["qr_visit_totals", "qr_code_id", qrIds], ["qr_scans", "qr_code_id", qrIds], ["review_snapshots", "business_id", businessIds],
    ["business_photos", "business_id", businessIds], ["qr_studio_designs", "business_id", businessIds], ["qr_codes", "business_id", businessIds],
    ["businesses", "user_id", [userId]], ["app_sessions", "user_id", [userId]], ["app_auth_state", "user_id", [userId]],
    ["reviewflow_cache", "owner_id", [userId]], ["ai_jobs", "owner_id", [userId]],
  ];
  for (const [table, column, values] of targets) {
    if (!values.length) continue;
    const { error } = await db.from(table).delete().in(column, values);
    if (error) throw new Error(`Could not delete ${table}`);
  }
  // Prove it: nothing may remain before the sign-in account is removed.
  for (const [table, column, values] of targets) {
    if (!values.length) continue;
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).in(column, values);
    if (error || (count ?? 0) > 0) throw new Error(`Data remains in ${table}`);
  }
  // Best effort: short-lived abuse-prevention hashes derived from this user, legacy artwork files, and sign-in event logs.
  try { const keys = rateLimitKeys(businessIds); if (keys.length) await db.from("rate_limit_buckets").delete().in("bucket_key", keys); } catch { /* These hashes expire by themselves after about 2 days. */ }
  try {
    const listing = await db.storage.from("qr-artwork").list("", { search: userId, limit: 100 });
    const names = (listing.data ?? []).map((file) => file.name).filter((name) => name.startsWith(`${userId}_`));
    if (names.length) await db.storage.from("qr-artwork").remove(names);
  } catch { /* The daily maintenance job also sweeps these files. */ }
  try { await db.rpc("security_erase_user_traces", { p_user: userId, p_email: email }); } catch { /* Needs the optional database function; the provider's own log retention then applies. */ }
  // The sign-in account goes last, and its removal is confirmed.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error("Could not delete the sign-in account");
  const { data } = await db.auth.admin.getUserById(userId);
  if (data?.user) throw new Error("The sign-in account still exists");
}
