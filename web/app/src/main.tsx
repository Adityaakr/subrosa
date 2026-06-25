import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MidenProvider } from "@miden-sdk/react";
import { WalletProvider } from "@miden-sdk/miden-wallet-adapter-react";
import { MidenWalletAdapter } from "@miden-sdk/miden-wallet-adapter-miden";
import { WalletAdapterNetwork } from "@miden-sdk/miden-wallet-adapter-base";
import { MIDEN_RPC_URL, MIDEN_PROVER, APP_NAME } from "./config";
import { resetStaleNetworkState } from "./reset-stale-db";
import "./proto/proto.css";

// Provide the wallet-adapter CONTEXT (so the Miden Wallet option works) WITHOUT
// the SignerProvider that bridges into MidenProvider — that bridge expects an
// external wallet and breaks the built-in local-keystore client.
const walletAdapters = [new MidenWalletAdapter({ appName: APP_NAME })];

// Load the prototype modules in order so their window.* exports are populated
// before <App/> renders (icons → data → ui → market → seal → portfolio → app).
import "./proto/icons.tsx";
import "./proto/data.ts";
import "./proto/ui.tsx";
import "./proto/market.tsx";
import "./proto/seal.tsx";
import "./proto/portfolio.tsx";
import App from "./proto/app.tsx";

// Connect straight to testnet. The COEP `credentialless` header (vite.config)
// lets the browser load these CORS-enabled cross-origin endpoints directly.
// autoSyncInterval: 0 disables the background poll. The Miden WASM client is
// single-instance and crashes on concurrent calls ("recursive use of an
// object"); a periodic sync firing mid-mint/consume is exactly that collision.
// We sync explicitly inside the flows instead.
const midenConfig = { rpcUrl: MIDEN_RPC_URL, prover: MIDEN_PROVER, autoSyncInterval: 0 };

// CRITICAL: purge any 0.14-genesis IndexedDB BEFORE MidenProvider mounts and
// opens MidenClientDB_mtst. Stale accounts/notes from the pre-reset testnet make
// the 0.15 node reject our version and the prover reject the old account-ID
// encoding ("`0` is not a known account ID version"). The wipe runs once per
// network epoch, then renders regardless of outcome.
resetStaleNetworkState().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <WalletProvider wallets={walletAdapters} network={WalletAdapterNetwork.Testnet} autoConnect={false}>
        <MidenProvider
          config={midenConfig}
          loadingComponent={
            <div className="backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
              <div style={{ textAlign: "center" }}>
                <img src="/logo/subrosa-mark.svg" width={46} height={46} style={{ borderRadius: 11 }} alt="Subrosa" />
                <div className="mono" style={{ marginTop: 14, fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--faint)" }}>Loading Subrosa — initialising client…</div>
              </div>
            </div>
          }
        >
          <div className="backdrop" />
          <App />
        </MidenProvider>
      </WalletProvider>
    </StrictMode>,
  );
});
