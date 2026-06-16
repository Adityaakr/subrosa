// Operator faucet service — mints test OBX to a wallet on request.
//
// The browser wallet's "Fund" button POSTs its address here; we mint a PUBLIC
// note from the OBX faucet (whose key lives in the operator's local CLI store)
// so the client can sync + consume it. Testnet-only convenience for letting any
// visitor get a real, non-zero balance to trade with.
//
//   run:  npm run fund-service      (listens on :8787)

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { MIDEN_CLI, OBX_FAUCET_HEX } from "./config.js";

const run = promisify(execFile);
// The CLI's store/keystore (.miden/) is resolved from the repo root — run the
// CLI there, same as agent/src/onchain.ts.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = Number(process.env.FUND_PORT ?? "8787");
const AMOUNT = process.env.FUND_AMOUNT ?? "1000"; // OBX base units per request
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

// crude per-address cooldown so the faucet isn't drained
const lastFunded = new Map<string, number>();
const COOLDOWN_MS = 60_000;

async function mint(address: string): Promise<string> {
  const { stdout } = await run(
    MIDEN_CLI,
    ["mint", "--target", address, "--asset", `${AMOUNT}::${OBX_FAUCET_HEX}`,
     "--note-type", "public", "--force"],
    { cwd: ROOT, timeout: 300_000 },
  );
  const m = stdout.match(/0x[0-9a-f]{2,}/i);
  return m ? m[0] : stdout.trim().slice(0, 200);
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (req.method !== "POST" || !req.url?.startsWith("/fund")) {
    res.writeHead(404, CORS); return res.end("not found");
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const { address } = JSON.parse(body || "{}");
      if (!address || typeof address !== "string") {
        res.writeHead(400, { ...CORS, "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "missing address" }));
      }
      const now = Date.now();
      const prev = lastFunded.get(address) ?? 0;
      if (now - prev < COOLDOWN_MS) {
        res.writeHead(429, { ...CORS, "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "cooldown — try again shortly" }));
      }
      lastFunded.set(address, now);
      console.log(`[fund] minting ${AMOUNT} OBX → ${address}`);
      const ref = await mint(address);
      console.log(`[fund] minted: ${ref}`);
      res.writeHead(200, { ...CORS, "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, amount: AMOUNT, faucet: OBX_FAUCET_HEX, ref }));
    } catch (e: any) {
      console.error("[fund] error:", e?.message ?? e);
      res.writeHead(500, { ...CORS, "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Subrosa faucet service on http://localhost:${PORT}/fund`);
  console.log(`minting ${AMOUNT} OBX from ${OBX_FAUCET_HEX} per request (cooldown ${COOLDOWN_MS / 1000}s)`);
});
