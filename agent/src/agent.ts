// Subrosa confidential agent — autonomous decision loop with a programmable-auth
// guardrail and hard safety rails for hands-off testnet operation.
//
//   read public odds → decide (private brain) → route by size:
//     size <= CAP  → autonomous private trade (agent acts alone)
//     size >  CAP  → Guardian co-sign required (agent proposes, human approves)
//
// Safety rails (config.ts): master switch, dry-run, per-session trade + OBX
// budget (terminal), a runtime kill-switch file, error backoff, and a stand-down
// when the market resolves. Strategy & book stay private: every trade originates
// from the agent's private account, so it isn't reconstructable on-chain.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readMarket, placeAutonomous, type MarketOdds } from "./onchain.js";
import { decide } from "./strategy.js";
import { readPolymarketReference, type PolymarketReference } from "./polymarket.js";
import { llmConfigured } from "./llm.js";
import {
  AUTONOMOUS_CAP, AGENT_ACCOUNT_HEX, POLL_INTERVAL_MS, OPENROUTER_MODEL,
  AGENT_ENABLED, DRY_RUN, MAX_TRADES, BUDGET_OBX, ERROR_BACKOFF_MS, STOP_FILE, STAKE_OBX,
} from "./config.js";
import { writeStatus, type AgentStatus } from "./status.js";
// guardian.ts pulls in the browser web SDK (WASM), which only loads in a
// browser — so it's imported lazily, only when the above-cap co-sign path runs.

const STOP_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", STOP_FILE);

// Session state.
let tradesPlaced = 0;
let budgetSpent = 0n;
let consecutiveErrors = 0;

const brain = () => (llmConfigured() ? `OpenRouter (${OPENROUTER_MODEL})` : "heuristic");
const yesPct = (o: MarketOdds): number | null => {
  const t = o.yes + o.no;
  return t === 0n ? null : Math.round((Number(o.no) / Number(t)) * 1000) / 10;
};

type TickResult = { halt?: string; decision?: string; tx?: string; odds: MarketOdds; reference: PolymarketReference | null };

async function tick(): Promise<TickResult> {
  const odds = await readMarket();
  const reference = await readPolymarketReference().catch((error) => {
    console.warn("[polymarket] reference unavailable:", error instanceof Error ? error.message : error);
    return null;
  });
  const pct = yesPct(odds);
  console.log(`[odds] yes=${odds.yes} no=${odds.no} resolution=${odds.resolution}${pct !== null ? ` · P(YES)=${pct}%` : ""}`);
  if (reference) console.log(`[polymarket] ${reference.slug} · P(YES)=${(reference.yesPrice * 100).toFixed(1)}% · ${reference.conditionId}`);

  // Stand down on a resolved market — nothing left to trade.
  if (odds.resolution !== 0n) {
    console.log("[halt] market resolved — agent stands down");
    return { halt: "resolved", odds, reference };
  }

  const d = await decide(odds, reference);
  if (!d) {
    console.log("[decide] no edge — holding");
    return { odds, reference };
  }
  const decision = `${d.side.toUpperCase()} size=${d.size} OBX — ${d.reason}`;
  console.log(`[decide] ${decision}`);

  if (!AGENT_ENABLED) {
    console.log(`[read-only] decision recorded; live submission is disabled`);
    return { decision, odds, reference };
  }

  // Above-cap → programmable-auth guardrail: the agent can't act alone.
  if (d.size > AUTONOMOUS_CAP) {
    console.log(`[cosign] ${d.size} > cap ${AUTONOMOUS_CAP} → human co-sign REQUIRED`);
    const multisig = process.env.SUBROSA_MULTISIG;
    if (!multisig) {
      console.log("[cosign] Guardian not configured here (set SUBROSA_MULTISIG for the 2-of-N proposal path).");
      console.log("[cosign] In the dapp this surfaces under Approvals for a human co-sign.");
      return { decision, odds, reference };
    }
    const { proposeAndCoSign } = await import("./guardian.js");
    const r = await proposeAndCoSign({ multisigAccountId: multisig, recipientHex: AGENT_ACCOUNT_HEX, amount: d.size });
    console.log(`[cosign] proposal ${r.proposalId} status=${r.status}` + (r.txId ? ` tx=${r.txId}` : " (awaiting human co-signature)"));
    return { decision, odds, reference };
  }

  // Sub-cap autonomous trade. The on-chain stake is fixed per side in v1, so
  // account the budget against that actual amount (not the decided intent).
  const stake = STAKE_OBX[d.side];
  if (tradesPlaced >= MAX_TRADES) {
    console.log(`[halt] reached MAX_TRADES=${MAX_TRADES} — ending session`);
    return { halt: "max-trades", decision, odds, reference };
  }
  if (budgetSpent + stake > BUDGET_OBX) {
    console.log(`[halt] budget ${budgetSpent}+${stake} > ${BUDGET_OBX} OBX — ending session`);
    return { halt: "budget", decision, odds, reference };
  }

  if (DRY_RUN) {
    console.log(`[dry-run] would stake ${stake} OBX ${d.side.toUpperCase()} (no tx submitted)`);
    return { decision, odds, reference };
  }

  console.log(`[auto] staking ${stake} OBX ${d.side.toUpperCase()} (≤ cap ${AUTONOMOUS_CAP})`);
  const tx = await placeAutonomous(d.side);
  tradesPlaced += 1;
  budgetSpent += stake;
  console.log(`[auto] submitted ${tx} · trades=${tradesPlaced}/${MAX_TRADES} · budget=${budgetSpent}/${BUDGET_OBX} OBX`);
  return { decision, tx, odds, reference };
}

async function snapshot(r: TickResult | null, err?: unknown): Promise<void> {
  const o = r?.odds ?? { yes: 0n, no: 0n, resolution: 0n };
  const s: AgentStatus = {
    updatedAt: new Date().toISOString(),
    brain: brain(),
    enabled: AGENT_ENABLED && !DRY_RUN,
    dryRun: DRY_RUN,
    capObx: String(AUTONOMOUS_CAP),
    maxTrades: MAX_TRADES,
    budgetObx: String(BUDGET_OBX),
    tradesPlaced,
    budgetSpentObx: String(budgetSpent),
    lastOdds: { yes: String(o.yes), no: String(o.no), resolution: String(o.resolution), yesPct: yesPct(o) },
    polymarket: r?.reference ? {
      slug: r.reference.slug,
      conditionId: r.reference.conditionId,
      yesPct: Math.round(r.reference.yesPrice * 10_000) / 100,
      updatedAt: r.reference.updatedAt,
    } : null,
    lastDecision: err ? `error: ${err instanceof Error ? err.message : String(err)}` : r?.decision ?? null,
    lastTx: r?.tx ?? null,
    halted: r?.halt ?? null,
  };
  await writeStatus(s);
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const mode = DRY_RUN ? "DRY-RUN" : !AGENT_ENABLED ? "READ-ONLY" : "LIVE";
  console.log(
    `Subrosa agent · brain ${brain()} · mode ${mode} · cap ${AUTONOMOUS_CAP} OBX · ` +
      `${once ? "single tick" : `every ${POLL_INTERVAL_MS / 1000}s`} · limits ${MAX_TRADES} trades / ${BUDGET_OBX} OBX`,
  );

  if (once) {
    const r = await tick().catch((e) => { console.error("[error]", e); return null; });
    if (r) await snapshot(r);
    return;
  }

  const loop = async (): Promise<void> => {
    // Runtime kill switch — touch agent/.agent-stop to stand the agent down.
    if (existsSync(STOP_PATH)) {
      console.log(`[stop] ${STOP_FILE} present — agent halted (rm it to allow restart).`);
      await snapshot(null);
      return;
    }
    let delay = POLL_INTERVAL_MS;
    try {
      const r = await tick();
      consecutiveErrors = 0;
      await snapshot(r);
      if (r.halt) {
        console.log(`[stop] ${r.halt} — loop ending.`);
        return; // terminal: resolved / budget / max-trades
      }
    } catch (e) {
      consecutiveErrors += 1;
      console.error("[error]", e instanceof Error ? e.message : e);
      await snapshot(null, e);
      delay = Math.min(POLL_INTERVAL_MS * 2 ** consecutiveErrors, ERROR_BACKOFF_MS);
      console.log(`[backoff] retrying in ${Math.round(delay / 1000)}s (consecutive errors=${consecutiveErrors})`);
    }
    setTimeout(loop, delay);
  };
  await loop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
