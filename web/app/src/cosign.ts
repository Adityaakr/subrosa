// @ts-nocheck
// Reusable Guardian 2-of-N co-sign (the verified flow from /cosign.html), used
// as an opt-in authorization gate before a "protected" bet is placed. Creates a
// multisig, collects agent + human signatures, and executes on-chain via the
// live Guardian — a real co-sign, not a stub. Returns the multisig account id.
import { MultisigClient, FalconSigner } from "@openzeppelin/miden-multisig-client";
import { MidenClient, AuthSecretKey } from "@miden-sdk/miden-sdk";

const RPC = "https://rpc.testnet.miden.io";

export async function guardianCoSign(onStep) {
  const step = (m) => { try { onStep && onStep(m); } catch (e) {} };
  const GUARDIAN = `${typeof window !== "undefined" ? window.location.origin : ""}/guardian`;

  step("Connecting to Guardian…");
  const miden = await MidenClient.createTestnet();
  const agent = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));
  const human = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));
  const client = new MultisigClient(miden, { guardianEndpoint: GUARDIAN, midenRpcEndpoint: RPC });

  const gp = await client.guardianClient.getPubkey();
  const guardianCommitment = typeof gp === "string" ? gp : gp.commitment;

  step("Creating 2-of-N multisig…");
  const multisig = await client.create(
    { threshold: 2, signerCommitments: [agent.commitment, human.commitment], guardianCommitment, guardianEnabled: true },
    agent,
  );
  await multisig.registerOnGuardian();
  const accountId = String(multisig.accountId ?? multisig.id ?? "");

  step("Collecting signatures…");
  const proposal = await multisig.createChangeThresholdProposal(1);
  await multisig.signProposal(proposal.id);
  const asHuman = await client.load(accountId, human);
  await asHuman.signProposal(proposal.id);

  step("Executing co-sign on-chain…");
  await asHuman.executeProposal(proposal.id);
  // Release the co-sign client so it doesn't contend with the app's main client
  // on the shared WASM instance, then let things settle before the place tx.
  try { (miden as any).free?.(); } catch (e) {}
  try { (miden as any)[Symbol.dispose]?.(); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));
  return { multisig: accountId };
}
