// @ts-nocheck
import React from "react";
import { useCreateWallet, useTransaction, useAccount, useAccounts, useConsume, useSyncState, useNotes, formatAssetAmount, accountIdsEqual } from "@miden-sdk/react";
import { useWallet as useMidenFiAdapter } from "@miden-sdk/miden-wallet-adapter-react";
import { WalletAdapterNetwork, PrivateDataPermission } from "@miden-sdk/miden-wallet-adapter-base";
import {
  AccountId, Package, NoteScript, Note, NoteAssets, NoteMetadata,
  NoteRecipient, NoteStorage, NoteTag, NoteType, NoteArray, FeltArray, TransactionRequestBuilder,
} from "@miden-sdk/miden-sdk";
import { randomWord } from "../lib/miden";

const MARKET_ID_HEX = "0x5ff0303f0b795d1039ca5b51d8480b";
const OBX_FAUCET_HEX = "0x1201d9f8819d5220778535e4e2f08a";
const FUND_ENDPOINT = import.meta.env.VITE_FUND_ENDPOINT ?? "http://localhost:8787/fund";
const WALLET_LS = "subrosa.wallet.id";
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
  React.useEffect(() => { notesRef.current = notes.consumableNotes || []; }, [notes.consumableNotes]);

  const idOf = (a) => { try { return (a && a.id ? a.id() : a)?.toString?.() ?? String(a); } catch (e) { return String(a); } };
  const sameId = (a, id) => { if (!a || !id) return false; try { return accountIdsEqual(a, id); } catch (e) { return idOf(a) === id; } };

  // every wallet this client has in its local store
  const list = React.useMemo(() => [...(wallets || []), ...(accounts || [])].filter(Boolean), [wallets, accounts]);

  const [walletId, setWalletId] = React.useState(() => {
    try { return localStorage.getItem(WALLET_LS); } catch (e) { return null; }
  });
  const [connecting, setConnecting] = React.useState(false);
  const [funding, setFunding] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Resolve the connected account OBJECT from the store by its persisted id —
  // far more reliable than re-deriving it from a string each render.
  const stored = React.useMemo(() => (walletId ? list.find((a) => sameId(a, walletId)) || null : null), [walletId, list]);
  const acctRef = React.useRef(null);
  React.useEffect(() => { if (stored) acctRef.current = stored; }, [stored]);
  const account = stored || acctRef.current;

  const q = useAccount(account ?? walletId ?? undefined);
  let balance = 0n;
  try { if (q.getBalance) balance = q.getBalance(OBX_FAUCET_HEX) ?? 0n; } catch (e) {}

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

  // Ask the operator faucet to mint OBX to this wallet, then sync + consume the
  // minted note so the live balance actually reflects the credit.
  const fund = async () => {
    const id = address;
    if (!id || funding) return;
    setFunding(true);
    try {
      const r = await fetch(FUND_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: id }) });
      if (!r.ok) throw new Error("fund endpoint returned " + r.status);
      for (let i = 0; i < 10; i++) {
        await new Promise((res) => setTimeout(res, 3000));
        try { await sync?.(); } catch (e) {}
        try { await notes.refetch?.(); } catch (e) {}
        const cn = notesRef.current || [];
        if (cn.length) {
          try { await consume({ accountId: id, notes: cn }); } catch (e) { console.warn("[fund] consume failed:", e); }
          break;
        }
      }
      try { await q.refetch?.(); } catch (e) {}
    } catch (e) {
      console.warn("[fund] failed — is the operator faucet service running on :8787?", e);
    } finally { setFunding(false); }
  };

  return {
    connected: !!account || !!walletId, connecting, funding, error,
    walletId: address, account,
    balance, balanceLabel: formatAssetAmount(balance, 8),
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
    funding: builtin.funding, error: builtin.error,
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
    // Real on-chain tx in parallel (private account + position note). The seal
    // animation plays regardless; the real hash appears when it lands. Signs
    // from whichever wallet is active (MidenFi via the bridged signer, else the
    // built-in private account).
    (async () => {
      try {
        let signerRef, senderId;
        if (mf.connected && mf.address) {
          signerRef = mf.address;
          senderId = AccountId.fromHex(mf.address);
        } else {
          const acct = await builtin.connect();
          signerRef = acct.id();
          senderId = acct.id();
        }
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
