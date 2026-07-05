// Relays an unambiguous, finalized Polymarket result into Miden's one-shot
// resolution slot. Disabled by default because resolution is irreversible.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  MARKET_ID_HEX,
  POLYMARKET_CONDITION_ID,
  RESOLUTION_RELAY_ENABLED,
} from "./config.js";
import { readPolymarketReference } from "./polymarket.js";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function main(): Promise<void> {
  const reference = await readPolymarketReference();
  if (!reference) throw new Error("POLYMARKET_SLUG is not configured");
  if (reference.conditionId.toLowerCase() !== POLYMARKET_CONDITION_ID.toLowerCase()) {
    throw new Error(`condition ID mismatch: expected ${POLYMARKET_CONDITION_ID}, got ${reference.conditionId}`);
  }
  if (!reference.closed) {
    console.log(`[resolution-relay] ${reference.slug} is still open`);
    return;
  }

  const outcome = reference.yesPrice === 1 && reference.noPrice === 0
    ? "yes"
    : reference.yesPrice === 0 && reference.noPrice === 1
      ? "no"
      : null;
  if (!outcome) {
    throw new Error(`closed market has ambiguous prices: YES=${reference.yesPrice}, NO=${reference.noPrice}`);
  }
  if (!RESOLUTION_RELAY_ENABLED) {
    console.log(`[resolution-relay] finalized ${outcome.toUpperCase()} detected; set SUBROSA_RESOLUTION_ENABLED=1 to relay`);
    return;
  }

  const script = resolve(ROOT, `scripts/resolve_${outcome}/target/miden/release/resolve-${outcome}.masp`);
  const submitter = resolve(ROOT, "client/target/debug/run_script");
  const { stdout } = await run(submitter, [MARKET_ID_HEX, script], { cwd: ROOT });
  console.log(stdout.trim());
}

main().catch((error) => {
  console.error("[resolution-relay]", error instanceof Error ? error.message : error);
  process.exit(1);
});
