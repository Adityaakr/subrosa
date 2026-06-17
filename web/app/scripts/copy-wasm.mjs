// Post-build fix for the Miden web SDK in a production (vite build) bundle.
//
// The SDK's classic web-worker loads the WASM via:
//     new URL("assets/miden_client_web.wasm", self.location.href)
// In node_modules the worker has a co-located `assets/miden_client_web.wasm`
// (so `vite dev` works), but `vite build` flattens the worker into /assets/ and
// emits the WASM hashed elsewhere — so the worker's relative path
// `/assets/assets/miden_client_web.wasm` is missing and the fetch 404s
// (the dev/preview server then returns index.html → "expected magic word…").
//
// This copies the (multi-threaded, crossOriginIsolation) WASM to the exact path
// the worker requests, with the exact unhashed name. Idempotent.

import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
// crossOriginIsolation: true → the SDK uses the multi-threaded (mt) worker.
const src = resolve(
  root,
  "node_modules/@miden-sdk/miden-sdk/dist/mt/workers/assets/miden_client_web.wasm",
);
const dest = resolve(root, "dist/assets/assets/miden_client_web.wasm");

if (!existsSync(src)) {
  console.error(`[copy-wasm] source WASM not found: ${src}`);
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-wasm] ${dest} (for the worker's relative WASM fetch)`);

// Safety net for the static landing page. On some platforms (observed on Linux,
// which is what CI/Railway build on) rollup silently omits the root index.html
// entry from the multi-page build — leaving `/` 404ing in production. The
// landing page is fully self-contained (inline CSS/JS, only absolute /fonts and
// /logo public-asset refs), so a verbatim copy is identical to rollup's output.
const landingDest = resolve(root, "dist/index.html");
if (!existsSync(landingDest)) {
  const landingSrc = resolve(root, "index.html");
  copyFileSync(landingSrc, landingDest);
  console.log(`[copy-wasm] ${landingDest} (rollup dropped it — copied source landing page)`);
}
