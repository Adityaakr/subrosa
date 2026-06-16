// Operator redemption service — settles a winning position on-chain.
//
// v1 redemption is resolver-settled: the contract's redeem() guard runs as a
// tx-script against the market (operator-authorized) and SUCCEEDS only for the
// winning side — losing redemptions abort on-chain. The dapp's "Redeem" button
// POSTs here; we run the proven run_script + redeem_<side>.masp and return the
// tx. (Wallet-initiated redeem notes are a fast-follow needing a redeem-note
// artifact; the trustless winner-only rule is already enforced here.)
//
//   run:  npm run redeem-service      (listens on :8788)

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUN_SCRIPT = resolve(ROOT, "client/target/debug/run_script");
const PORT = Number(process.env.REDEEM_PORT ?? "8788");
const MASP = (side: string) =>
  resolve(ROOT, side === "no"
    ? "scripts/redeem_no/target/miden/debug/redeem_no.masp"
    : "scripts/redeem_yes/target/miden/debug/redeem_yes.masp");
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (req.method !== "POST" || !req.url?.startsWith("/redeem")) { res.writeHead(404, CORS); return res.end("not found"); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const { market, side } = JSON.parse(body || "{}");
      if (!market || (side !== "yes" && side !== "no")) {
        res.writeHead(400, { ...CORS, "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "need { market, side: 'yes'|'no' }" }));
      }
      console.log(`[redeem] ${side} against ${market}`);
      const { stdout } = await run(RUN_SCRIPT, [market, MASP(side)], { cwd: ROOT, timeout: 300_000 });
      const tx = stdout.match(/tx:\s*(0x[0-9a-f]+)/)?.[1];
      if (!tx) throw new Error(stdout.slice(0, 200));
      console.log(`[redeem] settled: ${tx}`);
      res.writeHead(200, { ...CORS, "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, tx }));
    } catch (e: any) {
      // A losing redemption aborts on-chain — surface it as a clean 409, not 500.
      const msg = String(e?.stderr ?? e?.message ?? e);
      const losing = /FailedAssertion|unreachable|assert/i.test(msg);
      console.error("[redeem] error:", msg.slice(0, 200));
      res.writeHead(losing ? 409 : 500, { ...CORS, "content-type": "application/json" });
      res.end(JSON.stringify({ error: losing ? "redemption rejected on-chain (losing side)" : msg.slice(0, 200) }));
    }
  });
});

server.listen(PORT, () => console.log(`Subrosa redeem service on http://localhost:${PORT}/redeem`));
