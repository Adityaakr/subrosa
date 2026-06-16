import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MidenProvider } from "@miden-sdk/react";
import { MIDEN_RPC_URL, MIDEN_PROVER } from "./config";
import "./proto/proto.css";

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
    <MidenProvider
      config={midenConfig}
      loadingComponent={<div className="backdrop" />}
    >
      <div className="backdrop" />
      <App />
    </MidenProvider>
  </StrictMode>,
);
