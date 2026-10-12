// Runs a clean-up step and logs which one failed (error code and status only, never tokens, passwords or emails)
// without failing the request. Use it only after the main action has already succeeded.
export async function bestEffort(route: string, step: string, run: () => Promise<unknown>) {
  try { await run(); } catch (cause) {
    const detail = cause as { code?: unknown; status?: unknown };
    console.error(`${route}: ${step} failed`, detail?.code ?? "", detail?.status ?? "");
  }
}
