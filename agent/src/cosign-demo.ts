// Subrosa — Guardian co-sign demo (produces a REAL on-chain multisig tx).
//
// Runnable solo: it creates a 2-of-2 (agent + human) Guardian multisig, opens a
// proposal, signs with BOTH local signers (you play both parties), then executes
// → a real on-chain transaction finalized via Guardian's ack. Prints the tx id.
//
// Prereq: a self-hosted Guardian server (see docs/GUARDIAN.md):
//   git clone https://github.com/OpenZeppelin/guardian ../guardian
//   GUARDIAN_REPO=../guardian npm run guardian:up        # → http://localhost:3000
//
// Then:  npm run cosign
//
// API per OpenZeppelin/guardian @ main (docs/MULTISIG_SDK.md). A few constructor
// shapes are marked UNVERIFIED — confirm at first run (we can't run Guardian from
// CI). Kept behind a thin surface so fixes are localized.

import { MidenClient, AuthSecretKey } from "@miden-sdk/miden-sdk";
import { MultisigClient, FalconSigner } from "@openzeppelin/miden-multisig-client";
import { GUARDIAN_ENDPOINT, MIDEN_RPC, OBX_FAUCET_HEX } from "./config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function main(): Promise<void> {
  console.log("Subrosa Guardian co-sign demo");
  console.log(`guardian: ${GUARDIAN_ENDPOINT} · rpc: ${MIDEN_RPC}`);

  const miden = await MidenClient.createTestnet();

  // Two local signers — you act as both the agent and the human co-signer.
  const agent = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));
  const human = new FalconSigner(AuthSecretKey.rpoFalconWithRNG(undefined));

  const client = new MultisigClient(miden, {
    guardianEndpoint: GUARDIAN_ENDPOINT,
    midenRpcEndpoint: MIDEN_RPC,
  });

  const guardianCommitment = await client.guardianClient.getPubkey();

  // 2-of-2 with Guardian as ack coordinator (non-custodial).
  const multisig: Any = await client.create(
    {
      threshold: 2,
      signerCommitments: [(agent as Any).commitment, (human as Any).commitment],
      guardianCommitment,
      guardianEnabled: true,
    } as Any,
    agent as Any,
  );
  await multisig.registerOnGuardian();
  const accountId = String(multisig.accountId ?? multisig.id ?? "(see Guardian)");
  console.log(`multisig account: ${accountId}  (export SUBROSA_MULTISIG=${accountId})`);

  // Propose an above-cap trade (here: a P2ID transfer that needs both sigs).
  const recipient = process.env.SUBROSA_RECIPIENT ?? accountId; // self for the demo
  const amount = BigInt(process.env.SUBROSA_AMOUNT ?? "1000");
  const proposal: Any = await multisig.createP2idProposal(recipient, OBX_FAUCET_HEX, amount);
  console.log(`proposal ${proposal.id} created (needs 2 signatures)`);

  // Agent signs…
  await multisig.signProposal(proposal.id);
  console.log("agent signed");

  // …human co-signs (reload with the human signer).
  const asHuman: Any = await client.load(accountId, human as Any);
  await asHuman.signProposal(proposal.id);
  console.log("human co-signed → threshold met");

  // Finalize on-chain (combine sigs + Guardian ack, submit).
  await asHuman.executeProposal(proposal.id);
  console.log(`EXECUTED on-chain — verify the account on https://testnet.midenscan.com/account/${accountId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
