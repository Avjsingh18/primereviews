// Deletes everything we hold for one user. Every table that stores user data cascades from the auth user, so the final
// step removes any remainder; the explicit steps first keep the result predictable and clear sessions straight away.
type StepResult = { error: unknown };
export type DeletionClient = {
  from(table: string): { delete(): { eq(column: string, value: string): PromiseLike<StepResult> } };
  storage: { from(bucket: string): { list(path: string, options: { search: string; limit: number }): PromiseLike<{ data: Array<{ name: string }> | null }>; remove(paths: string[]): PromiseLike<StepResult> } };
  auth: { admin: { deleteUser(userId: string): PromiseLike<StepResult> } };
};

export async function deleteAccountData(db: DeletionClient, userId: string) {
  // Legacy generated-artwork files are named "<user id>_<hash>.webp"; removing them is best effort.
  try {
    const listing = await db.storage.from("qr-artwork").list("", { search: userId, limit: 100 });
    const names = (listing.data ?? []).map((file) => file.name).filter((name) => name.startsWith(`${userId}_`));
    if (names.length) await db.storage.from("qr-artwork").remove(names);
  } catch { /* The daily maintenance job also sweeps these files. */ }
  for (const [table, column] of [["app_sessions", "user_id"], ["reviewflow_cache", "owner_id"], ["businesses", "user_id"]] as const) {
    const { error } = await db.from(table).delete().eq(column, userId);
    if (error) throw new Error(`Could not delete ${table}`);
  }
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error("Could not delete the sign-in account");
}
