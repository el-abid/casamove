"use client";

import { useEffect, useState } from "react";
import type { NetworkStatus } from "@/lib/mobility/store";

export const activeJourneyKey = "casamove-active-journey";
export const recentStationsKey = "casamove-recent-stations";

export function sessionValue<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

export function storeSession(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The current page remains usable when storage is blocked.
  }
}

export class MobilityRequestError extends Error {
  constructor(readonly status: number) {
    super(`Mobility request failed (${status})`);
  }
}

export async function mobilityRequest<T>(
  path: string,
  method = "GET",
  payload?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`/api/mobility/${path}`, {
    method,
    signal,
    cache: "no-store",
    ...(payload !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  });
  if (!response.ok) throw new MobilityRequestError(response.status);
  return response.json() as Promise<T>;
}

export function useNetworkStatus(enabled = true) {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [connection, setConnection] = useState<
    "loading" | "ready" | "offline" | "unavailable"
  >("loading");
  useEffect(() => {
    if (!enabled) return;
    setLastSync(sessionValue<string>("casamove-public-status-time"));
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await mobilityRequest<NetworkStatus>(
          "network/status",
          "GET",
          undefined,
          controller.signal
        );
        setStatus((current) =>
          current?.version === next.version ? current : next
        );
        setLastSync(next.checkedAt);
        storeSession("casamove-public-status-time", next.checkedAt);
        setConnection("ready");
      } catch {
        if (!controller.signal.aborted)
          setConnection(navigator.onLine ? "unavailable" : "offline");
      } finally {
        if (!controller.signal.aborted)
          timer = setTimeout(poll, document.hidden ? 12000 : 4000);
      }
    }
    const onOffline = () => setConnection("offline");
    window.addEventListener("offline", onOffline);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
    };
  }, [enabled]);
  return { status, connection, lastSync };
}

export function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(`${locale}-MA`, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(new Date(value));
}
