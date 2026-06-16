import { useMemo, useState } from "react";
import { useMiden, useSyncState, useCreateWallet, useTransaction } from "@miden-sdk/react";
import {
  type Account,
  AccountId,
  Package,
  NoteScript,
  Note,
  NoteAssets,
  NoteMetadata,
  NoteRecipient,
  NoteStorage,
  NoteTag,
  NoteType,
  NoteArray,
  FeltArray,
  TransactionRequestBuilder,
} from "@miden-sdk/miden-sdk";
import { MARKETS, type Market, EXPLORER_BASE_URL, MARKET_ID_HEX } from "@/config";
import { useMarket } from "@/hooks/useMarket";
import { randomWord } from "@/lib/miden";
import "./subrosa.css";

type Side = "yes" | "no";
type Route = "markets" | "detail" | "agents" | "portfolio";
type Position = { market: string; side: Side; amount: number; account: string; tx?: string };

// Confidential agents (Polybaskets tier). The first is the *real* agent that
// traded on-chain this build (see docs/PROGRESS.md); the rest are illustrative.
const AGENTS = [
  { id: "a1", name: "delta-neutral-01", strat: "Delta-neutral basket", status: "active", cap: "$500", cosign: false, markets: 1, live: true },
  { id: "a2", name: "sharp-fade-02", strat: "Fade the crowd", status: "active", cap: "$2,500", cosign: false, markets: 8 },
  { id: "a3", name: "macro-momentum", strat: "Momentum on macro", status: "paused", cap: "$25,000", cosign: true, markets: 5 },
  { id: "a4", name: "oracle-arb-09", strat: "Resolution arbitrage", status: "active", cap: "$12,000", cosign: true, markets: 21 },
];

export function Subrosa() {
  const { isReady, isInitializing, error } = useMiden();
  const { syncHeight } = useSyncState();
  const market = useMarket();
  const { createWallet, isCreating } = useCreateWallet();
  const { execute } = useTransaction();

  const [route, setRoute] = useState<Route>("markets");
  const [selected, setSelected] = useState<Market | null>(null);
  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState("250");
  const [trader, setTrader] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState<string | null>(null);
  const [lastSeal, setLastSeal] = useState<Position | null>(null);

  const liveYesPct = useMemo(() => {
    if (!market.state) return null;
    const { yes, no } = market.state;
    const denom = yes + no;
    if (denom === 0n) return 50;
    return Number((no * 10000n) / denom) / 100;
  }, [market.state]);

  function yesPctFor(m: Market): number {
    if (m.live && liveYesPct !== null) return liveYesPct;
    return m.yesPct ?? 50;
  }

  const resolved = market.state ? market.state.resolution !== 0n : false;
  const resolvedSide = market.state?.resolution === 1n ? "YES" : market.state?.resolution === 2n ? "NO" : null;

  function open(m: Market) { setSelected(m); setRoute("detail"); setLastSeal(null); }

  async function placePrivatePosition() {
    if (!selected) return;
    setPlaceErr(null);
    setPlacing(true);
    try {
      let acct = trader;
      if (!acct) {
        acct = await createWallet({ storageMode: "private" });
        setTrader(acct);
      }
      // Real on-chain tx from the private trader: outputs the position note and
      // deploys the account (commitment only). Fixed amounts in v1.
      const masp = side === "yes" ? "/packages/place_note.masp" : "/packages/place_no_note.masp";
      const placedAmount = side === "yes" ? 250 : 100;
      const buf = await fetch(masp).then((r) => r.arrayBuffer());
      const pkg = Package.deserialize(new Uint8Array(buf));
      const noteScript = NoteScript.fromPackage(pkg);
      const marketId = AccountId.fromHex(MARKET_ID_HEX);
      const recipient = new NoteRecipient(randomWord(), noteScript, new NoteStorage(new FeltArray()));
      const tag = NoteTag.withAccountTarget(marketId);
      const metadata = new NoteMetadata(acct.id(), NoteType.Private, tag);
      const note = new Note(new NoteAssets(), metadata, recipient);
      const request = new TransactionRequestBuilder().withOwnOutputNotes(new NoteArray([note])).build();
      const result = await execute({ accountId: acct.id(), request });
      const pos: Position = {
        market: selected.question, side, amount: placedAmount,
        account: acct.id().toString(), tx: result.transactionId,
      };
      setPositions((p) => [pos, ...p]);
      setLastSeal(pos);
    } catch (e) {
      setPlaceErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPlacing(false);
    }
  }

  if (error) return <div className="sr-loading">Failed to initialize Miden client: {error.message}</div>;
  if (isInitializing || !isReady) return <div className="sr-loading">Initializing Miden client…</div>;

  const traderShort = trader ? short(trader.id().toString()) : "no account";

  return (
    <div className="sr-app">
      <header className="sr-hd">
        <div className="sr-logo"><span className="mk" /> subrosa</div>
        <nav className="sr-nav">
          <button className={route === "markets" || route === "detail" ? "on" : ""} onClick={() => setRoute("markets")}>Markets</button>
          <button className={route === "agents" ? "on" : ""} onClick={() => setRoute("agents")}>Agents</button>
          <button className={route === "portfolio" ? "on" : ""} onClick={() => setRoute("portfolio")}>Portfolio</button>
        </nav>
        <div className="sr-hd-right">
          <span className="sr-priv">🔒 PRIVATE</span>
          <span className="sr-sep" />
          <span className="sr-bal mono">testnet block {syncHeight ?? "…"}</span>
          <span className="sr-acct">{traderShort}</span>
        </div>
      </header>

      <main className="sr-main">
        {route === "markets" && <MarketsScreen markets={MARKETS} yesPctFor={yesPctFor} onPick={open} loading={market.loading} />}
        {route === "detail" && selected && (
          <MarketDetail
            m={selected} yesPct={yesPctFor(selected)} state={market.state}
            resolved={resolved} resolvedSide={resolvedSide}
            side={side} setSide={setSide} amount={amount} setAmount={setAmount}
            placing={placing || isCreating} placeErr={placeErr} onPlace={placePrivatePosition}
            lastSeal={lastSeal} onBack={() => setRoute("markets")}
          />
        )}
        {route === "agents" && <AgentsScreen />}
        {route === "portfolio" && <PortfolioScreen positions={positions} onGoMarkets={() => setRoute("markets")} />}
      </main>

      <footer className="sr-foot">Public odds. Private positions. Confidential agents. · proved in-browser, settled on Miden</footer>
    </div>
  );
}

/* ---------- Markets ---------- */
function MarketsScreen({ markets, yesPctFor, onPick, loading }: {
  markets: Market[]; yesPctFor: (m: Market) => number; onPick: (m: Market) => void; loading: boolean;
}) {
  return (
    <>
      <div className="sr-head">
        <div>
          <span className="sr-eyebrow">Private prediction markets · on Miden</span>
          <h1 className="sr-h1">Markets</h1>
          <p className="sr-lede">Public, trustworthy odds — your position, size and P&amp;L stay private. The network records only a commitment.</p>
        </div>
        <span className="mlabel">{loading ? "reading chain…" : "live"}</span>
      </div>
      <div className="grid">
        {markets.map((m) => {
          const yes = yesPctFor(m);
          return (
            <button key={m.id} className="mcard" onClick={() => onPick(m)}>
              <div className="mcat"><span className="d" style={{ background: m.color }} />{m.category}{m.live && <span className="live mono">● LIVE</span>}</div>
              <h3>{m.question}</h3>
              <div style={{ marginTop: "auto" }}>
                <div className="orow"><span className="yes">YES {yes.toFixed(1)}%</span><span className="no">{(100 - yes).toFixed(1)}% NO</span></div>
                <Bar yesPct={yes} thin />
              </div>
              <div className="mfoot"><span>{m.volume} Vol</span><span>{m.closes}</span></div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Bar({ yesPct, thin }: { yesPct: number; thin?: boolean }) {
  return <div className={thin ? "bar thin" : "bar"}><span className="y" style={{ width: `${yesPct}%` }} /><span className="n" style={{ width: `${100 - yesPct}%` }} /></div>;
}

/* ---------- Market detail ---------- */
function MarketDetail(p: {
  m: Market; yesPct: number; state: { yes: bigint; no: bigint; volume: bigint } | null;
  resolved: boolean; resolvedSide: string | null;
  side: Side; setSide: (s: Side) => void; amount: string; setAmount: (a: string) => void;
  placing: boolean; placeErr: string | null; onPlace: () => void;
  lastSeal: Position | null; onBack: () => void;
}) {
  return (
    <section className="detail">
      <button className="back" onClick={p.onBack}>‹ all markets</button>
      <div className="mcat">{p.m.category}{p.m.live && <span className="live mono">● LIVE ON-CHAIN</span>}</div>
      <h1 className="qh">{p.m.question}</h1>
      <Bar yesPct={p.yesPct} />
      {p.m.live && (
        <p className="sub">
          reserves YES {p.state?.yes.toString() ?? "…"} · NO {p.state?.no.toString() ?? "…"} · vol {p.state?.volume.toString() ?? "…"} ·{" "}
          <a className="link" href={`${EXPLORER_BASE_URL}/account/${MARKET_ID_HEX}`} target="_blank" rel="noreferrer">view on explorer ↗</a>
        </p>
      )}
      {p.resolved ? (
        <div className="resolved mono">RESOLVED — {p.resolvedSide} won. Winners redeem privately.</div>
      ) : (
        <div className="ticket">
          <div className="side">
            <button className={p.side === "yes" ? "on yes" : ""} onClick={() => { p.setSide("yes"); p.setAmount("250"); }}>YES</button>
            <button className={p.side === "no" ? "on no" : ""} onClick={() => { p.setSide("no"); p.setAmount("100"); }}>NO</button>
          </div>
          <label className="amt">
            <span className="mlabel">amount (OBX) · fixed in v1</span>
            <input value={p.amount} readOnly />
          </label>
          <div className="payout"><span>est. payout if {p.side.toUpperCase()} wins</span><b>{payout(Number(p.amount) || 0, p.side, p.yesPct)} OBX</b></div>
          <button className="btn btn-primary btn-lg" disabled={p.placing} onClick={p.onPlace} style={{ justifyContent: "center" }}>
            {p.placing ? "Submitting on-chain…" : "Place private position"}
          </button>
          {p.placeErr && <p className="err">{p.placeErr}</p>}
        </div>
      )}
      {p.lastSeal && <Seal pos={p.lastSeal} />}
    </section>
  );
}

function Seal({ pos }: { pos: Position }) {
  return (
    <div className="seal">
      <div className="seal-row"><span className="tag private">PRIVATE</span> position recorded</div>
      <p className="seal-text">
        Your {pos.side.toUpperCase()} position of {pos.amount} OBX was placed from a private account
        (signed locally; proving delegated to the testnet prover) and <b>submitted on-chain</b>. The
        network records <b>only a commitment</b> — no holder, no side, no size.
      </p>
      {pos.tx && <a className="seal-link" href={`${EXPLORER_BASE_URL}/tx/${pos.tx}`} target="_blank" rel="noreferrer">transaction {short(pos.tx)} · view on explorer ↗</a>}
      <a className="seal-link" href={`${EXPLORER_BASE_URL}/account/${pos.account}`} target="_blank" rel="noreferrer">private acct {short(pos.account)} · commitment only ↗</a>
    </div>
  );
}

/* ---------- Agents ---------- */
function BotIcon({ color }: { color: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
  );
}

function AgentsScreen() {
  return (
    <>
      <div className="sr-head">
        <div>
          <span className="sr-eyebrow">Polybaskets · agent tier</span>
          <h1 className="sr-h1">Confidential agents</h1>
          <p className="sr-lede">
            Agents trade from private accounts — their strategy and book can't be copied. Risk caps and
            co-sign rules run on Miden's programmable auth: autonomous up to a cap, human co-sign above it
            (coordinated by self-hosted Guardian).
          </p>
        </div>
        <button className="btn btn-primary">+ Deploy agent</button>
      </div>

      <div className="row-stats" style={{ marginBottom: 22 }}>
        <div className="card" style={{ padding: 18 }}><div className="stat-l">Active agents</div><div className="stat-v">316</div></div>
        <div className="card" style={{ padding: 18 }}><div className="stat-l">Agent transactions</div><div className="stat-v">4.74M+</div></div>
        <div className="card" style={{ padding: 18 }}><div className="stat-l">Combined cap</div><div className="stat-v">$44.5k</div><div className="stat-hint">your agents</div></div>
        <div className="card" style={{ padding: 18 }}><div className="stat-l">Strategies on-chain</div><div className="stat-v">0</div><div className="stat-hint">all private</div></div>
      </div>

      <div className="list">
        {AGENTS.map((a) => {
          const active = a.status === "active";
          return (
            <div className="arow" key={a.id}>
              <div className="ico"><BotIcon color={active ? "var(--orange)" : "var(--txt-faint)"} /></div>
              <div>
                <div className="nm">{a.name}{a.live && <span className="live mono" style={{ fontSize: 10 }}> ● REAL</span>}</div>
                <div className="st">{a.strat}</div>
              </div>
              <div className="hidem"><div className="mlabel">P&amp;L</div><div className="v muted">👁 ••••••</div></div>
              <div className="hidem"><div className="mlabel">Risk cap</div><div className="v">{a.cap}</div></div>
              <div className="hidem"><div className="mlabel">Auth</div><div style={{ marginTop: 5 }}>{a.cosign ? <span className="tag oracle">Co-sign</span> : <span className="tag">Autonomous</span>}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={active ? "tag positive" : "tag"}><span className="dot" />{active ? "Active" : "Paused"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <div className="mlabel" style={{ color: "var(--orange)" }}>PROGRAMMABLE-AUTH GUARDRAIL</div>
        <p className="seal-text" style={{ marginTop: 8 }}>
          The <b>delta-neutral-01</b> agent above is real — it read the live odds, decided, and placed an
          autonomous on-chain trade within its cap this build. Trades above the cap require a human
          co-signature coordinated by Guardian before they execute (2-of-N multisig). Run it:{" "}
          <code className="seal-link">cd agent &amp;&amp; npm start -- --once</code>, and for the co-sign path{" "}
          <code className="seal-link">npm run guardian:up &amp;&amp; npm run cosign</code>.
        </p>
      </div>
    </>
  );
}

/* ---------- Portfolio ---------- */
function PortfolioScreen({ positions, onGoMarkets }: { positions: Position[]; onGoMarkets: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const mask = (v: string) => (revealed ? v : "••••••");
  const bookValue = positions.reduce((s, p) => s + p.amount, 0);
  return (
    <>
      <div className="sr-head">
        <div>
          <span className="sr-eyebrow">Your private book</span>
          <h1 className="sr-h1">Portfolio</h1>
        </div>
        <button className="btn btn-secondary" onClick={() => setRevealed((r) => !r)}>{revealed ? "🙈 Hide values" : "🔒 Reveal to me"}</button>
      </div>

      <div className="row-stats" style={{ marginBottom: 22 }}>
        <div className="card glow" style={{ padding: 18 }}><div className="stat-l">Book value</div><div className="stat-v">{mask(`${bookValue} OBX`)}</div></div>
        <div className="card" style={{ padding: 18 }}><div className="stat-l">Open positions</div><div className="stat-v">{positions.length}</div></div>
        <div className="card" style={{ padding: 18 }}><div className="stat-l">Proved in-browser</div><div className="stat-v">{positions.filter((p) => p.tx).length}</div></div>
        <div className="card" style={{ padding: 18 }}><div className="stat-l">Visible on-chain</div><div className="stat-v">0</div><div className="stat-hint">commitments only</div></div>
      </div>

      {positions.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <p className="seal-text" style={{ color: "var(--txt-muted)" }}>No positions yet. Place one from a market — it's proved in your browser and only a commitment lands on-chain.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onGoMarkets}>Browse markets</button>
        </div>
      ) : (
        <div className="ptable">
          <div className="phead">{["Market", "Side", "Size", "On-chain", ""].map((h, i) => <span key={i} className="mlabel">{h}</span>)}</div>
          {positions.map((p, i) => (
            <a key={i} className="prow" href={p.tx ? `${EXPLORER_BASE_URL}/tx/${p.tx}` : `${EXPLORER_BASE_URL}/account/${p.account}`} target="_blank" rel="noreferrer">
              <span className="pq">{p.market}</span>
              <span><span className={`tag ${p.side === "yes" ? "private" : ""}`}>{p.side.toUpperCase()}</span></span>
              <span className="mono" style={{ fontSize: 13.5 }}>{mask(`${p.amount} OBX`)}</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--orange)" }}>{p.tx ? `${short(p.tx)} ↗` : "commitment"}</span>
              <span style={{ color: "var(--txt-faint)" }}>›</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- helpers ---------- */
function payout(amount: number, side: Side, yesPct: number): number {
  const price = side === "yes" ? yesPct / 100 : (100 - yesPct) / 100;
  if (price <= 0) return 0;
  return Math.round(amount / price);
}
function short(s: string): string {
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
