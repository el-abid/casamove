export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startRenewalScheduler } = await import("@/lib/agent/scheduler");
  startRenewalScheduler();
}
