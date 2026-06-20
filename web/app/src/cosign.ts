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
// Bump the version to abandon old identities. v2: earlier builds seeded both
// cosigner keys with rpoFalconWithRNG(undefined), which returns the SAME key —
// so those accounts were registered with two identical signers and can never
// reach threshold 2 (Guardian 409 "already signed"). v2 forces a clean rebuild
// with two distinct CSPRNG-seeded keys; the broken v1 account is never touched.
const KEYS_LS = "subrosa.guardian.identity.v2"; // { agent, human, multisig, createdAt }

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

// rpoFalconWithRNG(undefined) seeds from a DEFAULT and returns the SAME key on
// every call — which would make the two cosigners identical (signerCommitments
// [X, X]) and the 2nd signature a duplicate ("proposal_already_signed", 409).
// Always seed from fresh CSPRNG bytes so each key is distinct.
const randSeed = () => {
  const b = new Uint8Array(32);
  (globalThis.crypto || window.crypto).getRandomValues(b);
  return b;
};
function freshKey() { return AuthSecretKey.rpoFalconWithRNG(randSeed()); }
// Generate two keys whose commitments are guaranteed different.
function freshCosignerKeys() {
  const a = freshKey();
  let h = freshKey();
  for (let i = 0; i < 5 && new FalconSigner(h).commitment === new FalconSigner(a).commitment; i++) h = freshKey();
  return { agentKey: a, humanKey: h };
}

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

// Sign a proposal, treating "already signed by this cosigner" as success. The
// proposal commitment is deterministic (same bet summary → same id), so a retry
// re-signs the SAME proposal and Guardian replies 409 proposal_already_signed —
// which means the signature we wanted is already on file. Swallow only that
// case; surface everything else.
async function signOnce(m, id) {
  try { await m.signProposal(id); }
  catch (e) {
    const s = String((e && (e.message || e.body || e)) || "");
    if (/already.?signed|proposal_already_signed/i.test(s)) return;
    throw e;
  }
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

  // Mint a fresh 2-of-N with two DISTINCT cosigner keys, register on Guardian,
  // persist the keys. Used first-time AND to rebuild any broken account.
  const createFresh = async () => {
    step && step("Creating your Guardian account…");
    const { agentKey, humanKey } = freshCosignerKeys();
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
  };

  const stored = loadIdentity();
  if (!(stored && stored.agent && stored.human)) return createFresh();

  let agent, human;
  try { agent = signerFrom(stored.agent); human = signerFrom(stored.human); }
  catch (e) { return createFresh(); }

  // Saved keys must be two DISTINCT signers, else threshold 2 is unreachable.
  // (Older builds seeded both keys with rpoFalconWithRNG(undefined) → identical
  // keys → the 2nd signature is a duplicate → Guardian 409 "already signed".)
  if (String(agent.commitment).toLowerCase() === String(human.commitment).toLowerCase()) return createFresh();

  let accountId = stored.multisig || null;
  // If we lost the account id (keys-only restore on a new device), ask Guardian
  // which account these keys authorize — the article's cross-device recovery.
  if (!accountId) {
    step && step("Recovering your account from Guardian…");
    try {
      const found = await client.recoverByKey(agent);
      if (found && found.length) accountId = found[0].accountId;
    } catch (e) {}
    if (!accountId) return createFresh();
    saveIdentity({ ...stored, multisig: String(accountId) });
  }

  step && step("Loading your Guardian account…");
  let multisig;
  try {
    multisig = await client.load(String(accountId), agent);
    try { await multisig.syncState(); } catch (e) { /* nothing to sync yet */ }
  } catch (e) { return createFresh(); }

  // Self-heal: if the ACCOUNT itself was registered with duplicate/mismatched
  // signers (a broken account from an earlier build), rebuild a valid one rather
  // than loop on 409s.
  const sc = (multisig.signerCommitments || []).map((s) => String(s).toLowerCase());
  const a = String(agent.commitment).toLowerCase();
  const h = String(human.commitment).toLowerCase();
  const accountOk = new Set(sc).size >= 2 && sc.includes(a) && sc.includes(h);
  if (!accountOk) return createFresh();

  const asHuman = await client.load(String(accountId), human);
  return { client, multisig, asHuman, accountId: String(accountId), reused: true };
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
    await signOnce(multisig, proposal.id);
    await signOnce(asHuman, proposal.id);
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

    // Diagnostics + a hard guard: the two cosigners MUST be distinct, and both
    // must be registered on the account, or threshold 2 is unreachable and
    // Guardian returns 409 "already signed". Surface it clearly instead of
    // looping. (Logs the real commitments so any remaining mismatch is visible.)
    const agentC = String(multisig.signerCommitment || "").toLowerCase();
    const humanC = String(asHuman.signerCommitment || "").toLowerCase();
    const acctSigners = (multisig.signerCommitments || []).map((s) => String(s).toLowerCase());
    console.log("[cosign] account", accountId, "| agent", agentC, "| human", humanC, "| account signers", acctSigners);
    if (agentC && humanC && agentC === humanC) throw new Error("Cosigners identical — account rebuilt; place again.");
    if (acctSigners.length && (!acctSigners.includes(agentC) || !acctSigners.includes(humanC))) {
      throw new Error("Cosigner keys not registered on this account — account rebuilt; place again.");
    }

    step("Building your bet…");
    const req0 = buildRequest(accountId, null);
    const bytes = req0.serialize();

    step("Proposing to Guardian…");
    const proposal = await multisig.createCustomProposal(bytes, "place_bet");

    step("Collecting signatures…");
    await signOnce(multisig, proposal.id);   // agent (hot key)
    await signOnce(asHuman, proposal.id);     // human key → threshold met

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
    await signOnce(multisig, proposal.id);
    await signOnce(asHuman, proposal.id);
    step("Executing co-sign on-chain…");
    await asHuman.executeProposal(proposal.id);
    return { multisig: accountId, reused };
  });
}
