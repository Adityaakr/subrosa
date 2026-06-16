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
import { AUTONOMOUS_CAP, AGENT_ACCOUNT_HEX, POLL_INTERVAL_MS } from "./config.js";
// guardian.ts pulls in the browser web SDK (WASM), which only loads in a
// browser — so it's imported lazily, only when the above-cap co-sign path runs.

async function tick(): Promise<void> {
  const odds = await readMarket();
  console.log(`[odds] yes=${odds.yes} no=${odds.no} resolution=${odds.resolution}`);

  const d = decide(odds);
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
    console.log(`[cosign] ${d.size} > cap ${AUTONOMOUS_CAP} → human co-sign via Guardian`);
    const { proposeAndCoSign } = await import("./guardian.js");
    const r = await proposeAndCoSign({
      multisigAccountId: process.env.SUBROSA_MULTISIG ?? "",
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
    `Subrosa agent · cap ${AUTONOMOUS_CAP} OBX · ${once ? "single tick" : `polling every ${POLL_INTERVAL_MS}ms`}`,
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
