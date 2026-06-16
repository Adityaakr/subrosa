import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { midenVitePlugin } from "@miden-sdk/vite-plugin";

export default defineConfig({
  plugins: [react(), midenVitePlugin({ crossOriginIsolation: true })],
  // The Miden web client (WASM worker) talks gRPC-web to the testnet RPC +
  // delegated prover. Hitting them cross-origin fails under our COEP
  // (require-corp) headers AND the endpoints send no CORS headers. So in dev we
  // proxy them through the Vite server → the browser sees same-origin requests.
  // (A production deploy needs the equivalent reverse-proxy in front of it.)
  server: {
    proxy: {
      "/miden-rpc": { target: "https://rpc.testnet.miden.io", changeOrigin: true, secure: true, ws: false, rewrite: (p) => p.replace(/^\/miden-rpc/, "") },
      "/miden-prover": { target: "https://tx-prover.testnet.miden.io", changeOrigin: true, secure: true, ws: false, rewrite: (p) => p.replace(/^\/miden-prover/, "") },
      "/miden-transport": { target: "https://transport.miden.io", changeOrigin: true, secure: true, ws: false, rewrite: (p) => p.replace(/^\/miden-transport/, "") },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Don't pre-bundle the Miden SDK: Vite's dep optimizer mishandles its
  // web-worker + WASM loading in dev (stale "Outdated Optimize Dep" → the
  // worker fetches HTML instead of the .wasm). Excluding it lets the worker
  // load the real module/wasm directly.
  optimizeDeps: {
    exclude: ["@miden-sdk/miden-sdk", "@miden-sdk/react"],
  },
  // Multi-page: landing at "/" (index.html), the React dapp at "/app/" (app/index.html).
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app/index.html"),
      },
    },
  },
});
