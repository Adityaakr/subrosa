// @ts-nocheck
// Reusable Guardian 2-of-N co-sign (the verified flow from /cosign.html), used
// as an opt-in authorization gate before a "protected" bet is placed. Collects
// agent + human signatures and executes on-chain via the live Guardian — a real
// co-sign, not a stub.
//
// The multisig is a PERSISTENT identity, not a throwaway: the agent + human
// Falcon secret keys and the resulting account id are saved in localStorage the
// first time, so every later co-sign LOADS the SAME multisig (same mtst… address)
// instead of creating a new account. The keys can be exported for backup and
// re-imported on another device — the same recovery model Miden's own Guardian
// integrations use (your keys authorize the account; the operator only co-signs).
import { MultisigClient, FalconSigner } from "@openzeppelin/miden-multisig-client";
import { MidenClient, AuthSecretKey } from "@miden-sdk/miden-sdk";

const RPC = "https://rpc.testnet.miden.io";
// Bump the version if the stored shape ever changes (abandons old identities).
const KEYS_LS = "subrosa.guardian.identity.v1"; // { agent, human, multisig, createdAt }

// base64 <-> Uint8Array, chunked so a multi-KB Falcon key never overflows the
// call stack via String.fromCharCode(...spread).
const b64enc = (u8) => {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const b64dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function loadIdentity() {
  try { return JSON.parse(localStorage.getItem(KEYS_LS) || "null"); } catch (e) { return null; }
}
function saveIdentity(v) { try { localStorage.setItem(KEYS_LS, JSON.stringify(v)); } catch (e) {} }
const signerFrom = (key64) => new FalconSigner(AuthSecretKey.deserialize(b64dec(key64)));

// ── Backup / restore (key management for Guardian signing) ──────────────────
export function hasGuardianIdentity() {
  const s = loadIdentity();
  return !!(s && s.agent && s.human && s.multisig);
}
export function getGuardianMultisigId() { const s = loadIdentity(); return s?.multisig || null; }
// The downloadable backup blob — the two cosigner secret keys + the account id.
// Whoever holds these keys can co-sign for / recover this multisig.
export function exportGuardianIdentity() {
  const s = loadIdentity();
  if (!s) throw new Error("No Guardian identity yet — run a co-sign first.");
  return { v: 1, network: "MidenTestnet", multisig: s.multisig, agent: s.agent, human: s.human, createdAt: s.createdAt };
}
export function importGuardianIdentity(obj) {
  const o = typeof obj === "string" ? JSON.parse(obj) : obj;
  if (!o || !o.agent || !o.human || !o.multisig) throw new Error("Invalid Guardian backup file.");
  // Validate the keys actually deserialize before persisting.
  signerFrom(o.agent); signerFrom(o.human);
  saveIdentity({ agent: o.agent, human: o.human, multisig: String(o.multisig), createdAt: o.createdAt || new Date().toISOString() });
  return String(o.multisig);
}
export function resetGuardianIdentity() { try { localStorage.removeItem(KEYS_LS); } catch (e) {} }

export async function guardianCoSign(onStep) {
  const step = (m) => { try { onStep && onStep(m); } catch (e) {} };
  const GUARDIAN = `${typeof window !== "undefined" ? window.location.origin : ""}/guardian`;

  step("Connecting to Guardian…");
  const miden = await MidenClient.createTestnet();
  const client = new MultisigClient(miden, { guardianEndpoint: GUARDIAN, midenRpcEndpoint: RPC });

  const stored = loadIdentity();
  const reused = !!(stored && stored.agent && stored.human && stored.multisig);

  let agent, human, accountId, multisig;
  if (reused) {
    // Re-use the SAME multisig: rebuild the cosigners from the saved keys and
    // load the existing account from Guardian (no new account is created).
    step("Loading your Guardian multisig…");
    agent = signerFrom(stored.agent);
    human = signerFrom(stored.human);
    accountId = String(stored.multisig);
    multisig = await client.load(accountId, agent);
  } else {
    // First time: mint a fresh 2-of-N, register it, and persist the keys so it
    // becomes this user's durable Guardian identity.
    step("Creating your Guardian multisig…");
    const agentKey = AuthSecretKey.rpoFalconWithRNG(undefined);
    const humanKey = AuthSecretKey.rpoFalconWithRNG(undefined);
    agent = new FalconSigner(agentKey);
    human = new FalconSigner(humanKey);
    const gp = await client.guardianClient.getPubkey();
    const guardianCommitment = typeof gp === "string" ? gp : gp.commitment;
    multisig = await client.create(
      { threshold: 2, signerCommitments: [agent.commitment, human.commitment], guardianCommitment, guardianEnabled: true },
      agent,
    );
    await multisig.registerOnGuardian();
    accountId = String(multisig.accountId ?? multisig.id ?? "");
    saveIdentity({
      agent: b64enc(agentKey.serialize()),
      human: b64enc(humanKey.serialize()),
      multisig: accountId,
      createdAt: new Date().toISOString(),
    });
  }

  step("Collecting signatures…");
  // Demonstrative 2-of-N action: re-affirm the CURRENT threshold (idempotent, so
  // the multisig stays 2-of-N and is safe to reuse indefinitely). Both cosigners
  // must sign for it to execute — that is the real co-sign.
  const target = Number(multisig.threshold) > 0 ? Number(multisig.threshold) : 2;
  const proposal = await multisig.createChangeThresholdProposal(target);
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
  return { multisig: accountId, reused };
}
