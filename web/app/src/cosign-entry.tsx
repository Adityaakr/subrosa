// @ts-nocheck
// Standalone Guardian co-sign page — runs the OpenZeppelin 2-of-N multisig
// co-sign + on-chain EXECUTE in the browser (where proving works; Node can't).
// Isolated from the main 0.14.11 app: uses the OZ client's bundled @miden-sdk
// 0.14.5 consistently so there's no cross-version ABI mismatch.
import { MultisigClient, FalconSigner } from "@openzeppelin/miden-multisig-client";
import { MidenClient, AuthSecretKey } from "@miden-sdk/miden-sdk";

const GUARDIAN = `${location.origin}/guardian`; // Vite-proxied → :3000
const RPC = "https://rpc.testnet.miden.io";

const logEl = document.getElementById("log");
const log = (m) => { console.log("[cosign]", m); if (logEl) logEl.textContent += "\n" + m; };

async function coSign() {
  log(`guardian: ${GUARDIAN}`);
  const miden = await MidenClient.createTestnet();
  const agent = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));
  const human = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));
  const client = new MultisigClient(miden, { guardianEndpoint: GUARDIAN, midenRpcEndpoint: RPC });

  const gp = await client.guardianClient.getPubkey();
  const guardianCommitment = typeof gp === "string" ? gp : gp.commitment;
  log(`guardian commitment: ${guardianCommitment}`);

  const multisig = await client.create(
    { threshold: 2, signerCommitments: [agent.commitment, human.commitment], guardianCommitment, guardianEnabled: true },
    agent,
  );
  await multisig.registerOnGuardian();
  const accountId = String(multisig.accountId ?? multisig.id ?? "");
  log(`multisig: ${accountId}`);

  const proposal = await multisig.createChangeThresholdProposal(1);
  log(`proposal ${proposal.id} (change threshold 2→1)`);

  await multisig.signProposal(proposal.id);
  log("agent signed");
  const asHuman = await client.load(accountId, human);
  await asHuman.signProposal(proposal.id);
  log("human co-signed → threshold met ✓");

  log("executing (prove + submit in browser)…");
  const res = await asHuman.executeProposal(proposal.id);
  log("execute returned: " + JSON.stringify(res) + " · keys=" + (res && typeof res === "object" ? Object.keys(res).join(",") : typeof res));
  const tx =
    res?.transactionId ?? res?.txId ?? res?.id ?? res?.hash ??
    res?.transaction?.id ?? res?.tx?.id ?? res?.executedTransactionId ??
    (typeof res === "string" ? res : "");
  log(`EXECUTED on-chain ✓ tx=${tx}`);
  return { accountId, proposalId: proposal.id, tx, raw: res };
}

window.__coSign = () =>
  coSign()
    .then((r) => { window.__coSignResult = { ok: true, ...r }; log("DONE ✓"); return window.__coSignResult; })
    .catch((e) => { window.__coSignResult = { ok: false, error: String(e?.message ?? e) }; log("ERROR: " + window.__coSignResult.error); return window.__coSignResult; });

log("ready — call window.__coSign()");
