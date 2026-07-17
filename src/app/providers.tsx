"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 }
    }
  }));

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster theme="dark" richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
