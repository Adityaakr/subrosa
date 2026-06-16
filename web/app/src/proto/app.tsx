// @ts-nocheck
import React from "react";
import { useCreateWallet, useTransaction, useAccount, formatAssetAmount } from "@miden-sdk/react";
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
  const [walletId, setWalletId] = React.useState(() => {
    try { return localStorage.getItem(WALLET_LS); } catch (e) { return null; }
  });
  const [connecting, setConnecting] = React.useState(false);
  const acctRef = React.useRef(null);
  const q = useAccount(walletId ?? undefined);
  React.useEffect(() => { if (q.account) acctRef.current = q.account; }, [q.account]);
  // If a persisted id is no longer in the local store, reset rather than get
  // stuck "connected" with no account.
  React.useEffect(() => {
    if (walletId && q && q.isLoading === false && !q.account) {
      acctRef.current = null;
      try { localStorage.removeItem(WALLET_LS); } catch (e) {}
      setWalletId(null);
    }
  }, [walletId, q.isLoading, q.account]);

  let balance = 0n;
  try { if (q.getBalance) balance = q.getBalance(OBX_FAUCET_HEX) ?? 0n; } catch (e) {}

  const connect = async () => {
    if (acctRef.current) return acctRef.current;
    if (walletId && q.account) { acctRef.current = q.account; return q.account; }
    if (walletId && !q.account) throw new Error("wallet still loading — try again in a moment");
    setConnecting(true);
    try {
      const w = await createWallet({ storageMode: "private" });
      acctRef.current = w;
      const id = w.id().toString();
      try { localStorage.setItem(WALLET_LS, id); } catch (e) {}
      setWalletId(id);
      return w;
    } finally { setConnecting(false); }
  };
  const disconnect = () => {
    acctRef.current = null;
    try { localStorage.removeItem(WALLET_LS); } catch (e) {}
    setWalletId(null);
  };
  const fund = async () => {
    if (!walletId) return;
    try {
      await fetch(FUND_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: walletId }) });
      setTimeout(() => q.refetch && q.refetch(), 1500);
    } catch (e) { console.warn("[fund] failed — is the operator faucet service running?", e); }
  };

  return {
    connected: !!walletId, connecting, walletId,
    account: acctRef.current,
    balance, balanceLabel: formatAssetAmount(balance, 8),
    connect, disconnect, fund, refetch: q.refetch,
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
  const wallet = useWallet();
  const { execute } = useTransaction();

  const go = (r) => { if (r !== "detail") setMarket(null); setRoute(r); };
  const openMarket = (m) => { setMarket(m); setRoute("detail"); };

  const place = (order) => {
    committed.current = false;
    setRealTx(null);
    setSeal({ order });
    // Real on-chain tx in parallel (private account + position note). The seal
    // animation plays regardless; the real hash appears when it lands.
    (async () => {
      try {
        const acct = await wallet.connect();
        const masp = order.side === "YES" ? "/packages/place_note.masp" : "/packages/place_no_note.masp";
        const buf = await fetch(masp).then((r) => r.arrayBuffer());
        const ns = NoteScript.fromPackage(Package.deserialize(new Uint8Array(buf)));
        const mid = AccountId.fromHex(MARKET_ID_HEX);
        const rec = new NoteRecipient(randomWord(), ns, new NoteStorage(new FeltArray()));
        const meta = new NoteMetadata(acct.id(), NoteType.Private, NoteTag.withAccountTarget(mid));
        const note = new Note(new NoteAssets(), meta, rec);
        const req = new TransactionRequestBuilder().withOwnOutputNotes(new NoteArray([note])).build();
        const res = await execute({ accountId: acct.id(), request: req });
        setRealTx({ tx: res.transactionId, account: acct.id().toString() });
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
