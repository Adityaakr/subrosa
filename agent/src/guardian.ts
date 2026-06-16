// Above-cap path: Guardian-coordinated human co-sign on a 2-of-N Miden multisig.
//
// API verified against OpenZeppelin/guardian @ main (docs/MULTISIG_SDK.md,
// packages/miden-multisig-client/README.md):
//   - new MultisigClient(midenClient, { guardianEndpoint, midenRpcEndpoint })
//   - client.load(accountId, signer) / client.create(config, signer)
//   - multisig.createP2idProposal(recipient, faucet, amount) -> { id, status }
//   - multisig.signProposal(id) · multisig.syncProposals() · multisig.executeProposal(id)
//   - FalconSigner; AuthSecretKey.rpoFalconWithRNG(undefined)  [UNVERIFIED exact ctor]
//
// Requires a self-hosted Guardian server (see docs/GUARDIAN.md → docker compose).
// The human co-signs the pending proposal out-of-band (their own device /
// Subrosa UI) before this resolves to `ready` and executes on-chain.

import { MidenClient, AuthSecretKey } from "@miden-sdk/miden-sdk";
import { MultisigClient, FalconSigner } from "@openzeppelin/miden-multisig-client";
import { GUARDIAN_ENDPOINT, MIDEN_RPC, OBX_FAUCET_HEX } from "./config.js";

export type CoSignResult = { proposalId: string; status: string; txId?: string };

export async function proposeAndCoSign(opts: {
  multisigAccountId: string;
  recipientHex: string;
  amount: bigint;
  waitMs?: number;
}): Promise<CoSignResult> {
  if (!opts.multisigAccountId) {
    throw new Error(
      "SUBROSA_MULTISIG (the 2-of-N agent+human Guardian account) is not set. " +
        "Create it once with MultisigClient.create({ threshold: 2, signerCommitments, guardianCommitment, guardianEnabled: true }).",
    );
  }

  const midenClient = await MidenClient.createTestnet();
  const agentSigner = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));
  const client = new MultisigClient(midenClient, {
    guardianEndpoint: GUARDIAN_ENDPOINT,
    midenRpcEndpoint: MIDEN_RPC,
  });

  const multisig = await client.load(opts.multisigAccountId, agentSigner);

  // (a) agent proposes the trade …
  const proposal = await multisig.createP2idProposal(
    opts.recipientHex,
    OBX_FAUCET_HEX,
    opts.amount,
  );
  // (b) … and co-signs it.
  await multisig.signProposal(proposal.id);

  // (c) wait for the human's co-signature (collected by Guardian) → threshold met.
  // `proposal.status` is a string union ("pending" | "ready" | "finalized" | …).
  const deadline = Date.now() + (opts.waitMs ?? 120_000);
  let status = String(proposal.status);
  while (Date.now() < deadline) {
    const proposals = await multisig.syncProposals();
    const p = proposals.find((x) => x.id === proposal.id);
    status = p ? String(p.status) : status;
    if (status === "ready") break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (status !== "ready") return { proposalId: proposal.id, status };

  // (d) finalize: combine signatures + Guardian ack, submit on-chain.
  await multisig.executeProposal(proposal.id);
  return { proposalId: proposal.id, status: "finalized" };
}
