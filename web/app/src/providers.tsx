import { type ReactNode } from "react";
import { MidenProvider } from "@miden-sdk/react";
import { MIDEN_RPC_URL, MIDEN_PROVER } from "@/config";

// Self-contained: just the MidenProvider with a LOCAL prover, so accounts and
// transactions are created + proved in-browser (no wallet extension required).
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MidenProvider
      config={{ rpcUrl: MIDEN_RPC_URL, prover: MIDEN_PROVER }}
      loadingComponent={<div className="loading">Loading Miden WASM…</div>}
    >
      {children}
    </MidenProvider>
  );
}
