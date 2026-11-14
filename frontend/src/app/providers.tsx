"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/config/wagmi";
import { TransactionProvider } from "@/hooks/useTransaction";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: true } },
  }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}><TransactionProvider>{children}</TransactionProvider></QueryClientProvider>
    </WagmiProvider>
  );
}
