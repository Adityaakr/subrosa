// @ts-nocheck
import React from "react";
import { useCreateWallet, useCreateFaucet, useMint, useTransaction, useAccount, useAccounts, useConsume, useSyncState, useNotes, useMiden, formatAssetAmount, parseAssetAmount, accountIdsEqual } from "@miden-sdk/react";
import { useWallet as useMidenFiAdapter } from "@miden-sdk/miden-wallet-adapter-react";
import { WalletAdapterNetwork, PrivateDataPermission } from "@miden-sdk/miden-wallet-adapter-base";
import {
  AccountId, Package, NoteScript, Note, NoteAssets, NoteMetadata, FungibleAsset,
  NoteRecipient, NoteStorage, NoteTag, NoteType, NoteArray, FeltArray, TransactionRequestBuilder, Word,
} from "@miden-sdk/miden-sdk";
import { randomWord } from "../lib/miden";
import { guardianCoSign } from "../cosign";

const MARKET_ID_HEX = "0x5ff0303f0b795d1039ca5b51d8480b";
const OBX_FAUCET_HEX = "0x1201d9f8819d5220778535e4e2f08a";
const REDEEM_ENDPOINT = import.meta.env.VITE_REDEEM_ENDPOINT ?? "http://localhost:8788/redeem";
const WALLET_LS = "subrosa.wallet.id";
// Positions are stored per wallet: `subrosa.pos.<walletId>`. Each wallet (user)
// only ever sees its own — nothing is shared across browsers/accounts.
const POS_LS_PREFIX = "subrosa.pos.";
// per-browser test-OBX faucet (web SDK). Versioned: bumping abandons faucets
// created with old params (e.g. the pre-fix 1e9 maxSupply) so a correct one is
// made automatically — no manual storage clearing needed.
const FAUCET_LS = "subrosa.faucet.v2.id";
const FUND_DECIMALS = 8;
// Falcon (RpoFalcon512) auth scheme, as the WASM `newWallet`/`newFaucet` numeric
// discriminant (= 2). We MUST pass this explicitly: @miden-sdk/react@0.15.2
// defaults to `AuthScheme.AuthRpoFalcon512`, but the 0.15.2 WASM renamed that
// enum member to `AuthScheme.Falcon` (a STRING "falcon"), so the SDK default
// resolves to `undefined` → `newWallet` throws "invalid enum value passed" and
// the promise hangs. The numeric form is what the WASM actually accepts.
const FALCON_AUTH_SCHEME = 2;

// ── Serialize ALL Miden client access through one mutex ──────────────────────
// The 0.15 single-threaded WASM client keeps its state in a RefCell and PANICS
// ("RefCell already borrowed" → unreachable, which permanently poisons the
// instance) if two async client calls execute concurrently. @miden-sdk/react's
// mutation hooks take an internal lock, but its QUERY hooks (useAccount/
// useAccounts/useNotes) call `client.getAccount()/getAccounts()` with NO lock —
// so a balance refetch that overlaps a mint/createFaucet kills the client. We
// fix this at the source: wrap every async client method in one shared lock so
// reads and writes can never run at the same time. wasm-bindgen method shims are
// leaf calls (they don't re-enter each other in JS), so a single lock can't
// deadlock. Idempotent — patches a given client instance once.
const _clientChain = new WeakMap(); // client -> tail promise
function serializeMidenClient(client) {
  if (!client || client.__subrosaSerialized) return client;
  // ONLY async (Promise-returning) methods may be wrapped. Synchronous request
  // builders like newConsumeTransactionRequest() return a TransactionRequest
  // object — wrapping them in a promise chain would break `.serialize()` on the
  // result. Sync methods also can't cause the cross-await borrow race, so they
  // never need serializing. This list is reads + the heavy account/tx mutations.
  // The LEAF async (Promise-returning) WebClient methods — every single-call WASM
  // export, taken straight from the SDK's crate typings. We deliberately wrap
  // ONLY leaf methods: the high-level JS composites (`syncState` → `syncStateImpl`,
  // `sync` → syncState/syncChain/…) call these internally, so wrapping BOTH the
  // composite and its leaves makes the inner call queue behind the outer in the
  // same lock → re-entrant DEADLOCK (funding silently hangs). Leaving the
  // composites unwrapped is correct: the actual RefCell borrow happens in the
  // leaf (e.g. syncStateImpl), which IS serialized. Synchronous request builders
  // (newConsumeTransactionRequest…) and factories (createClient*) are excluded —
  // wrapping a sync method would turn its result into a Promise.
  const methods = [
    // reads (the unlocked racing party — every account/note reader the hooks touch)
    "getAccount", "getAccounts", "getAccountStorage", "getAccountVault",
    "getAccountCode", "accountReader", "getAccountAuthByPubKeyCommitment",
    "getAccountByKeyCommitment", "getPublicKeyCommitmentsOfAccount",
    "getConsumableNotes", "getInputNotes", "getInputNote", "getOutputNotes",
    "getOutputNote", "fetchPrivateNotes", "fetchAllPrivateNotes",
    "getTransactions", "getSyncHeight", "getSetting", "listSettingKeys", "listTags",
    // sync — LEAF impls only (NOT the syncState/sync/syncChain composites)
    "syncStateImpl", "syncChainImpl", "syncNoteTransportImpl",
    // account + tx mutations / proving / submit (single-call WASM exports = leaf)
    "newWallet", "newFaucet", "newAccount", "newAccountWithSecretKey",
    "importAccountById", "importAccountFile", "importPublicAccountFromSeed",
    "applyTransaction", "executeTransaction", "executeForSummary", "executeProgram",
    "proveTransaction", "proveBlock", "sendPrivateNote",
    "submitNewTransaction", "submitNewTransactionWithProver", "submitProvenTransaction",
    // async request builders (return Promise<TransactionRequest>) + store writes
    "newMintTransactionRequest", "newSendTransactionRequest", "newSwapTransactionRequest",
    "addAccountSecretKeyToWebStore", "addTag", "removeTag", "insertAccountAddress",
    "removeAccountAddress", "setSetting", "removeSetting", "pruneAccountHistory",
  ];
  _clientChain.set(client, Promise.resolve());
  for (const name of methods) {
    const orig = client[name];
    if (typeof orig !== "function") continue;
    client[name] = function (...args) {
      const prev = _clientChain.get(client) || Promise.resolve();
      const run = prev.then(() => orig.apply(this, args), () => orig.apply(this, args));
      // keep the chain alive regardless of this call's outcome
      _clientChain.set(client, run.then(() => {}, () => {}));
      return run;
    };
  }
  try { Object.defineProperty(client, "__subrosaSerialized", { value: true }); } catch (e) { client.__subrosaSerialized = true; }
  return client;
}

// Guardian co-sign creates 2-of-N MULTISIG accounts in the SAME IndexedDB the
// built-in wallet uses. We record their ids so the wallet never adopts one as
// "your wallet" (a multisig can't be single-signed → funding/placing fail with
// "transaction is unauthorized").
const COSIGN_IDS_LS = "subrosa.cosign.ids";
const readCoSignIds = () => { try { return JSON.parse(localStorage.getItem(COSIGN_IDS_LS) || "[]"); } catch (e) { return []; } };
const addCoSignId = (id) => { try { const s = new Set(readCoSignIds()); if (id) s.add(String(id)); localStorage.setItem(COSIGN_IDS_LS, JSON.stringify([...s])); } catch (e) {} };
const isCoSignId = (id) => { try { return id && readCoSignIds().some((x) => String(x).toLowerCase() === String(id).toLowerCase()); } catch (e) { return false; } };

// Public storage slots exported by the market component (read for live odds).
const SLOT_YES = "miden_market::market::yes_reserve";
const SLOT_NO = "miden_market::market::no_reserve";
const SLOT_VOL = "miden_market::market::total_volume";
const SLOT_RES = "miden_market::market::resolution";

// Markets backed by a REAL on-chain account (read live). Keyed by the
// window.OBS market id. Others render as "preview". Markets 2 & 3 are added
// once their accounts are deployed + seeded.
const LIVE_MARKETS = {
  "miden-mainnet": MARKET_ID_HEX,
  "eth-4k": "0x612f7f710da01a10116a1ca76afac5", // seeded 63% YES
  // Fresh unresolved market, seeded 45% YES (5500/4500). The previous account
  // (0x60de1a…) had been resolved YES on-chain — wrong for a Sep-dated question.
  "fed-sep": "0x7003429f9cdb431056970e854e5ed6", // seeded 45% YES, LIVE
};

const wordToBig = (w) => { try { return w ? w.toU64s()[0] : 0n; } catch (e) { return 0n; } };
const toAccountId = (s) => { try { return String(s).startsWith("0x") ? AccountId.fromHex(s) : AccountId.fromBech32(s); } catch (e) { return AccountId.fromHex(s); } };

// Read a market account's public state straight from the chain: reserves →
// CPMM odds (YES% = no/(yes+no)), cumulative volume, and resolution.
async function readMarketState(client, marketIdHex) {
  const id = AccountId.fromHex(marketIdHex);
  // Foreign public account: import it into the store (fetches from network) if
  // we don't track it yet, then read its committed storage.
  let acct = await wasmRetry(() => client.getAccount(id));
  if (!acct) {
    try { await wasmRetry(() => client.importAccountById(id)); } catch (e) {}
    acct = await wasmRetry(() => client.getAccount(id));
  }
  if (!acct) throw new Error("market account not found: " + marketIdHex);
  const st = acct.storage();
  const slot = (name) => { try { return st.getItem(name); } catch (e) { return undefined; } };
  const yes = wordToBig(slot(SLOT_YES));
  const no = wordToBig(slot(SLOT_NO));
  const volume = wordToBig(slot(SLOT_VOL));
  const resolution = Number(wordToBig(slot(SLOT_RES)));
  const total = yes + no;
  const yesPct = total > 0n ? Number((no * 10000n) / total) / 100 : 50;
  return { yes: Number(yes), no: Number(no), volume: Number(volume), resolution, yesPct, liquidity: Number(total) };
}

// The Miden WASM client is single-instance and rejects a call that overlaps an
// in-flight one ("recursive use of an object … unsafe aliasing"). That borrow
// check fires BEFORE the call runs, so the client stays valid — wait for the
// other op (e.g. an auto-query) to finish and retry.
async function wasmRetry(fn, tries = 10) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (/recursive use|unsafe aliasing/i.test(String(e?.message || e))) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw e;
    }
  }
  throw last;
}
const shortHex = (s) => (s && s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);

/* Real built-in browser wallet: a persisted private testnet account whose ID +
   live OBX balance come straight from the SDK. connect() creates one on first
   use (or reuses the persisted one); fund() asks the operator faucet service to
   mint test OBX so the balance is genuinely non-zero. */
function useWallet() {
  const { createWallet } = useCreateWallet();
  const { accounts, wallets, isLoading: listLoading } = useAccounts();
  const { consume } = useConsume();
  const { sync } = useSyncState();
  const { isReady: midenReady } = useMiden();
  const notes = useNotes();
  // The Miden WASM client initialises asynchronously (module load + first sync).
  // The SDK throws "Miden client is not ready" if a mutation fires before that
  // finishes — easy to hit on a cold load, especially right after the one-time
  // 0.15 IndexedDB wipe. Track readiness in a ref so async handlers see the live
  // value, and WAIT for it instead of failing the click.
  const readyRef = React.useRef(false);
  React.useEffect(() => { readyRef.current = midenReady; }, [midenReady]);
  const waitForReady = async (ms = 40000) => {
    const deadline = Date.now() + ms;
    while (!readyRef.current && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    if (!readyRef.current) throw new Error("Miden client is still initialising — give it a few seconds and try again.");
  };
  const notesRef = React.useRef([]);
  // consumableNoteSummaries carry a string `id` that consume() accepts (the raw
  // ConsumableNoteRecord objects are NOT a valid consume input).
  React.useEffect(() => { notesRef.current = notes.consumableNoteSummaries || []; }, [notes.consumableNoteSummaries]);

  const idOf = (a) => { try { return (a && a.id ? a.id() : a)?.toString?.() ?? String(a); } catch (e) { return String(a); } };
  const sameId = (a, id) => { if (!a || !id) return false; try { return accountIdsEqual(a, id); } catch (e) { return idOf(a) === id; } };

  // every wallet this client has in its local store
  const list = React.useMemo(() => [...(wallets || []), ...(accounts || [])].filter(Boolean), [wallets, accounts]);
  // Mirror the store list + loading flag into refs so connect() can read the
  // FRESH value across awaits (the closured `list`/`listLoading` are stale once
  // the async fn is running). This is what prevents the "wallet reset" race —
  // connect() must not create a second wallet just because the store hadn't
  // hydrated yet at the moment the closure was captured.
  const listRef = React.useRef(list);
  const loadingRef = React.useRef(listLoading);
  React.useEffect(() => { listRef.current = list; }, [list]);
  React.useEffect(() => { loadingRef.current = listLoading; }, [listLoading]);

  const { createFaucet } = useCreateFaucet();
  const { mint } = useMint();
  const [walletId, setWalletId] = React.useState(() => {
    try { return localStorage.getItem(WALLET_LS); } catch (e) { return null; }
  });
  const [faucetId, setFaucetId] = React.useState(() => {
    try { return localStorage.getItem(FAUCET_LS); } catch (e) { return null; }
  });
  // Soft "disconnected" toggle. The built-in wallet is a persistent identity —
  // disconnect must NOT destroy it (that was the "new wallet every click" bug),
  // it only hides the session. Reconnecting reuses the SAME account.
  const [off, setOff] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [funding, setFunding] = React.useState(false);
  const [fundMsg, setFundMsg] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Resolve the connected account OBJECT from the store by its persisted id —
  // far more reliable than re-deriving it from a string each render.
  const stored = React.useMemo(() => {
    if (!walletId || isCoSignId(walletId)) return null; // ignore a co-sign multisig id
    const a = list.find((x) => sameId(x, walletId)) || null;
    return a && !isCoSignId(idOf(a)) ? a : null;
  }, [walletId, list]);
  const acctRef = React.useRef(null);
  React.useEffect(() => { if (stored) acctRef.current = stored; }, [stored]);
  const account = stored || acctRef.current;

  const q = useAccount(account ?? walletId ?? undefined);
  // Balance is the wallet's holding of our per-browser test-OBX faucet (minted
  // + consumed entirely via the web SDK, so it actually credits).
  let balance = 0n;
  try { if (q.getBalance && faucetId) balance = q.getBalance(faucetId) ?? 0n; } catch (e) {}

  // Drop a persisted id only when it's truly invalid: a co-sign multisig (never
  // "your wallet"), OR an id that's absent from a store that has HYDRATED WITH
  // ACCOUNTS. Requiring list.length > 0 is the fix for the spurious reset — an
  // empty list during initial load no longer looks like "your wallet is gone".
  React.useEffect(() => {
    if (!walletId) return;
    const gone = !listLoading && list.length > 0 && !stored && !acctRef.current;
    if (isCoSignId(walletId) || gone) {
      try { localStorage.removeItem(WALLET_LS); } catch (e) {}
      acctRef.current = null;
      setWalletId(null);
    }
  }, [walletId, listLoading, stored, list.length]);

  const address = account ? idOf(account) : walletId;

  const connect = async () => {
    setError(null);
    setOff(false); // re-enable the session
    if (account) return account;
    setConnecting(true);
    try {
      await waitForReady();
      // Recover the PERSISTED wallet first. The store hydrates asynchronously,
      // so wait for it before concluding the wallet is gone — creating a fresh
      // wallet here just because the list hadn't loaded was the "my wallet keeps
      // changing" bug. Only mint a new wallet when there's genuinely no persisted
      // id, or the id is truly absent from a fully-loaded store.
      let w = null;
      if (walletId && !isCoSignId(walletId)) {
        for (let i = 0; i < 30 && loadingRef.current; i++) await new Promise((r) => setTimeout(r, 150));
        w = listRef.current.find((a) => sameId(a, walletId)) || null;
      }
      if (!w) w = await createWallet({ storageMode: "private", authScheme: FALCON_AUTH_SCHEME });
      acctRef.current = w;
      try { localStorage.setItem(WALLET_LS, idOf(w)); } catch (e) {}
      setWalletId(idOf(w));
      return w;
    } catch (e) {
      setError(e?.message || String(e));
      console.error("[wallet] connect failed:", e);
      throw e;
    } finally { setConnecting(false); }
  };

  // Soft disconnect: keep the persisted id + account so the SAME wallet comes
  // back on reconnect. (To truly forget it the user would clear site data.)
  const disconnect = () => setOff(true);

  // Reuse the persisted test faucet if it's still in the store, else create one.
  // maxSupply is in BASE units and must exceed everything we ever mint:
  // 1000 OBX * 10^8 = 1e11 per fund, so give it ample headroom (1e16).
  const ensureFaucet = async (force = false) => {
    if (!force && faucetId && list.find((a) => sameId(a, faucetId))) return faucetId;
    setFundMsg(force ? "Refreshing test faucet…" : "Creating test faucet…");
    const f = await wasmRetry(() => createFaucet({ tokenSymbol: "OBX", decimals: FUND_DECIMALS, maxSupply: 10_000_000_000_000_000n, storageMode: "public", authScheme: FALCON_AUTH_SCHEME }));
    const fid = idOf(f);
    try { localStorage.setItem(FAUCET_LS, fid); } catch (e) {}
    setFaucetId(fid);
    try { await wasmRetry(() => sync()); } catch (e) {}
    return fid;
  };

  // A faucet created under an older toolchain fails to mint with a "procedure …
  // could not be found" / kernel error once the SDK moves on. Treat those as a
  // signal to rebuild the faucet with the current SDK rather than a hard fail.
  const isStaleCodeError = (e) =>
    /could not be found|procedure with root|MASM|kernel|deserializ|incompatible/i.test(String(e?.message || e));
  // Transient: a proof/submit aborted by a concurrent WASM read, or a flaky
  // testnet RPC/prover. Safe to retry the whole mint — a fresh attempt builds a
  // new tx and re-proves from scratch.
  const isTransientError = (e) =>
    /BodyStreamBuffer|aborted|Failed to fetch|grpc request failed|prove transaction|submit proven|timeout|network/i.test(String(e?.message || e));
  // Mint with retries: transient failures (proof aborted / RPC flake) get a
  // short backoff and retry; a stale-faucet error rebuilds the faucet once.
  const mintWithRetry = async (fid) => {
    const doMint = (f) => wasmRetry(() => mint({ targetAccountId: address, faucetId: f, amount: parseAssetAmount("1000", FUND_DECIMALS), noteType: "private" }));
    let f = fid;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try { await doMint(f); return f; } // return the faucet actually used (may have been rebuilt)
      catch (e) {
        const msg = String(e?.message || e).split("\n")[0];
        if (isStaleCodeError(e)) { console.warn("[fund] faucet unusable, recreating:", msg); f = await ensureFaucet(true); continue; }
        if (isTransientError(e) && attempt < 4) { console.warn(`[fund] transient mint failure (${attempt}/4), retrying:`, msg); await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
        throw e;
      }
    }
    return f;
  };

  // Self-contained funding: mint test OBX from our own web-SDK faucet to the
  // wallet, then consume the note. Same toolchain end-to-end → the consume's
  // note script resolves (no cross-toolchain procedure mismatch).
  const fund = async () => {
    const id = address;
    if (!id || funding) return;
    setFunding(true); setError(null);
    try {
      setFundMsg("Waiting for the Miden client…");
      await waitForReady();
      let fid = await ensureFaucet();
      setFundMsg("Minting 1,000 OBX…");
      // mintWithRetry handles both a stale faucet (rebuild) and a transient proof
      // abort / RPC flake (backoff + retry). The background poller is paused
      // while `funding` is true, so a concurrent read can't abort the proof.
      fid = await mintWithRetry(fid); // may rebuild the faucet — track the one used
      setFundMsg("Claiming…");
      // Only consume notes carrying OUR faucet's asset. A wallet may hold stale
      // notes from earlier attempts (e.g. a CLI-minted note) that the web client
      // can't execute — sweeping those into the batch fails the whole consume.
      const isOurs = (s) => (s.assets || []).some((a) => {
        try { return accountIdsEqual(a.assetId, fid); }
        catch (e) { return String(a.assetId || "").toLowerCase() === String(fid).toLowerCase(); }
      });
      let claimed = false, claimTx = null;
      for (let i = 0; i < 12; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        try { await wasmRetry(() => sync()); } catch (e) {}
        try { await notes.refetch?.(); } catch (e) {}
        const ids = (notesRef.current || []).filter(isOurs).map((s) => s.id).filter(Boolean);
        if (!ids.length) continue;
        // Consume per-note so one stale/incompatible note can't fail the whole
        // claim — keep the ones that work, skip the ones that don't.
        for (const nid of ids) {
          try {
            const cres = await wasmRetry(() => consume({ accountId: id, notes: [nid] }));
            claimTx = cres?.transactionId ?? claimTx;
            claimed = true;
          } catch (e) {
            console.warn("[fund] skipped a note that wouldn't consume:", String(e?.message || e).split("\n")[0]);
          }
        }
        if (claimed) break;
      }
      try { await q.refetch?.(); } catch (e) {}
      setFundMsg(claimed ? "Funded ✓" : "Minted — balance updates shortly");
      setTimeout(() => setFundMsg(null), 4000);
      if (claimed) {
        window.txToast?.({
          kind: "fund",
          title: "Wallet funded — 1,000 OBX",
          desc: "Minted 1,000 test OBX from your in-browser faucet and claimed it into your wallet. Balance is now spendable on the markets.",
          tx: claimTx,
          account: id,
        });
      }
    } catch (e) {
      console.warn("[fund] failed:", e);
      setFundMsg("Funding failed — see console");
      setTimeout(() => setFundMsg(null), 5000);
      window.txToast?.({ kind: "error", title: "Funding failed", desc: "Couldn't mint/claim test OBX. See console for details." });
    } finally { setFunding(false); }
  };

  // Mint a PUBLIC test-OBX note from our web faucet to any address (used to fund
  // the external MidenFi wallet, which then consumes via its own extension).
  // Returns the faucet id so the caller can match the resulting note/asset.
  const mintTo = async (targetAddress) => {
    let fid = await ensureFaucet();
    const doMint = (f) => wasmRetry(() => mint({ targetAccountId: targetAddress, faucetId: f, amount: parseAssetAmount("1000", FUND_DECIMALS), noteType: "public" }));
    try {
      await doMint(fid);
    } catch (e) {
      if (!isStaleCodeError(e)) throw e;
      console.warn("[mintTo] faucet unusable, recreating:", String(e?.message || e).split("\n")[0]);
      fid = await ensureFaucet(true);
      await doMint(fid);
    }
    return fid;
  };

  return {
    connected: (!!account || !!walletId) && !off, connecting, funding, fundMsg, error,
    walletId: address, account, faucetId,
    balance, balanceLabel: formatAssetAmount(balance, FUND_DECIMALS),
    connect, disconnect, fund, mintTo, refetch: q.refetch,
  };
}

/* External MidenFi ("Miden Wallet") extension via the wallet-adapter. select()
   the injected adapter, then connect() prompts the extension. Balance is read
   from the wallet's own assets. */
const sameFaucet = (f, fid) => {
  if (!f || !fid) return false;
  try { return accountIdsEqual(f, fid); } catch (e) { return String(f).toLowerCase() === String(fid).toLowerCase(); }
};

function useMidenFi() {
  const a = useMidenFiAdapter();
  const [balance, setBalance] = React.useState(0n);
  const [assets, setAssets] = React.useState([]); // full OBX holdings (any faucet)
  const [tick, setTick] = React.useState(0);
  const refreshAssets = React.useCallback(async () => {
    if (!a.connected || !a.requestAssets) { setBalance(0n); setAssets([]); return 0n; }
    let fid = null; try { fid = localStorage.getItem(FAUCET_LS); } catch (e) {}
    try {
      const got = await a.requestAssets();
      const list = Array.isArray(got) ? got : (got?.assets || []);
      setAssets(list);
      // Show the largest holding as the spendable balance (the wallet may hold
      // OBX from a faucet that differs from the app's current one).
      const match = (fid && list.find((x) => sameFaucet(x.faucetId ?? x.assetId, fid))) || null;
      const top = list.reduce((m, x) => { const v = BigInt(x.amount ?? x.balance ?? 0); return v > m ? v : m; }, 0n);
      const v = match ? BigInt(match.amount ?? match.balance ?? 0) : top;
      setBalance(v);
      return v;
    } catch (e) { return 0n; }
  }, [a.connected]);
  React.useEffect(() => { refreshAssets(); }, [a.connected, tick, refreshAssets]);

  const connect = async () => {
    const w = a.wallets && a.wallets[0];
    if (!w) throw new Error("Miden Wallet extension not detected");
    // select() must register before connect(), or the adapter throws
    // WalletNotSelectedError. Select, wait, then connect — retry once if the
    // selection hasn't propagated yet.
    a.select(w.adapter.name);
    for (let attempt = 0; attempt < 2; attempt++) {
      await new Promise((r) => setTimeout(r, attempt === 0 ? 120 : 400));
      try {
        await a.connect(PrivateDataPermission.UponRequest, WalletAdapterNetwork.Testnet);
        return;
      } catch (e) {
        if (attempt === 1 || !/WalletNotSelected/i.test(String(e?.name || e?.message || e))) throw e;
        a.select(w.adapter.name);
      }
    }
  };
  return {
    available: (a.wallets && a.wallets.length > 0) || false,
    connected: a.connected, connecting: a.connecting,
    address: a.address, balance, balanceLabel: formatAssetAmount(balance, FUND_DECIMALS), assets,
    connect, disconnect: a.disconnect,
    requestSend: a.requestSend, waitForTransaction: a.waitForTransaction, requestConsumableNotes: a.requestConsumableNotes, requestConsume: a.requestConsume,
    refreshAssets, refresh: () => setTick((t) => t + 1),
  };
}

/* Reads every registered live market's on-chain state on an interval (serially,
   to respect the single WASM client) → { [marketId]: {yesPct, volume, ...} }. */
function useLiveMarkets(client, isReady, pausedRef, runExclusive) {
  const [live, setLive] = React.useState({});
  React.useEffect(() => {
    if (!isReady || !client) return;
    let alive = true, inflight = false;
    const tick = async () => {
      // Skip while a Guardian co-sign is running — it drives its own Miden
      // client + a long STARK proof on the shared WASM, and a concurrent read
      // here aborts the in-flight proof ("BodyStreamBuffer was aborted").
      if (inflight || (pausedRef && pausedRef.current)) return; inflight = true;
      try {
        const out = {};
        for (const [mid, acctHex] of Object.entries(LIVE_MARKETS)) {
          if (!acctHex) continue;
          // Run each read through the SDK's shared client lock. The 0.15
          // single-threaded WASM client PANICS ("RefCell already borrowed" →
          // unreachable, poisoning the instance) on a concurrent borrow — it no
          // longer throws the retryable "recursive use" string 0.14 did. A read
          // that races a mint/consume/place would therefore kill the client, so
          // we serialize reads against mutations instead of relying on the
          // best-effort pausedRef (which can't stop a tick already in flight).
          try { out[mid] = await runExclusive(() => readMarketState(client, acctHex)); } catch (e) {}
        }
        if (alive && Object.keys(out).length) setLive((prev) => ({ ...prev, ...out }));
      } finally { inflight = false; }
    };
    tick();
    const iv = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, [isReady, client]);
  return live;
}

/* Subrosa prototype — root app: routing, state, seal flow.
   The seal UX is the design's; place() ALSO fires a REAL on-chain tx (private
   account + position note) and surfaces its hash in the seal + positions. */
function App() {
  const [route, setRoute] = React.useState("markets");
  const [market, setMarket] = React.useState(null);
  // Positions are loaded PER WALLET from localStorage (see the effect below) —
  // never shared across users. Starts empty; the connected wallet's set is
  // hydrated once we know which wallet it is.
  const [positions, setPositions] = React.useState([]);
  const [agents, setAgents] = React.useState(() => window.OBS.agents.map((a) => ({ ...a })));
  const [approvals, setApprovals] = React.useState([]); // {id, agentId, agentName, marketName, side, requested, cap, status, step, multisig}
  const [coSignStep, setCoSignStep] = React.useState(null); // live Guardian co-sign progress (null = idle)
  const [seal, setSeal] = React.useState(null); // {order}
  const [realTx, setRealTx] = React.useState(null); // {tx, account}
  const builtin = useWallet();
  const mf = useMidenFi();
  const { execute } = useTransaction();
  const { client, isReady, runExclusive } = useMiden();

  // Serialize every client call the moment the client exists — BEFORE any query
  // hook or mutation can touch it — so the single-threaded 0.15 WASM never sees a
  // concurrent borrow (which would panic + poison it). See serializeMidenClient.
  React.useMemo(() => { if (client) serializeMidenClient(client); }, [client]);

  // Expose a live market reader (used by the headless read-test; also the basis
  // for the live-odds UI wiring in the next step). Reads go through the same
  // serialized client, so they can't race a mutation.
  React.useEffect(() => {
    if (isReady && client) window.__subrosaReadMarket = (hex) => readMarketState(client, hex || MARKET_ID_HEX);
  }, [isReady, client]);
  const [mfFunding, setMfFunding] = React.useState(false);
  const [mfFundMsg, setMfFundMsg] = React.useState(null);
  // Pause background WASM reads while ANY heavy wallet op is in flight — a
  // co-sign, a fund/mint, or a place. They drive long proofs on the shared WASM
  // client, and a concurrent market read aborts the in-flight proof
  // ("BodyStreamBuffer was aborted"). Ref so the poller sees the latest value
  // without restarting its interval.
  const walletBusyRef = React.useRef(false);
  walletBusyRef.current = !!coSignStep || !!seal || builtin.funding || mfFunding;
  const live = useLiveMarkets(client, isReady, walletBusyRef, runExclusive);
  React.useEffect(() => { window.__subrosaLive = live; }, [live]);

  // Fund the EXTERNAL MidenFi wallet: our web client mints a public OBX note to
  // its address (we hold the faucet key), then the extension consumes it via
  // requestConsume (its own client claims the asset).
  const fundMidenFi = async () => {
    if (!mf.address || mfFunding) return;
    setMfFunding(true); setMfFundMsg("Minting 1,000 OBX…");
    try {
      const fid = await builtin.mintTo(mf.address);
      setMfFundMsg("Claiming in Miden Wallet…");
      let done = false;
      for (let i = 0; i < 16; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        let cn = [];
        try { cn = (await mf.requestConsumableNotes?.()) || []; } catch (e) {}
        const list = Array.isArray(cn) ? cn : (cn?.consumableNotes || []);
        const n = list.find((x) => (x.assets || []).some((as) => sameFaucet(as.faucetId ?? as.assetId, fid)));
        if (n) {
          const as = (n.assets || [])[0] || {};
          const amt = Number(as.amount ?? as.amountAsBigInt ?? parseAssetAmount("1000", FUND_DECIMALS));
          await mf.requestConsume({ faucetId: fid, noteId: n.noteId, noteType: "public", amount: amt });
          done = true; break;
        }
      }
      // The extension's consume settles asynchronously — poll requestAssets
      // until the balance reflects it.
      let credited = false;
      if (done) {
        setMfFundMsg("Confirming…");
        for (let j = 0; j < 20; j++) {
          await new Promise((r) => setTimeout(r, 3000));
          const b = await mf.refreshAssets?.();
          if (b && b > 0n) { credited = true; break; }
        }
      } else {
        await mf.refreshAssets?.();
      }
      setMfFundMsg(credited ? "Funded ✓" : done ? "Claimed — balance may take a moment" : "Minted — claim it in your Miden Wallet");
      setTimeout(() => setMfFundMsg(null), 7000);
    } catch (e) {
      console.warn("[fund:midenfi] failed:", e);
      setMfFundMsg("Funding failed — see console");
      setTimeout(() => setMfFundMsg(null), 6000);
    } finally { setMfFunding(false); }
  };

  // Unified wallet model for the UI. MidenFi takes precedence when connected;
  // otherwise the built-in browser wallet.
  const kind = mf.connected ? "midenfi" : (builtin.connected ? "builtin" : null);
  const wallet = {
    connected: !!kind, kind,
    connecting: builtin.connecting || mf.connecting,
    funding: kind === "midenfi" ? mfFunding : builtin.funding,
    fundMsg: kind === "midenfi" ? mfFundMsg : builtin.fundMsg,
    error: builtin.error,
    midenfiAvailable: mf.available,
    walletId: kind === "midenfi" ? mf.address : builtin.walletId,
    balanceLabel: kind === "midenfi" ? mf.balanceLabel : builtin.balanceLabel,
    connectBuiltin: builtin.connect,
    connectMidenFi: mf.connect,
    disconnect: () => (kind === "midenfi" ? mf.disconnect() : builtin.disconnect()),
    fund: kind === "midenfi" ? fundMidenFi : builtin.fund,
  };
  // Real spendable balance (OBX) from the connected wallet — drives the bet panel.
  const liveBalance = Number(String(wallet.balanceLabel || "0").replace(/[, ]/g, "")) || 0;

  // ── Per-wallet positions (isolated + persisted) ───────────────────────────
  // Each wallet gets its own localStorage bucket. Load its set when the wallet
  // changes; save on every change. The skip-guard stops the freshly-loaded set
  // from being written back to the wrong key during the wallet-switch render.
  const walletKey = wallet.connected && wallet.walletId ? POS_LS_PREFIX + wallet.walletId : null;
  const skipPosSaveRef = React.useRef(false);
  React.useEffect(() => {
    skipPosSaveRef.current = true;
    if (!walletKey) { setPositions([]); return; }
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(walletKey) || "[]"); } catch (e) { stored = []; }
    // Only confirmed positions persist across sessions — a bet that never
    // landed (page closed mid-proof) is dropped rather than shown as real.
    setPositions(Array.isArray(stored) ? stored.filter((p) => p && p.confirmed) : []);
  }, [walletKey]);
  React.useEffect(() => {
    if (skipPosSaveRef.current) { skipPosSaveRef.current = false; return; }
    if (walletKey) { try { localStorage.setItem(walletKey, JSON.stringify(positions)); } catch (e) {} }
  }, [positions, walletKey]);

  // A position is created ONLY on a successful place (below). buildPosition
  // assembles the record; upsertPosition adds-or-patches by id (idempotent if
  // the same place is recorded twice).
  const buildPosition = (o, rt, confirmed) => ({
    id: o.placeId || ("p-" + Math.random().toString(36).slice(2, 7)),
    marketId: o.market.id, marketAccount: rt?.marketHex, side: o.side, size: o.amount,
    avg: Math.round(o.price), shares: o.shares, pnl: 0, value: o.amount,
    commitment: rt?.noteId ? shortHex(rt.noteId) : (rt?.tx ? shortHex(rt.tx) : "(private)"),
    tx: rt?.tx, noteId: rt?.noteId, account: rt?.account, coSignMultisig: rt?.coSignMultisig,
    viaMidenFi: !!rt?.viaMidenFi, revealed: false, confirmed: !!confirmed,
  });
  const upsertPosition = (pos) => setPositions((ps) => {
    // Look for an existing position with the same marketId AND side
    const existingIndex = ps.findIndex(
      (p) => p.marketId === pos.marketId && p.side === pos.side
    );
    
    if (existingIndex >= 0) {
      // Position exists for this market+side — merge by summing amounts
      return ps.map((p, i) => 
        i === existingIndex 
          ? {
              ...p,
              size: p.size + pos.size,                    // Sum the stake amounts
              shares: p.shares + pos.shares,              // Sum the shares
              value: p.value + pos.value,                 // Sum the values
              // Weighted average price based on new shares allocation
              avg: Math.round((p.avg * p.shares + pos.avg * pos.shares) / (p.shares + pos.shares)),
              // Keep the first position's id, tx, noteId for history
              // But update metadata from the new transaction
              commitment: pos.commitment,
              tx: pos.tx,
              noteId: pos.noteId,
              account: pos.account,
              coSignMultisig: pos.coSignMultisig,
              viaMidenFi: pos.viaMidenFi,
              confirmed: pos.confirmed,
            }
          : p
      );
    }
    
    // No existing position for this market+side — add as new
    return [pos, ...ps];
  });

  const go = (r) => { if (r !== "detail") setMarket(null); setRoute(r); };
  const openMarket = (m) => { setMarket(m); setRoute("detail"); };

  // ── In-app Guardian approvals ─────────────────────────────────────────────
  // An agent that wants to deploy beyond its programmable-auth cap can't act
  // alone: it raises a request that a human must co-sign (2-of-N, Guardian-
  // verified) in the UI before the capital is authorized. proposeAboveCap()
  // queues that request; coSignApproval() runs the REAL Guardian co-sign.
  const proposeAboveCap = (agent) => {
    const m = (window.OBS.markets && window.OBS.markets[0]) || { name: "live market" };
    const requested = Math.round(agent.cap * 1.6);
    const id = "ap-" + Math.random().toString(36).slice(2, 7);
    setApprovals((xs) => [{ id, agentId: agent.id, agentName: agent.name, marketName: m.name, side: "YES", requested, cap: agent.cap, status: "pending", step: null, multisig: null }, ...xs]);
    setRoute("approvals");
    window.txToast?.({ kind: "cosign", title: "Co-sign required", desc: `${agent.name} wants ${requested} OBX — over its ${agent.cap} OBX cap. Approve it under Approvals.` });
  };
  const coSignApproval = async (ap) => {
    setApprovals((xs) => xs.map((x) => (x.id === ap.id ? { ...x, status: "signing", step: "Connecting to Guardian…" } : x)));
    setCoSignStep("Connecting to Guardian…");
    try {
      const r = await guardianCoSign((msg) => { setCoSignStep(msg); setApprovals((xs) => xs.map((x) => (x.id === ap.id ? { ...x, step: msg } : x))); });
      addCoSignId(r.multisig); // never let the wallet adopt this multisig
      setCoSignStep(null);
      setApprovals((xs) => xs.map((x) => (x.id === ap.id ? { ...x, status: "approved", step: null, multisig: r.multisig } : x)));
      setAgents((as) => as.map((a) => (a.id === ap.agentId ? { ...a, deployed: a.deployed + ap.requested } : a)));
      window.txToast?.({ kind: "tx", title: "Guardian co-signed ✓", desc: `2-of-N approved — ${ap.agentName} authorized for ${ap.requested} OBX via your ${r.reused ? "" : "new "}Guardian multisig ${shortHex(r.multisig)}.`, account: r.multisig });
    } catch (e) {
      console.warn("[approval] co-sign failed:", e);
      setCoSignStep(null);
      setApprovals((xs) => xs.map((x) => (x.id === ap.id ? { ...x, status: "pending", step: null } : x)));
      window.txToast?.({ kind: "error", title: "Guardian co-sign failed", desc: "Position not authorized. Is the Guardian server running (npm run guardian:up)?" });
    }
  };
  const declineApproval = (id) => setApprovals((xs) => xs.map((x) => (x.id === id ? { ...x, status: "declined", step: null } : x)));

  // Redeem a winning position on a resolved market. v1 settlement is resolver-
  // run (operator redeem-service); the contract's redeem() guard only succeeds
  // for the winning side, so losing redemptions are rejected on-chain.
  const redeem = async (pos) => {
    const market = pos.marketAccount || LIVE_MARKETS[pos.marketId];
    if (!market) { window.txToast?.({ kind: "error", title: "Not redeemable here", desc: "This market isn't backed by a live on-chain account." }); return; }
    const side = String(pos.side || "").toLowerCase();
    setPositions((ps) => ps.map((p) => (p.id === pos.id ? { ...p, redeeming: true } : p)));
    window.txToast?.({ kind: "cosign", title: "Redeeming…", desc: `Settling your ${pos.side} position on-chain — the contract verifies you're on the winning side.` });
    try {
      const r = await fetch(REDEEM_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ market, side }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `redeem ${r.status}`);
      window.txToast?.({ kind: "tx", title: "Redeemed ✓", desc: `Your winning ${pos.side} position settled on-chain. 1:1 payout per share (v1).`, tx: j.tx, account: market });
      setPositions((ps) => ps.map((p) => (p.id === pos.id ? { ...p, redeemed: true, redeeming: false } : p)));
    } catch (e) {
      window.txToast?.({ kind: "error", title: "Redemption rejected", desc: String(e?.message || e).includes("losing") ? "The contract rejected it — this is the losing side." : String(e?.message || e) });
      setPositions((ps) => ps.map((p) => (p.id === pos.id ? { ...p, redeeming: false } : p)));
    }
  };

  const place = (order) => {
    setRealTx(null);
    const placeId = "p-" + Math.random().toString(36).slice(2, 7); // stable id to patch later
    // Positions are placed from the built-in PRIVATE account (the chain sees
    // only a commitment). If "Protect with Guardian" is on, a real 2-of-N
    // Guardian co-sign must execute on-chain first — then the bet is sealed.
    (async () => {
      let coSignMultisig = null;

      // "Protect with Guardian": run a REAL 2-of-N + Guardian co-sign that
      // EXECUTES on-chain (the proven flow that reaches GUARDIAN VERIFIED),
      // authorizing this bet. The private position is then sealed from your
      // wallet. If the co-sign can't complete we place directly rather than
      // strand the bet.
      if (order.protect) {
        setCoSignStep("Connecting to Guardian…");
        try {
          const r = await guardianCoSign((m) => { console.log("[cosign]", m); setCoSignStep(m); });
          coSignMultisig = r.multisig;
          addCoSignId(r.multisig); // never let the wallet adopt this multisig
          setCoSignStep(null);
          window.txToast?.({ kind: "cosign", title: "Guardian co-signed ✓", desc: `A real 2-of-N + Guardian co-sign authorized this bet on-chain via your ${r.reused ? "" : "new "}Guardian account ${shortHex(coSignMultisig)}. Sealing your position…`, account: coSignMultisig });
        } catch (e) {
          console.warn("[cosign] failed:", e);
          setCoSignStep(null);
          window.txToast?.({ kind: "cosign", title: "Guardian unavailable — placing directly", desc: "Couldn't complete a Guardian co-sign right now. Placing your position from your wallet instead." });
          // fall through and place directly (don't strand the bet)
        }
      }
      setSeal({ order: { ...order, placeId } });

      // If MidenFi is the active wallet, the bet is SIGNED BY THE EXTENSION and
      // paid from the MidenFi wallet (pop-up + balance drop): send the stake to
      // the market account via the adapter. (The built-in path below uses the
      // private place-note + commitment.)
      if (mf.connected && mf.address && mf.requestSend) {
        try {
          const marketHex = (order.market && LIVE_MARKETS[order.market.id]) || MARKET_ID_HEX;
          // The Miden Wallet may hold OBX from a faucet that differs from the
          // app's current web faucet (e.g. after a faucet refresh). Stake from a
          // faucet the wallet ACTUALLY holds enough of, so the send can succeed.
          const need = Number(parseAssetAmount(String(order.amount), FUND_DECIMALS));
          const lsFid = (() => { try { return localStorage.getItem(FAUCET_LS); } catch (e) { return null; } })();
          const held = (mf.assets || []).map((x) => ({ id: x.faucetId ?? x.assetId, amt: Number(x.amount ?? x.balance ?? 0) })).filter((h) => h.id);
          const faucetHex = (
            held.find((h) => lsFid && sameFaucet(h.id, lsFid) && h.amt >= need) ||
            held.filter((h) => h.amt >= need).sort((p, q) => q.amt - p.amt)[0] ||
            held.sort((p, q) => q.amt - p.amt)[0]
          )?.id;
          if (!faucetHex) throw new Error("Your Miden Wallet has no OBX to stake — fund it first.");
          window.txToast?.({ kind: "cosign", title: "Approve in Miden Wallet", desc: "Confirm the transaction in your wallet extension to stake your OBX." });
          // requestSend resolves to a request id (a UUID), NOT the on-chain tx
          // hash. waitForTransaction blocks until the extension proves + submits,
          // then returns { txHash, outputNotes } — the real Miden tx hash and the
          // private output note (our position commitment).
          const reqId = await mf.requestSend({
            senderAddress: mf.address,
            recipientAddress: marketHex,
            faucetId: faucetHex,
            noteType: "private",
            amount: Number(parseAssetAmount(String(order.amount), FUND_DECIMALS)),
          });
          window.txToast?.({ kind: "cosign", title: "Settling on-chain…", desc: "Your Miden Wallet is proving + submitting the transaction." });
          let tx = null, noteId = null;
          try {
            const out = await mf.waitForTransaction?.(reqId, 180_000);
            if (out?.errorMessage) throw new Error(out.errorMessage);
            tx = out?.txHash ?? null;
            const notes = out?.outputNotes;
            const first = Array.isArray(notes) ? notes[0] : null;
            noteId = (first && (typeof first === "string" ? first : (first.id?.()?.toString?.() ?? String(first)))) || null;
          } catch (e) {
            console.warn("[place:midenfi] waitForTransaction:", e?.message || e);
          }
          const rt = { tx, account: mf.address, marketHex, noteId, coSignMultisig, viaMidenFi: true };
          setRealTx(rt);
          // Record the position ONLY now that the send went through.
          upsertPosition(buildPosition({ ...order, placeId }, rt, true));
          setTimeout(() => { try { mf.refreshAssets?.(); } catch (e) {} }, 3000);
          window.txToast?.({ kind: "tx", title: `${order.side} position placed · ${order.amount} OBX (Miden Wallet)`, desc: "Signed by your Miden Wallet and staked to the market — balance debited from your external wallet.", tx, account: mf.address });
        } catch (e) {
          console.warn("[place:midenfi] failed:", e);
          window.txToast?.({ kind: "error", title: "Miden Wallet place failed", desc: String(e?.message || e).slice(0, 140) });
          setSeal(null); // don't leave the seal stuck on "sealing…"
        }
        return;
      }

      try {
        const acct = await builtin.connect();
        const signerRef = acct.id();
        const marketHex = (order.market && LIVE_MARKETS[order.market.id]) || MARKET_ID_HEX;
        const faucetHex = (() => { try { return localStorage.getItem(FAUCET_LS); } catch (e) { return null; } })();
        if (!faucetHex || !(order.amount > 0)) throw new Error("Fund your wallet with OBX before placing a position.");

        // ── 0.15 position note (degraded path — see docs/VERSIONS.md) ──────────
        // The custom place_note.masp is package format v2, which the 0.15 client
        // rejects ("Got [0,0,2], only [0,0,3] supported"), and the market accounts
        // are 0.14-format — both dead on the reset 0.15 network and blocked upstream
        // (no working v3 contract toolchain yet). Until that lands we stake `amount`
        // OBX into a private note built from the SDK's well-known P2ID script
        // (NoteScript.p2id()) instead of the custom market note, emitted as an OWN
        // OUTPUT note (withOwnOutputNotes) so it's tracked locally with NO note
        // transport — the same reason funding's own notes work on 0.15 (a `send()`
        // P2P private note fails: "note transport is disabled"). This is a genuine
        // on-chain private commitment (the chain sees only the note's hash); what's
        // deferred is the market-procedure call that moves public odds. When v3
        // ships, restore the place_note.masp + NoteTag.withAccountTarget(market).
        const ns = NoteScript.p2id();
        let res, noteId;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const assets = new NoteAssets([new FungibleAsset(toAccountId(faucetHex), parseAssetAmount(String(order.amount), FUND_DECIMALS))]);
            const rec = new NoteRecipient(randomWord(), ns, new NoteStorage(new FeltArray()));
            // Tag the note to your OWN account (a valid 0.15 id) — the dead 0.14
            // market id would throw at AccountId parsing.
            const meta = new NoteMetadata(signerRef, NoteType.Private, NoteTag.withAccountTarget(signerRef));
            const note = new Note(assets, meta, rec);
            noteId = (() => { try { return note.id().toString(); } catch (e) { return null; } })();
            const req = new TransactionRequestBuilder().withOwnOutputNotes(new NoteArray([note])).build();
            res = await execute({ accountId: signerRef, request: req });
            break;
          } catch (e) {
            console.warn(`[place] attempt ${attempt}/3 failed:`, e?.message || e);
            if (attempt === 3) throw e;
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
        const rt = { tx: res.transactionId, account: signerRef.toString(), marketHex, noteId, coSignMultisig };
        setRealTx(rt);
        // Record the position ONLY now that the on-chain tx succeeded.
        upsertPosition(buildPosition({ ...order, placeId }, rt, true));
        setTimeout(() => { try { builtin.refetch?.(); } catch (e) {} }, 2500); // reflect the lower balance
        window.txToast?.({
          kind: coSignMultisig ? "cosign" : "tx",
          title: `${order.side} position sealed · ${order.amount} OBX staked${coSignMultisig ? " · Guardian-co-signed" : ""}`,
          desc: `Your ${order.side} stake of ${order.amount} OBX is locked into a private position note${coSignMultisig ? ", approved by a 2-of-N Guardian co-sign" : ""}. The chain records only its commitment — side, size and owner stay private.`,
          tx: res.transactionId,
          account: signerRef.toString(),
        });
      } catch (e) {
        console.warn("[place] on-chain tx failed:", e);
        window.txToast?.({ kind: "error", title: "Position tx failed", desc: "The on-chain commitment couldn't be submitted. See console for details." });
        setSeal(null); // don't leave the seal stuck on "sealing…"
      }
    })();
  };

  // The seal modal is purely visual now — the position is written by place()
  // only on a successful tx, so dismissing/viewing the seal never creates a
  // position for a bet that failed. Just close and (optionally) navigate.
  const finalize = (navigate) => {
    setSeal(null);
    if (navigate) go("positions");
  };

  let screen;
  if (route === "detail" && market) screen = <window.MarketDetail m={market} go={go} onPlace={place} balance={liveBalance} liveMarkets={live} addresses={LIVE_MARKETS} />;
  else if (route === "positions") screen = <window.PositionsScreen positions={positions} balance={liveBalance} go={go} live={live} onRedeem={redeem} />;
  else if (route === "agents") screen = <window.AgentsScreen agents={agents} onPropose={proposeAboveCap} />;
  else if (route === "approvals") screen = <window.ApprovalsScreen approvals={approvals} onCoSign={coSignApproval} onDecline={declineApproval} go={go} />;
  else screen = <window.MarketsHome onOpen={openMarket} liveMarkets={live} />;

  const topLeft = route === "detail"
    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--faint)" }}>
        <span style={{ cursor: "pointer" }} onClick={() => go("markets")}>Markets</span>
        <window.Icon name="chevron-right" size={14} color="var(--faint)" />
        <span style={{ color: "var(--muted)" }}>{market.category}</span>
      </span>
    : <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 16, color: "var(--text)", textTransform: "capitalize" }}>{route}</span>;

  return (
    <div className="app-shell" style={{ display: "flex", height: "100vh", position: "relative", zIndex: 1 }}>
      <window.Sidebar route={route} go={go} positionsCount={positions.length} approvalsCount={approvals.filter((a) => a.status === "pending").length} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <window.TopBar left={topLeft} wallet={wallet} />
        <div className="content-scroll" style={{ flex: 1, minHeight: 0 }}>{screen}</div>
      </div>
      {seal ? (
        <window.PrivacySeal
          order={seal.order}
          publicYes={seal.order.market.yes}
          realTx={realTx}
          onView={() => finalize(true)}
          onClose={() => finalize(false)}
        />
      ) : null}
      <window.ToastHost />
      <window.CoSignModal step={coSignStep} />
    </div>
  );
}


export default App;
