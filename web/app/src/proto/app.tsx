// @ts-nocheck
import React from "react";
import { useCreateWallet, useCreateFaucet, useMint, useTransaction, useAccount, useAccounts, useConsume, useSyncState, useNotes, formatAssetAmount, parseAssetAmount, accountIdsEqual } from "@miden-sdk/react";
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
      let claimed = false;
      for (let i = 0; i < 12; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        try { await wasmRetry(() => sync()); } catch (e) {}
        try { await notes.refetch?.(); } catch (e) {}
        const ids = (notesRef.current || []).map((s) => s.id).filter(Boolean);
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

  return {
    connected: !!account || !!walletId, connecting, funding, fundMsg, error,
    walletId: address, account,
    balance, balanceLabel: formatAssetAmount(balance, FUND_DECIMALS),
    connect, disconnect, fund, refetch: q.refetch,
  };
}

/* External MidenFi ("Miden Wallet") extension via the wallet-adapter. select()
   the injected adapter, then connect() prompts the extension. Balance is read
   from the wallet's own assets. */
function useMidenFi() {
  const a = useMidenFiAdapter();
  const [balance, setBalance] = React.useState(0n);
  React.useEffect(() => {
    let live = true;
    if (a.connected && a.requestAssets) {
      a.requestAssets().then((assets) => {
        if (!live) return;
        const list = Array.isArray(assets) ? assets : (assets?.assets || []);
        const match = list.find((x) => String(x.faucetId ?? x.assetId ?? x.faucet ?? "").toLowerCase().includes(OBX_FAUCET_HEX.slice(2, 10)));
        try { setBalance(match ? BigInt(match.amount ?? match.balance ?? 0) : 0n); } catch (e) { setBalance(0n); }
      }).catch(() => {});
    } else if (!a.connected) setBalance(0n);
    return () => { live = false; };
  }, [a.connected]);

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
    address: a.address, balance, balanceLabel: formatAssetAmount(balance, 8),
    connect, disconnect: a.disconnect,
  };
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

  // Unified wallet model for the UI. MidenFi takes precedence when connected;
  // otherwise the built-in browser wallet.
  const kind = mf.connected ? "midenfi" : (builtin.connected ? "builtin" : null);
  const wallet = {
    connected: !!kind, kind,
    connecting: builtin.connecting || mf.connecting,
    funding: builtin.funding, fundMsg: builtin.fundMsg, error: builtin.error,
    midenfiAvailable: mf.available,
    walletId: kind === "midenfi" ? mf.address : builtin.walletId,
    balanceLabel: kind === "midenfi" ? mf.balanceLabel : builtin.balanceLabel,
    connectBuiltin: builtin.connect,
    connectMidenFi: mf.connect,
    disconnect: () => (kind === "midenfi" ? mf.disconnect() : builtin.disconnect()),
    fund: builtin.fund, // faucet credits the built-in wallet
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
  if (route === "detail" && market) screen = <window.MarketDetail m={market} go={go} onPlace={place} balance={balance} />;
  else if (route === "positions") screen = <window.PositionsScreen positions={positions} balance={balance} go={go} />;
  else if (route === "agents") screen = <window.AgentsScreen />;
  else screen = <window.MarketsHome onOpen={openMarket} />;

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
