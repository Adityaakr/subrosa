// @ts-nocheck
import React from "react";
import { useCreateWallet, useTransaction } from "@miden-sdk/react";
import {
  AccountId, Package, NoteScript, Note, NoteAssets, NoteMetadata,
  NoteRecipient, NoteStorage, NoteTag, NoteType, NoteArray, FeltArray, TransactionRequestBuilder,
} from "@miden-sdk/miden-sdk";
import { randomWord } from "../lib/miden";

const MARKET_ID_HEX = "0x5ff0303f0b795d1039ca5b51d8480b";
const shortHex = (s) => (s && s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);

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
  const traderRef = React.useRef(null);
  const { createWallet } = useCreateWallet();
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
        let acct = traderRef.current;
        if (!acct) { acct = await createWallet({ storageMode: "private" }); traderRef.current = acct; }
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
        <window.TopBar left={topLeft} balance={balance} />
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
