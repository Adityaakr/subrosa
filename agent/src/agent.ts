// Subrosa confidential agent — decision loop with a programmable-auth guardrail.
//
//   read public odds → decide (private brain) → route by size:
//     size <= CAP  → autonomous private trade (agent acts alone)
//     size >  CAP  → Guardian co-sign required (agent proposes, human approves)
//
// Strategy & book stay private: every trade originates from the agent's private
// account, so they are not reconstructable on-chain.

import { readMarket, placeAutonomous } from "./onchain.js";
import { decide } from "./strategy.js";
import { llmConfigured } from "./llm.js";
import { AUTONOMOUS_CAP, AGENT_ACCOUNT_HEX, POLL_INTERVAL_MS, OPENROUTER_MODEL } from "./config.js";
// guardian.ts pulls in the browser web SDK (WASM), which only loads in a
// browser — so it's imported lazily, only when the above-cap co-sign path runs.

async function tick(): Promise<void> {
  const odds = await readMarket();
  console.log(`[odds] yes=${odds.yes} no=${odds.no} resolution=${odds.resolution}`);

  const d = await decide(odds);
  if (!d) {
    console.log("[decide] no edge — holding");
    return;
  }
  console.log(`[decide] ${d.side.toUpperCase()} size=${d.size} OBX — ${d.reason}`);

  if (d.size <= AUTONOMOUS_CAP) {
    console.log(`[auto]   ${d.size} <= cap ${AUTONOMOUS_CAP} → autonomous private trade`);
    const tx = await placeAutonomous(d.side);
    console.log(`[auto]   submitted ${tx}`);
  } else {
    console.log(`[cosign] ${d.size} > cap ${AUTONOMOUS_CAP} → human co-sign REQUIRED (programmable-auth guardrail)`);
    const multisig = process.env.SUBROSA_MULTISIG;
    if (!multisig) {
      console.log(
        "[cosign] Guardian not configured here. With a self-hosted Guardian + SUBROSA_MULTISIG set,",
      );
      console.log(
        "[cosign] this routes a 2-of-N proposal for human co-sign (browser, web SDK is browser-only — see docs/GUARDIAN.md).",
      );
      return;
    }
    // guardian.ts pulls the browser web SDK (WASM) — only loads in a browser.
    const { proposeAndCoSign } = await import("./guardian.js");
    const r = await proposeAndCoSign({
      multisigAccountId: multisig,
      recipientHex: AGENT_ACCOUNT_HEX,
      amount: d.size,
    });
    console.log(
      `[cosign] proposal ${r.proposalId} status=${r.status}` +
        (r.txId ? ` tx=${r.txId}` : " (awaiting human co-signature)"),
    );
  }
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  console.log(
    `Subrosa agent · brain ${llmConfigured() ? `OpenRouter (${OPENROUTER_MODEL})` : "heuristic"} · ` +
      `cap ${AUTONOMOUS_CAP} OBX · ${once ? "single tick" : `polling every ${POLL_INTERVAL_MS}ms`}`,
  );
  if (once) {
    await tick();
    return;
  }
  // eslint-disable-next-line no-constant-condition
  const loop = async () => {
    try {
      await tick();
    } catch (e) {
      console.error("[error]", e instanceof Error ? e.message : e);
    }
    setTimeout(loop, POLL_INTERVAL_MS);
  };
  await loop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
