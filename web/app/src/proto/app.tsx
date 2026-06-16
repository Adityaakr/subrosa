// @ts-nocheck
import React from "react";
import { useCreateWallet, useCreateFaucet, useMint, useTransaction, useAccount, useAccounts, useConsume, useSyncState, useNotes, useMiden, formatAssetAmount, parseAssetAmount, accountIdsEqual } from "@miden-sdk/react";
import { useWallet as useMidenFiAdapter } from "@miden-sdk/miden-wallet-adapter-react";
import { WalletAdapterNetwork, PrivateDataPermission } from "@miden-sdk/miden-wallet-adapter-base";
import {
  AccountId, Package, NoteScript, Note, NoteAssets, NoteMetadata,
  NoteRecipient, NoteStorage, NoteTag, NoteType, NoteArray, FeltArray, TransactionRequestBuilder,
} from "@miden-sdk/miden-sdk";
import { randomWord } from "../lib/miden";

const MARKET_ID_HEX = "0x5ff0303f0b795d1039ca5b51d8480b";
const OBX_FAUCET_HEX = "0x1201d9f8819d5220778535e4e2f08a";
const WALLET_LS = "subrosa.wallet.id";
// per-browser test-OBX faucet (web SDK). Versioned: bumping abandons faucets
// created with old params (e.g. the pre-fix 1e9 maxSupply) so a correct one is
// made automatically — no manual storage clearing needed.
const FAUCET_LS = "subrosa.faucet.v2.id";
const FUND_DECIMALS = 8;

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
  "fed-sep": "0x60de1a3b8cf5cb10384598e50506cf", // seeded 45% YES
};

const wordToBig = (w) => { try { return w ? w.toU64s()[0] : 0n; } catch (e) { return 0n; } };

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
  const notes = useNotes();
  const notesRef = React.useRef([]);
  // consumableNoteSummaries carry a string `id` that consume() accepts (the raw
  // ConsumableNoteRecord objects are NOT a valid consume input).
  React.useEffect(() => { notesRef.current = notes.consumableNoteSummaries || []; }, [notes.consumableNoteSummaries]);

  const idOf = (a) => { try { return (a && a.id ? a.id() : a)?.toString?.() ?? String(a); } catch (e) { return String(a); } };
  const sameId = (a, id) => { if (!a || !id) return false; try { return accountIdsEqual(a, id); } catch (e) { return idOf(a) === id; } };

  // every wallet this client has in its local store
  const list = React.useMemo(() => [...(wallets || []), ...(accounts || [])].filter(Boolean), [wallets, accounts]);

  const { createFaucet } = useCreateFaucet();
  const { mint } = useMint();
  const [walletId, setWalletId] = React.useState(() => {
    try { return localStorage.getItem(WALLET_LS); } catch (e) { return null; }
  });
  const [faucetId, setFaucetId] = React.useState(() => {
    try { return localStorage.getItem(FAUCET_LS); } catch (e) { return null; }
  });
  const [connecting, setConnecting] = React.useState(false);
  const [funding, setFunding] = React.useState(false);
  const [fundMsg, setFundMsg] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Resolve the connected account OBJECT from the store by its persisted id —
  // far more reliable than re-deriving it from a string each render.
  const stored = React.useMemo(() => (walletId ? list.find((a) => sameId(a, walletId)) || null : null), [walletId, list]);
  const acctRef = React.useRef(null);
  React.useEffect(() => { if (stored) acctRef.current = stored; }, [stored]);
  const account = stored || acctRef.current;

  const q = useAccount(account ?? walletId ?? undefined);
  // Balance is the wallet's holding of our per-browser test-OBX faucet (minted
  // + consumed entirely via the web SDK, so it actually credits).
  let balance = 0n;
  try { if (q.getBalance && faucetId) balance = q.getBalance(faucetId) ?? 0n; } catch (e) {}

  // Once the store list has loaded, drop a persisted id that no longer exists
  // (e.g. the IndexedDB was reset) — but never wipe a freshly created wallet.
  React.useEffect(() => {
    if (walletId && !listLoading && !stored && !acctRef.current) {
      try { localStorage.removeItem(WALLET_LS); } catch (e) {}
      setWalletId(null);
    }
  }, [walletId, listLoading, stored]);

  const address = account ? idOf(account) : walletId;

  const connect = async () => {
    setError(null);
    if (account) return account;
    setConnecting(true);
    try {
      // adopt an existing wallet from the store, else create a fresh one
      let w = (wallets && wallets[0]) || (accounts && accounts[0]) || null;
      if (!w) w = await createWallet({ storageMode: "private" });
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

  const disconnect = () => {
    acctRef.current = null;
    try { localStorage.removeItem(WALLET_LS); } catch (e) {}
    setWalletId(null);
  };

  // Reuse the persisted test faucet if it's still in the store, else create one.
  // maxSupply is in BASE units and must exceed everything we ever mint:
  // 1000 OBX * 10^8 = 1e11 per fund, so give it ample headroom (1e16).
  const ensureFaucet = async () => {
    if (faucetId && list.find((a) => sameId(a, faucetId))) return faucetId;
    setFundMsg("Creating test faucet…");
    const f = await wasmRetry(() => createFaucet({ tokenSymbol: "OBX", decimals: FUND_DECIMALS, maxSupply: 10_000_000_000_000_000n, storageMode: "public" }));
    const fid = idOf(f);
    try { localStorage.setItem(FAUCET_LS, fid); } catch (e) {}
    setFaucetId(fid);
    try { await wasmRetry(() => sync()); } catch (e) {}
    return fid;
  };

  // Self-contained funding: mint test OBX from our own web-SDK faucet to the
  // wallet, then consume the note. Same toolchain end-to-end → the consume's
  // note script resolves (no cross-toolchain procedure mismatch).
  const fund = async () => {
    const id = address;
    if (!id || funding) return;
    setFunding(true); setError(null);
    try {
      const fid = await ensureFaucet();
      setFundMsg("Minting 1,000 OBX…");
      await wasmRetry(() => mint({ targetAccountId: id, faucetId: fid, amount: parseAssetAmount("1000", FUND_DECIMALS), noteType: "private" }));
      setFundMsg("Claiming…");
      // Only consume notes carrying OUR faucet's asset. A wallet may hold stale
      // notes from earlier attempts (e.g. a CLI-minted note) that the web client
      // can't execute — sweeping those into the batch fails the whole consume.
      const isOurs = (s) => (s.assets || []).some((a) => {
        try { return accountIdsEqual(a.assetId, fid); }
        catch (e) { return String(a.assetId || "").toLowerCase() === String(fid).toLowerCase(); }
      });
      let claimed = false;
      for (let i = 0; i < 12; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        try { await wasmRetry(() => sync()); } catch (e) {}
        try { await notes.refetch?.(); } catch (e) {}
        const ids = (notesRef.current || []).filter(isOurs).map((s) => s.id).filter(Boolean);
        if (ids.length) {
          await wasmRetry(() => consume({ accountId: id, notes: ids }));
          claimed = true;
          break;
        }
      }
      try { await q.refetch?.(); } catch (e) {}
      setFundMsg(claimed ? "Funded ✓" : "Minted — balance updates shortly");
      setTimeout(() => setFundMsg(null), 4000);
    } catch (e) {
      console.warn("[fund] failed:", e);
      setFundMsg("Funding failed — see console");
      setTimeout(() => setFundMsg(null), 5000);
    } finally { setFunding(false); }
  };

  // Mint a PUBLIC test-OBX note from our web faucet to any address (used to fund
  // the external MidenFi wallet, which then consumes via its own extension).
  // Returns the faucet id so the caller can match the resulting note/asset.
  const mintTo = async (targetAddress) => {
    const fid = await ensureFaucet();
    await wasmRetry(() => mint({ targetAccountId: targetAddress, faucetId: fid, amount: parseAssetAmount("1000", FUND_DECIMALS), noteType: "public" }));
    return fid;
  };

  return {
    connected: !!account || !!walletId, connecting, funding, fundMsg, error,
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
  const [tick, setTick] = React.useState(0);
  const refreshAssets = React.useCallback(async () => {
    if (!a.connected || !a.requestAssets) { setBalance(0n); return 0n; }
    let fid = null; try { fid = localStorage.getItem(FAUCET_LS); } catch (e) {}
    try {
      const assets = await a.requestAssets();
      const list = Array.isArray(assets) ? assets : (assets?.assets || []);
      console.log("[midenfi] assets:", JSON.stringify(list), "| our faucet:", fid);
      const match = (fid && list.find((x) => sameFaucet(x.faucetId ?? x.assetId, fid))) || null;
      const v = match ? BigInt(match.amount ?? match.balance ?? 0) : 0n;
      setBalance(v);
      return v;
    } catch (e) { return 0n; }
  }, [a.connected]);
  React.useEffect(() => { refreshAssets(); }, [a.connected, tick, refreshAssets]);

  const connect = async () => {
    const w = a.wallets && a.wallets[0];
    if (!w) throw new Error("Miden Wallet extension not detected");
    a.select(w.adapter.name);
    await new Promise((r) => setTimeout(r, 60));
    await a.connect(PrivateDataPermission.UponRequest, WalletAdapterNetwork.Testnet);
  };
  return {
    available: (a.wallets && a.wallets.length > 0) || false,
    connected: a.connected, connecting: a.connecting,
    address: a.address, balance, balanceLabel: formatAssetAmount(balance, FUND_DECIMALS),
    connect, disconnect: a.disconnect,
    requestConsumableNotes: a.requestConsumableNotes, requestConsume: a.requestConsume,
    refreshAssets, refresh: () => setTick((t) => t + 1),
  };
}

/* Reads every registered live market's on-chain state on an interval (serially,
   to respect the single WASM client) → { [marketId]: {yesPct, volume, ...} }. */
function useLiveMarkets(client, isReady) {
  const [live, setLive] = React.useState({});
  React.useEffect(() => {
    if (!isReady || !client) return;
    let alive = true, inflight = false;
    const tick = async () => {
      if (inflight) return; inflight = true;
      try {
        const out = {};
        for (const [mid, acctHex] of Object.entries(LIVE_MARKETS)) {
          if (!acctHex) continue;
          try { out[mid] = await readMarketState(client, acctHex); } catch (e) {}
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
  const [positions, setPositions] = React.useState(() => window.OBS.positions.map((p) => ({ ...p })));
  const [balance, setBalance] = React.useState(2480);
  const [seal, setSeal] = React.useState(null); // {order}
  const [realTx, setRealTx] = React.useState(null); // {tx, account}
  const committed = React.useRef(false);
  const builtin = useWallet();
  const mf = useMidenFi();
  const { execute } = useTransaction();
  const { client, isReady } = useMiden();

  // Expose a live market reader (used by the headless read-test; also the basis
  // for the live-odds UI wiring in the next step).
  React.useEffect(() => {
    if (isReady && client) window.__subrosaReadMarket = (hex) => readMarketState(client, hex || MARKET_ID_HEX);
  }, [isReady, client]);
  const live = useLiveMarkets(client, isReady);
  const [mfFunding, setMfFunding] = React.useState(false);
  const [mfFundMsg, setMfFundMsg] = React.useState(null);

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

  const go = (r) => { if (r !== "detail") setMarket(null); setRoute(r); };
  const openMarket = (m) => { setMarket(m); setRoute("detail"); };

  const place = (order) => {
    committed.current = false;
    setRealTx(null);
    setSeal({ order });
    // Real on-chain tx in parallel. Positions are always placed from the
    // built-in PRIVATE account (on-theme: the chain only sees a commitment),
    // regardless of which wallet is shown for identity/balance.
    (async () => {
      try {
        const acct = await builtin.connect();
        const signerRef = acct.id();
        const senderId = acct.id();
        const masp = order.side === "YES" ? "/packages/place_note.masp" : "/packages/place_no_note.masp";
        const buf = await fetch(masp).then((r) => r.arrayBuffer());
        const ns = NoteScript.fromPackage(Package.deserialize(new Uint8Array(buf)));
        const mid = AccountId.fromHex(MARKET_ID_HEX);
        const rec = new NoteRecipient(randomWord(), ns, new NoteStorage(new FeltArray()));
        const meta = new NoteMetadata(senderId, NoteType.Private, NoteTag.withAccountTarget(mid));
        const note = new Note(new NoteAssets(), meta, rec);
        const req = new TransactionRequestBuilder().withOwnOutputNotes(new NoteArray([note])).build();
        const res = await execute({ accountId: signerRef, request: req });
        setRealTx({ tx: res.transactionId, account: signerRef.toString() });
      } catch (e) { console.warn("[place] on-chain tx failed:", e); }
    })();
  };

  const finalize = (navigate) => {
    if (!committed.current) {
      committed.current = true;
      const o = seal.order;
      const pos = {
        id: "p-" + Math.random().toString(36).slice(2, 7),
        marketId: o.market.id, side: o.side, size: o.amount,
        avg: Math.round(o.price), shares: o.shares, pnl: 0, value: o.amount,
        commitment: realTx ? shortHex(realTx.tx) : "0x9f3a…e201",
        tx: realTx?.tx, account: realTx?.account, revealed: false,
      };
      setPositions((ps) => [pos, ...ps]);
      setBalance((b) => Math.max(0, b - o.amount));
    }
    setSeal(null);
    if (navigate) go("positions");
  };

  let screen;
  if (route === "detail" && market) screen = <window.MarketDetail m={market} go={go} onPlace={place} balance={balance} liveMarkets={live} />;
  else if (route === "positions") screen = <window.PositionsScreen positions={positions} balance={balance} go={go} />;
  else if (route === "agents") screen = <window.AgentsScreen />;
  else screen = <window.MarketsHome onOpen={openMarket} liveMarkets={live} />;

  const topLeft = route === "detail"
    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--faint)" }}>
        <span style={{ cursor: "pointer" }} onClick={() => go("markets")}>Markets</span>
        <window.Icon name="chevron-right" size={14} color="var(--faint)" />
        <span style={{ color: "var(--muted)" }}>{market.category}</span>
      </span>
    : <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 16, color: "var(--text)", textTransform: "capitalize" }}>{route}</span>;

  return (
    <div style={{ display: "flex", height: "100vh", position: "relative", zIndex: 1 }}>
      <window.Sidebar route={route} go={go} positionsCount={positions.length} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
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
    </div>
  );
}


export default App;
