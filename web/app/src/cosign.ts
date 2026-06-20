// @ts-nocheck
// Guardian-protected betting account (the "Guardian model" from OpenZeppelin's
// Miden Guardian writeup, applied to Subrosa).
//
// The 2-of-N multisig IS the user's betting account — not a throwaway ceremony.
// Two Falcon cosigners (an `agent` hot key + a `human` key) authorize the
// account; the Guardian operator co-signs each transaction under policy but
// holds no keys and can never move funds alone. Every protected bet is the
// REAL `place_note` transaction, built FROM the multisig and co-signed
// agent + human + Guardian via the producer API (issue #266), then submitted.
// The chain only ever sees a commitment, so side/size/owner stay private.
//
// Durability + recovery (the article's "second layer" — backing up account
// state without holding keys):
//   • the two Falcon secret keys + the account id are saved in localStorage, so
//     every later action LOADS the same mtst… account instead of minting a new
//     one;
//   • the keys can be exported as a backup file and re-imported on another
//     device — and even WITHOUT the stored account id we can rediscover the
//     account from any device via Guardian's /state/lookup (recoverByKey);
//   • Guardian's snapshot is pulled into the local store before each action
//     (syncState), so a fresh device recovers the latest state in seconds.
import { MultisigClient, FalconSigner } from "@openzeppelin/miden-multisig-client";
import { MidenClient, AuthSecretKey, AccountId } from "@miden-sdk/miden-sdk";

const RPC = "https://rpc.testnet.miden.io";
// Bump the version if the stored shape ever changes (abandons old identities).
const KEYS_LS = "subrosa.guardian.identity.v1"; // { agent, human, multisig, createdAt }

// ── base64 <-> Uint8Array (chunked, so a multi-KB Falcon key never overflows
// the call stack via String.fromCharCode(...spread)). ──────────────────────
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
const guardianEndpoint = () => `${typeof window !== "undefined" ? window.location.origin : ""}/guardian`;

// ── Single cached Miden client + a mutex ────────────────────────────────────
// The WASM client is single-instance: two concurrent calls crash with
// "recursive use". We keep ONE dedicated MidenClient for all Guardian work and
// run every co-sign step through a promise chain so they can never overlap each
// other (the app additionally pauses its market poller while a co-sign runs).
let _miden = null;
let _chain = Promise.resolve();
async function getMiden() {
  if (!_miden) _miden = await MidenClient.createTestnet();
  return _miden;
}
function exclusive(fn) {
  const run = _chain.then(fn, fn);
  _chain = run.then(() => {}, () => {}); // never reject the chain
  return run;
}
function newGuardianClient(miden) {
  return new MultisigClient(miden, { guardianEndpoint: guardianEndpoint(), midenRpcEndpoint: RPC });
}

// ── Backup / restore (key management for Guardian signing) ──────────────────
export function hasGuardianIdentity() {
  const s = loadIdentity();
  return !!(s && s.agent && s.human);
}
export function getGuardianMultisigId() { const s = loadIdentity(); return s?.multisig || null; }
// The downloadable backup blob — the two cosigner secret keys (+ account id as a
// hint). Whoever holds these keys can co-sign for / recover this account.
export function exportGuardianIdentity() {
  const s = loadIdentity();
  if (!s) throw new Error("No Guardian identity yet — place a protected bet first.");
  return { v: 1, network: "MidenTestnet", multisig: s.multisig, agent: s.agent, human: s.human, createdAt: s.createdAt };
}
export function importGuardianIdentity(obj) {
  const o = typeof obj === "string" ? JSON.parse(obj) : obj;
  if (!o || !o.agent || !o.human) throw new Error("Invalid Guardian backup file.");
  signerFrom(o.agent); signerFrom(o.human); // validate the keys deserialize before persisting
  saveIdentity({ agent: o.agent, human: o.human, multisig: o.multisig ? String(o.multisig) : null, createdAt: o.createdAt || new Date().toISOString() });
  return o.multisig ? String(o.multisig) : null;
}
export function resetGuardianIdentity() { try { localStorage.removeItem(KEYS_LS); } catch (e) {} }

// ── Prepare the betting account (create, or load/recover an existing one) ────
// Returns the live `Multisig` handle (authorized by the AGENT cosigner), its
// human-authorized twin (for the second signature), the account id, and whether
// it was reused. State is synced from Guardian into the local store so the
// account is ready to transact.
async function openBettingAccount(step) {
  const miden = await getMiden();
  const client = newGuardianClient(miden);
  const stored = loadIdentity();

  if (stored && stored.agent && stored.human) {
    const agent = signerFrom(stored.agent);
    const human = signerFrom(stored.human);
    let accountId = stored.multisig || null;

    // If we lost the account id (e.g. restored keys-only on a new device), ask
    // Guardian which account this key authorizes — the article's cross-device
    // recovery, no seed-phrase juggling.
    if (!accountId) {
      step && step("Recovering your account from Guardian…");
      const found = await client.recoverByKey(agent);
      if (found && found.length) accountId = found[0].accountId;
      if (!accountId) throw new Error("No Guardian account found for these keys.");
      saveIdentity({ ...stored, multisig: String(accountId) });
    }

    step && step("Loading your Guardian account…");
    const multisig = await client.load(String(accountId), agent);
    try { await multisig.syncState(); } catch (e) { /* first use / nothing to sync yet */ }
    const asHuman = await client.load(String(accountId), human);
    return { client, multisig, asHuman, accountId: String(accountId), reused: true };
  }

  // First time: mint a fresh 2-of-N, register it on Guardian, persist the keys.
  step && step("Creating your Guardian account…");
  const agentKey = AuthSecretKey.rpoFalconWithRNG(undefined);
  const humanKey = AuthSecretKey.rpoFalconWithRNG(undefined);
  const agent = new FalconSigner(agentKey);
  const human = new FalconSigner(humanKey);
  const gp = await client.guardianClient.getPubkey();
  const guardianCommitment = typeof gp === "string" ? gp : gp.commitment;
  const multisig = await client.create(
    { threshold: 2, signerCommitments: [agent.commitment, human.commitment], guardianCommitment, guardianEnabled: true },
    agent,
  );
  await multisig.registerOnGuardian();
  const accountId = String(multisig.accountId ?? multisig.id ?? "");
  saveIdentity({ agent: b64enc(agentKey.serialize()), human: b64enc(humanKey.serialize()), multisig: accountId, createdAt: new Date().toISOString() });
  const asHuman = await client.load(accountId, human);
  return { client, multisig, asHuman, accountId, reused: false };
}

// Just ensure the account exists (used to fund it / show its address) without
// running a transaction.
export async function prepareBettingAccount(onStep) {
  return exclusive(async () => {
    const { accountId, reused } = await openBettingAccount(onStep);
    return { multisig: accountId, reused };
  });
}

// ── Fund the betting account (mint OBX to it, claim via a co-signed consume) ─
// `mintObx(accountId) => Promise<any>` is supplied by the app (it owns the
// faucet). We mint a note to the multisig, then consume it with a real 2-of-N +
// Guardian co-signed `consume_notes` proposal — so even RECEIVING funds is
// Guardian-co-signed, exactly as the article describes. Returns how many notes
// were claimed.
export async function fundBettingAccount({ mintObx, onStep }) {
  const step = (m) => { try { onStep && onStep(m); } catch (e) {} };
  return exclusive(async () => {
    const { multisig, asHuman, accountId } = await openBettingAccount(step);

    step("Minting test-OBX to your Guardian account…");
    await mintObx(accountId);

    // Let the mint land, then sync so the note is locally consumable.
    await new Promise((r) => setTimeout(r, 2500));
    try { await multisig.syncState(); } catch (e) {}
    const notes = await multisig.getConsumableNotes();
    const ids = (notes || []).map((n) => n.noteId ?? n.id ?? n).filter(Boolean).map(String);
    if (!ids.length) throw new Error("No consumable note found yet — try funding again in a moment.");

    step("Claiming funds (Guardian co-sign)…");
    const proposal = await multisig.createConsumeNotesProposal(ids);
    await multisig.signProposal(proposal.id);
    await asHuman.signProposal(proposal.id);
    step("Executing on-chain…");
    await asHuman.executeProposal(proposal.id);
    return { multisig: accountId, claimed: ids.length };
  });
}

// ── Co-sign + submit a bet FROM the multisig (the article model) ────────────
// `buildRequest(adviceMap | null) => TransactionRequest` MUST be deterministic:
// the same call (same captured note serial) has to reproduce byte-for-byte, so
// the summary committed at propose time matches the one verified at execute
// time. We build it once for the proposal, collect agent + human + Guardian
// signatures, then rebuild it with Guardian's advice folded in and submit.
export async function coSignSubmitBet({ buildRequest, onStep }) {
  const step = (m) => { try { onStep && onStep(m); } catch (e) {} };
  return exclusive(async () => {
    const { multisig, asHuman, accountId } = await openBettingAccount(step);

    step("Building your bet…");
    const req0 = buildRequest(accountId, null);
    const bytes = req0.serialize();

    step("Proposing to Guardian…");
    const proposal = await multisig.createCustomProposal(bytes, "place_bet");

    step("Collecting signatures…");
    await multisig.signProposal(proposal.id);   // agent (hot key)
    await asHuman.signProposal(proposal.id);     // human key → threshold met

    step("Guardian co-signing…");
    const advice = await multisig.prepareCustomExecution(proposal.id, bytes);

    step("Submitting on-chain…");
    const reqFinal = buildRequest(accountId, advice);
    await multisig.submitTransaction(reqFinal);

    return { multisig: accountId };
  });
}

// ── Legacy ceremony co-sign (Approvals demo) ────────────────────────────────
// A real 2-of-N + Guardian co-sign that re-affirms the current threshold
// (idempotent). Kept for the agent-approval demo flow; the bet path above uses
// the producer API so the BET itself is what gets co-signed.
export async function guardianCoSign(onStep) {
  const step = (m) => { try { onStep && onStep(m); } catch (e) {} };
  return exclusive(async () => {
    const { multisig, asHuman, accountId, reused } = await openBettingAccount(step);
    step("Collecting signatures…");
    const target = Number(multisig.threshold) > 0 ? Number(multisig.threshold) : 2;
    const proposal = await multisig.createChangeThresholdProposal(target);
    await multisig.signProposal(proposal.id);
    await asHuman.signProposal(proposal.id);
    step("Executing co-sign on-chain…");
    await asHuman.executeProposal(proposal.id);
    return { multisig: accountId, reused };
  });
}
