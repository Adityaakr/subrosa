// Tiny zero-dependency production server for the built Subrosa frontend.
//
// Replaces `vite preview` in the Docker image so the runtime needs no
// node_modules (a multi-GB image otherwise — the Miden SDK ships several ~14MB
// WASM variants). Keeps the two things the app needs:
//   1. Cross-origin-isolation headers (COOP same-origin + COEP credentialless)
//      so the WASM client gets SharedArrayBuffer and can call the testnet
//      RPC/prover directly.
//   2. A /guardian → GUARDIAN_URL reverse proxy (same-origin co-sign calls).
import http from "node:http";
import https from "node:https";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT || 4173);
const GUARDIAN_URL = process.env.GUARDIAN_URL || "";

const COI = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".map": "application/json",
};

function proxyGuardian(req, res) {
  if (!GUARDIAN_URL) { res.writeHead(502, COI).end("GUARDIAN_URL not configured"); return; }
  const target = new URL(GUARDIAN_URL);
  const lib = target.protocol === "https:" ? https : http;
  const upstream = lib.request({
    protocol: target.protocol, hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    method: req.method, path: req.url.replace(/^\/guardian/, "") || "/",
    headers: { ...req.headers, host: target.host },
  }, (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); });
  upstream.on("error", (e) => { res.writeHead(502, COI).end("guardian proxy error: " + e.message); });
  req.pipe(upstream);
}

async function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  else if (!extname(p)) p += "/index.html"; // /app → /app/index.html
  const file = normalize(join(DIST, p));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    const st = await stat(file);
    const ext = extname(file);
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    // Content-hashed bundles (main-XXXX.js) are immutable → cache forever.
    // HTML + the unhashed WASM are shared across deploys → must revalidate, or
    // a stale cached WASM mismatches the new worker glue ("memory import…").
    const hashed = /-[A-Za-z0-9_]{8,}\.[a-z0-9]+$/.test(file) && ext !== ".wasm";
    const cache = ext === ".html" || ext === ".wasm" || !hashed
      ? "no-cache" : "public, max-age=31536000, immutable";
    const headers = { ...COI, "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": cache, ETag: etag };
    if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { ...COI, "Content-Type": "text/plain" }).end("not found");
  }
}

http.createServer((req, res) => {
  if (req.url.startsWith("/guardian")) return proxyGuardian(req, res);
  serveStatic(req, res);
}).listen(PORT, "0.0.0.0", () => console.log(`subrosa web serving ${DIST} on :${PORT} (guardian → ${GUARDIAN_URL || "unset"})`));
