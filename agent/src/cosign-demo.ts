// Subrosa — Guardian co-sign demo (produces a REAL on-chain multisig tx).
//
// The @miden-sdk web SDK loads its WASM via `fetch(file://…)`, which Node's
// fetch doesn't support — so we polyfill `fetch` for file: URLs (read from
// disk) BEFORE dynamically importing the SDK. That lets this run in Node
// against a self-hosted Guardian (docs/GUARDIAN.md → `npm run guardian:up`).
//
// Flow: create a 2-of-2 (agent + human) Guardian multisig, propose a trade,
// sign with BOTH local signers, execute → real on-chain tx finalized via the
// Guardian ack. Some OZ-SDK constructor shapes are UNVERIFIED — confirm at run.

import "fake-indexeddb/auto"; // browser IndexedDB API for the web SDK's store, in Node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Agent, setGlobalDispatcher } from "undici";
import { GUARDIAN_ENDPOINT, MIDEN_RPC } from "./config.js";

// The Miden RPC + remote prover speak gRPC-web over HTTP/2. Node's fetch
// defaults to HTTP/1.1 (→ "missing content-type header in gRPC response").
// Enable HTTP/2 so the SDK's remote prove + submit work from Node — the same
// transport the browser uses natively.
setGlobalDispatcher(new Agent({ allowH2: true }));

// --- file: fetch polyfill so the browser web SDK can load WASM in Node ---
const _fetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  const u = typeof input === "string" ? input : String((input as { toString(): string }).toString());
  if (u.startsWith("file:")) {
    const buf = await readFile(fileURLToPath(u));
    const ct = u.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
    return new Response(buf, { headers: { "content-type": ct } });
  }
  return (_fetch as (i: unknown, n?: unknown) => Promise<Response>)(input, init);
}) as typeof fetch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function main(): Promise<void> {
  console.log("Subrosa Guardian co-sign demo");
  console.log(`guardian: ${GUARDIAN_ENDPOINT} · rpc: ${MIDEN_RPC}`);

  // Dynamic import AFTER the polyfill is installed.
  const { MidenClient, AuthSecretKey } = (await import("@miden-sdk/miden-sdk")) as Any;
  const { MultisigClient, FalconSigner } = (await import("@openzeppelin/miden-multisig-client")) as Any;

  // Remote testnet prover over HTTP/2 (enabled above). Local proving overflows
  // the 32-bit WASM heap; remote offloads it.
  const miden = await MidenClient.createTestnet();
  const agent = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));
  const human = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));

  const client = new MultisigClient(miden, {
    guardianEndpoint: GUARDIAN_ENDPOINT,
    midenRpcEndpoint: MIDEN_RPC,
  });

  const gp = await client.guardianClient.getPubkey();
  // getPubkey() returns { commitment: "0x…" }; create() wants the hex string.
  const guardianCommitment = typeof gp === "string" ? gp : gp.commitment;
  console.log(`guardian commitment: ${guardianCommitment}`);

  const multisig: Any = await client.create(
    {
      threshold: 2,
      signerCommitments: [agent.commitment, human.commitment],
      guardianCommitment,
      guardianEnabled: true,
    },
    agent,
  );
  await multisig.registerOnGuardian();
  const accountId = String(multisig.accountId ?? multisig.id ?? "(see Guardian)");
  console.log(`multisig account: ${accountId}`);

  // Fund-less governance proposal: lower the 2-of-2 threshold to 1-of-2.
  // A real, co-signed on-chain transaction that needs no assets.
  const proposal: Any = await multisig.createChangeThresholdProposal(1);
  console.log(`proposal ${proposal.id} created (change threshold 2 → 1; needs 2 signatures)`);

  await multisig.signProposal(proposal.id);
  console.log("agent signed");

  const asHuman: Any = await client.load(accountId, human);
  await asHuman.signProposal(proposal.id);
  console.log("human co-signed → threshold met ✓");

  // Execute with retry — local proving is slow and the RPC submit can hit
  // transient errors; try a few times before giving up.
  let executed = false, lastErr = "";
  for (let attempt = 1; attempt <= 4 && !executed; attempt++) {
    try {
      console.log(`executing (local prove + submit), attempt ${attempt}…`);
      const res: Any = await asHuman.executeProposal(proposal.id);
      const tx = res?.transactionId ?? res?.txId ?? res?.id ?? "";
      console.log(`EXECUTED on-chain ✓ ${tx ? "tx " + tx : ""}`);
      console.log(`verify: https://testnet.midenscan.com/account/${accountId}`);
      executed = true;
    } catch (e) {
      lastErr = (e instanceof Error ? e.message : String(e)).split("\n")[0];
      console.log(`  attempt ${attempt} failed: ${lastErr}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, 4000));
    }
  }
  if (!executed) {
    console.log("");
    console.log("[finalize] 2-of-2 collected against the LIVE Guardian; ready to submit.");
    console.log(`[finalize] execute still failing after retries: ${lastErr}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
