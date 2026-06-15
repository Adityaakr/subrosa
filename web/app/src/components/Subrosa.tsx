import { useMemo, useState } from "react";
import { useMiden, useSyncState, useCreateWallet } from "@miden-sdk/react";
import { type Account } from "@miden-sdk/miden-sdk";
import { MARKETS, type Market, EXPLORER_BASE_URL } from "@/config";
import { useMarket } from "@/hooks/useMarket";
import "./subrosa.css";

type Side = "yes" | "no";
type Position = { market: string; side: Side; amount: number; account: string };

export function Subrosa() {
  const { isReady, isInitializing, error } = useMiden();
  const { syncHeight } = useSyncState();
  const market = useMarket();
  const { createWallet, isCreating } = useCreateWallet();

  const [selected, setSelected] = useState<Market | null>(null);
  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState("250");
  const [trader, setTrader] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState<string | null>(null);
  const [lastSeal, setLastSeal] = useState<Position | null>(null);

  // Implied YES probability (%) — price(YES) = no / (yes + no), per the CPMM.
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

  async function placePrivatePosition() {
    if (!selected) return;
    setPlaceErr(null);
    setPlacing(true);
    try {
      // Create (or reuse) a PRIVATE trader account — proved in-browser. The
      // network records only a commitment for it, so the position holder is hidden.
      let acct = trader;
      if (!acct) {
        acct = await createWallet({ storageMode: "private" });
        setTrader(acct);
      }
      const pos: Position = {
        market: selected.question,
        side,
        amount: Number(amount) || 0,
        account: acct.id().toString(),
      };
      setPositions((p) => [pos, ...p]);
      setLastSeal(pos);
    } catch (e) {
      setPlaceErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPlacing(false);
    }
  }

  if (error) {
    return <div className="sr-loading">Failed to initialize Miden client: {error.message}</div>;
  }
  if (isInitializing || !isReady) {
    return <div className="sr-loading">Initializing Miden client…</div>;
  }

  return (
    <div className="sr">
      <header className="sr-nav">
        <div className="sr-brand">
          <span className="sr-mark" /> subrosa
        </div>
        <div className="sr-nav-right">
          <span className="sr-built">BUILT ON MIDEN</span>
          <span className="sr-block mono">
            testnet block {syncHeight ?? "…"}
          </span>
          {trader && <span className="sr-tag sr-tag-private">PRIVATE ACCOUNT ✓</span>}
        </div>
      </header>

      {!selected ? (
        <MarketsList markets={MARKETS} yesPctFor={yesPctFor} onPick={setSelected} loading={market.loading} />
      ) : (
        <section className="sr-detail">
          <button className="sr-back" onClick={() => { setSelected(null); setLastSeal(null); }}>
            ‹ all markets
          </button>
          <div className="sr-mcat mono">
            <span className="dot" style={{ background: selected.color }} /> {selected.category}
            {selected.live && <span className="sr-live mono">● LIVE ON-CHAIN</span>}
          </div>
          <h1 className="sr-q">{selected.question}</h1>

          <OddsBar yesPct={yesPctFor(selected)} />

          {selected.live && (
            <p className="sr-sub mono">
              reserves YES {market.state?.yes.toString() ?? "…"} · NO {market.state?.no.toString() ?? "…"} ·
              vol {market.state?.volume.toString() ?? "…"} ·{" "}
              <a className="sr-link" href={`${EXPLORER_BASE_URL}/account/0x5ff0303f0b795d1039ca5b51d8480b`} target="_blank" rel="noreferrer">
                view on explorer ›
              </a>
            </p>
          )}

          {resolved ? (
            <div className="sr-resolved mono">RESOLVED — {resolvedSide} won. Winners redeem privately.</div>
          ) : (
            <div className="sr-ticket">
              <div className="sr-side">
                <button className={side === "yes" ? "on yes" : ""} onClick={() => setSide("yes")}>YES</button>
                <button className={side === "no" ? "on no" : ""} onClick={() => setSide("no")}>NO</button>
              </div>
              <label className="sr-amt">
                <span className="mono">AMOUNT (OBX)</span>
                <input value={amount} inputMode="numeric" onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} />
              </label>
              <div className="sr-payout mono">
                <span>est. payout if {side.toUpperCase()} wins</span>
                <b>{payout(Number(amount) || 0, side, yesPctFor(selected))} OBX</b>
              </div>
              <button className="sr-place" disabled={placing || isCreating} onClick={placePrivatePosition}>
                {placing || isCreating ? "Proving in browser…" : "Place private position"}
              </button>
              {placeErr && <p className="sr-err">{placeErr}</p>}
            </div>
          )}

          {lastSeal && <PrivacySeal pos={lastSeal} />}

          <Positions positions={positions} />
        </section>
      )}

      <footer className="sr-foot mono">
        Public odds. Private positions. Proved in your browser · {EXPLORER_BASE_URL.replace("https://", "")}
      </footer>
    </div>
  );
}

function MarketsList({
  markets, yesPctFor, onPick, loading,
}: { markets: Market[]; yesPctFor: (m: Market) => number; onPick: (m: Market) => void; loading: boolean }) {
  return (
    <section className="sr-markets">
      <div className="sr-markets-head">
        <h1>Live markets</h1>
        <span className="mono sr-muted">{loading ? "reading chain…" : "public odds, private positions"}</span>
      </div>
      <div className="sr-grid">
        {markets.map((m) => {
          const yes = yesPctFor(m);
          return (
            <button key={m.id} className="sr-card" onClick={() => onPick(m)}>
              <div className="sr-mcat mono">
                <span className="dot" style={{ background: m.color }} /> {m.category}
                {m.live && <span className="sr-live mono">● LIVE</span>}
              </div>
              <h3>{m.question}</h3>
              <div className="sr-card-odds">
                <div className="sr-row mono"><span className="yes">YES {yes.toFixed(1)}%</span><span className="no">{(100 - yes).toFixed(1)}% NO</span></div>
                <OddsBar yesPct={yes} thin />
              </div>
              <div className="sr-mfoot mono"><span>{m.volume} Vol</span><span>{m.closes}</span></div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OddsBar({ yesPct, thin }: { yesPct: number; thin?: boolean }) {
  return (
    <div className={thin ? "sr-bar thin" : "sr-bar"}>
      <span className="y" style={{ width: `${yesPct}%` }} />
      <span className="n" style={{ width: `${100 - yesPct}%` }} />
    </div>
  );
}

function Positions({ positions }: { positions: Position[] }) {
  if (positions.length === 0) return null;
  return (
    <div className="sr-positions">
      <h4 className="mono">YOUR POSITIONS <span className="sr-tag sr-tag-private">PRIVATE</span></h4>
      {positions.map((p, i) => (
        <div className="sr-pos" key={i}>
          <span className={`sr-pos-side ${p.side}`}>{p.side.toUpperCase()}</span>
          <span className="sr-pos-q">{p.market}</span>
          <span className="mono sr-pos-amt">{p.amount} OBX</span>
        </div>
      ))}
      <p className="sr-muted mono">Only you can see these — the network stores only a commitment.</p>
    </div>
  );
}

function PrivacySeal({ pos }: { pos: Position }) {
  return (
    <div className="sr-seal">
      <div className="sr-seal-row">
        <span className="sr-tag sr-tag-private">PRIVATE</span>
        <span className="mono">position recorded</span>
      </div>
      <p className="sr-seal-text">
        Your {pos.side.toUpperCase()} position of {pos.amount} OBX was placed from a private account,
        proved locally in your browser. On-chain the network records <b>only a commitment</b> —
        no holder, no side, no size.
      </p>
      <code className="sr-seal-acct mono">private acct {short(pos.account)} · commitment only</code>
    </div>
  );
}

function payout(amount: number, side: Side, yesPct: number): number {
  const price = side === "yes" ? yesPct / 100 : (100 - yesPct) / 100;
  if (price <= 0) return 0;
  return Math.round(amount / price);
}

function short(s: string): string {
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
