import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { midenVitePlugin } from "@miden-sdk/vite-plugin";

export default defineConfig({
  plugins: [react(), midenVitePlugin({ crossOriginIsolation: true })],
  // The Miden web client (WASM worker) talks gRPC-web to the testnet RPC +
  // delegated prover. Hitting them cross-origin fails under our COEP
  // (require-corp) headers AND the endpoints send no CORS headers. The Rust
  // client also rejects any node URL that carries a path. So we point it at the
  // app's OWN bare origin and route by gRPC service-path prefix to each upstream
  // — same-origin to the browser, no CORS, valid node URL.
  // (A production deploy needs the equivalent reverse-proxy in front of it.)
  server: {
    proxy: {
      "/rpc.Api": { target: "https://rpc.testnet.miden.io", changeOrigin: true, secure: true, ws: false },
      "/remote_prover.Api": { target: "https://tx-prover.testnet.miden.io", changeOrigin: true, secure: true, ws: false },
      "/miden_note_transport.MidenNoteTransport": { target: "https://transport.miden.io", changeOrigin: true, secure: true, ws: false },
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
