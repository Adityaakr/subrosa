import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MidenProvider } from "@miden-sdk/react";
import { WalletProvider } from "@miden-sdk/miden-wallet-adapter-react";
import { MidenWalletAdapter } from "@miden-sdk/miden-wallet-adapter-miden";
import { WalletAdapterNetwork } from "@miden-sdk/miden-wallet-adapter-base";
import { MIDEN_RPC_URL, MIDEN_PROVER, APP_NAME } from "./config";
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
const midenConfig = { rpcUrl: MIDEN_RPC_URL, prover: MIDEN_PROVER };

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
