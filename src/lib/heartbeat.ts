// Records when the class monitor last ran, so /api/health can warn if the worker stops.
// Kept on globalThis because route handlers can be bundled separately but share one process.
const g = globalThis as unknown as { __siloraMonitor?: { startedAt: number; lastTickAt?: number } };
const state = (g.__siloraMonitor ??= { startedAt: Date.now() });

export const MONITOR_STALE_MS = 5 * 60_000;

export function recordMonitorTick(at = Date.now()) {
  state.lastTickAt = at;
}

/** Healthy if the monitor ran recently, or the app started too recently to expect a run yet. */
export function monitorHealth(now = Date.now()) {
  const last = state.lastTickAt ?? state.startedAt;
  return { ok: now - last < MONITOR_STALE_MS, lastTickAt: state.lastTickAt ? new Date(state.lastTickAt).toISOString() : null };
}
