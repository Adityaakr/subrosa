// On-chain bridge for the agent's AUTONOMOUS (sub-cap) path.
//
// Reuses the project's proven Rust tooling rather than re-implementing tx
// submission in Node: reads the market's public reserves via `miden-client`,
// and places a position via the compiled `run_script` + place_*.masp scripts
// (the exact path verified working on testnet in Phase 2). The above-cap path
// is handled separately by guardian.ts.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { MIDEN_CLI, MARKET_ID_HEX, SLOT_YES, SLOT_NO, SLOT_RES } from "./config.js";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."); // repo root

export type MarketOdds = { yes: bigint; no: bigint; resolution: bigint };

// Decode a Miden storage Word (printed as 0x<64 hex>) — value is the first
// felt, little-endian in the first 8 bytes.
function wordToBigInt(hex: string): bigint {
  const h = hex.replace(/^0x/, "").slice(0, 16);
  const bytes = h.match(/.{2}/g) ?? [];
  let v = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(parseInt(bytes[i], 16));
  return v;
}

export async function readMarket(): Promise<MarketOdds> {
  await run(MIDEN_CLI, ["sync"], { cwd: ROOT }).catch(() => {});
  const { stdout } = await run(MIDEN_CLI, ["account", "-s", MARKET_ID_HEX], { cwd: ROOT });
  const slot = (name: string): bigint => {
    const m = stdout.match(new RegExp(name.replace(/[:]/g, ":") + "[\\s\\S]*?(0x[0-9a-f]{64})"));
    return m ? wordToBigInt(m[1]) : 0n;
  };
  return { yes: slot(SLOT_YES), no: slot(SLOT_NO), resolution: slot(SLOT_RES) };
}

// Autonomous on-chain place via the proven run_script + compiled tx-script.
// (Sizes are fixed by the compiled place_*.masp in v1; parametrized scripts
// are a fast-follow.) Returns the submitted tx id.
export async function placeAutonomous(side: "yes" | "no"): Promise<string> {
  const runScript = resolve(ROOT, "client/target/debug/run_script");
  const masp = resolve(
    ROOT,
    side === "yes"
      ? "scripts/place_yes/target/miden/debug/place_yes.masp"
      : "scripts/place_no/target/miden/debug/place_no.masp",
  );
  const { stdout } = await run(runScript, [MARKET_ID_HEX, masp], { cwd: ROOT });
  const m = stdout.match(/tx:\s*(0x[0-9a-f]+)/);
  return m ? m[1] : stdout.trim();
}
