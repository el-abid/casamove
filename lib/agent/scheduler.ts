import { createRenewalSignals } from "./signals";

const DAY = 24 * 60 * 60 * 1000;
const RETRY = 15 * 60 * 1000;

const globalScheduler = globalThis as unknown as {
  __casamoveRenewalScheduler?: boolean;
};

export function startRenewalScheduler() {
  if (process.env.RENEWAL_AUTO === "false") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (globalScheduler.__casamoveRenewalScheduler) return;
  globalScheduler.__casamoveRenewalScheduler = true;

  let firstRunDone = false;

  const run = async () => {
    try {
      const signals = await createRenewalSignals();
      firstRunDone = true;
      if (signals.length > 0) {
        console.info(
          `[renewals] ${signals.length} relance(s) automatique(s) publiée(s)`
        );
      }
    } catch (error) {
      console.warn(
        `[renewals] ${error instanceof Error ? error.message : "erreur"}`
      );
    }
  };

  setTimeout(run, 5_000);
  const retry = setInterval(() => {
    if (!firstRunDone) void run();
  }, RETRY);
  const daily = setInterval(run, DAY);

  // Les timers sont volontairement conservés : ils portent le service proactif.
  void retry;
  void daily;
}
