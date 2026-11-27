"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ProviderId } from "@/content/providers";

type ProviderScopeValue = {
  id: ProviderId;
  base: string;
};

const ProviderContext = createContext<ProviderScopeValue | null>(null);

export function ProviderScope({
  value,
  children,
}: {
  value: ProviderScopeValue;
  children: ReactNode;
}) {
  return (
    <ProviderContext.Provider value={value}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProviderScope(locale: string): ProviderScopeValue {
  return useContext(ProviderContext) ?? { id: "tram", base: `/${locale}` };
}
