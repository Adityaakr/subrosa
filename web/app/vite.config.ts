import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { midenVitePlugin } from "@miden-sdk/vite-plugin";

// Cross-origin isolation for the WASM client's worker threads. We set the
// headers ourselves (the Miden plugin hardcodes require-corp) using
// `credentialless` instead: it still isolates (SharedArrayBuffer works) but
// lets the browser load the CORS-enabled testnet RPC/prover responses without
// requiring a Cross-Origin-Resource-Policy header on them — which the testnet
// endpoints don't send. So the client connects DIRECTLY to testnet, no proxy.
const coiHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

// The browser calls Guardian same-origin at `${origin}/guardian`; we proxy that
// to the self-hosted Guardian's plain HTTP REST (:3000). In prod (Railway) the
// Guardian runs as a separate service — point GUARDIAN_URL at its internal URL
// (e.g. http://guardian.railway.internal:3000). Falls back to localhost in dev.
const guardianTarget = process.env.GUARDIAN_URL || "http://localhost:3000";
const guardianProxy = {
  "/guardian": { target: guardianTarget, changeOrigin: true, ws: false, rewrite: (p: string) => p.replace(/^\/guardian/, "") },
};
const polymarketProxy = {
  "/api/polymarket": {
    target: "https://gamma-api.polymarket.com",
    changeOrigin: true,
    ws: false,
    rewrite: (p: string) => p.replace(/^\/api\/polymarket/, ""),
  },
};

export default defineConfig({
  plugins: [react(), midenVitePlugin({ crossOriginIsolation: false })],
  server: {
    headers: coiHeaders,
    proxy: { ...guardianProxy, ...polymarketProxy },
  },
  // `vite preview` is the production server on Railway: it must send the same
  // cross-origin-isolation headers AND proxy /guardian, and accept the Railway
  // public hostname. (Set `host` + `--port $PORT` via the start command.)
  preview: {
    headers: coiHeaders,
    proxy: { ...guardianProxy, ...polymarketProxy },
    allowedHosts: true,
  },
  resolve: {
    // Dedupe @miden-sdk so the OZ multisig client and the app share ONE SDK
    // instance (top-level 0.14.11) — otherwise the OZ client's nested 0.14.5
    // loads a second Dexie/WASM and they collide ("two versions of Dexie").
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@miden-sdk/miden-sdk", "dexie"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Don't pre-bundle the Miden SDK: Vite's dep optimizer mishandles its
  // web-worker + WASM loading in dev (stale "Outdated Optimize Dep" → the
  // worker fetches HTML instead of the .wasm). Excluding it lets the worker
  // load the real module/wasm directly.
  optimizeDeps: {
    exclude: ["@miden-sdk/miden-sdk", "@miden-sdk/react", "@openzeppelin/miden-multisig-client"],
  },
  // Multi-page: landing at "/" (index.html), the React dapp at "/app/" (app/index.html).
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app/index.html"),
        cosign: path.resolve(__dirname, "cosign.html"),
      },
    },
  },
});
