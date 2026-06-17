// @ts-nocheck
import React from "react";
/* Subrosa prototype — Markets home + Market detail + bet panel */
const { useState: uS, useEffect: uE, useRef: uR } = React;

function parseAbb(s) {
  const n = parseFloat(String(s).replace(/[$,]/g, ""));
  if (/k/i.test(s)) return n * 1e3;
  if (/m/i.test(s)) return n * 1e6;
  return n;
}

const fmtUnits = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(Math.round(n)));

// Overlay real on-chain state onto a market when it's backed by a live account
// (window.LIVE_MARKETS). Odds/volume/liquidity become real; a `_live` flag
// drives the LIVE badge. Other fields stay as display decoration for now.
function withLive(m, live) {
  const L = live && live[m.id];
  if (!L) return m;
  return {
    ...m,
    yes: Math.round(L.yesPct),
    volume: fmtUnits(L.volume) + " OBX",
    liquidity: fmtUnits(L.liquidity) + " OBX",
    _live: true,
    _resolution: L.resolution,
  };
}

function LiveBadge() {
  return (
    <span className="mono" title="Odds & volume read live from the on-chain market account" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--yes)", background: "var(--yes-dim)", padding: "2px 7px", borderRadius: 999 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--yes)" }} /> Live
    </span>
  );
}

/* ---------- home grid tile ---------- */
function MarketTile({ m, onOpen }) {
  const [h, setH] = uS(false);
  const up = m.change >= 0;
  return (
    <div onClick={() => onOpen(m)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: "var(--surface)", border: `1px solid ${h ? "var(--hair-2)" : "var(--hair)"}`, borderRadius: "var(--r)", padding: 18, cursor: "pointer", transition: "all 180ms cubic-bezier(0.22,1,0.36,1)", transform: h ? "translateY(-3px)" : "none", boxShadow: h ? "0 16px 36px rgba(12,12,14,0.10), 0 0 0 1px rgba(255,85,0,0.10)" : "0 1px 2px rgba(12,12,14,0.05)", display: "flex", flexDirection: "column", gap: 14, minHeight: 196 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <window.Cat name={m.category} />
        {m._resolution ? (
          <span className="mono" title="Resolved on-chain" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: m._resolution === 1 ? "var(--yes)" : "var(--no)", background: m._resolution === 1 ? "var(--yes-dim)" : "var(--no-dim)", padding: "2px 7px", borderRadius: 999 }}>
            ✓ {m._resolution === 1 ? "YES" : "NO"} won
          </span>
        ) : m._live ? <LiveBadge /> : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5 }} className="mono">
            <window.Icon name={up ? "trending-up" : "trending-down"} size={13} color={up ? "var(--yes)" : "var(--no)"} />
            <span style={{ color: up ? "var(--yes)" : "var(--no)" }}>{up ? "+" : ""}{m.change}%</span>
          </span>
        )}
      </div>
      <h3 style={{ fontFamily: "var(--disp)", fontWeight: 500, fontSize: 16.5, lineHeight: 1.28, letterSpacing: "-0.01em", color: "var(--text)", margin: 0, minHeight: 42 }}>{m.question}</h3>
      <div style={{ marginTop: "auto" }}>
        <window.OddsBar yes={m.yes} showLabels={true} labelSize={12} height={7} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--hair)" }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>{m.volume} Vol</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} className="mono">
          <window.Icon name="clock" size={12} color="var(--faint)" />
          <span style={{ fontSize: 12, color: "var(--faint)" }}>{m.closesIn}</span>
        </span>
      </div>
    </div>
  );
}

/* ---------- subtle halftone for the markets hero ---------- */
function HeroHalftone() {
  const ref = uR(null);
  uE(() => {
    const c = ref.current; if (!c) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio||1);
      const w = c.clientWidth, h = c.clientHeight; if (!w||!h) return;
      c.width = w*dpr; c.height = h*dpr;
      const x = c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,w,h);
      const step = 7;
      for (let yy=0; yy<h; yy+=step){ for (let xx=0; xx<w; xx+=step){
        const nx=xx/w, ny=yy/h;
        let f = nx*0.7 + (1-ny)*0.55;
        f += 0.18*Math.sin(nx*14+ny*9);
        f = Math.max(0, Math.min(1, f));
        const r = f*f*2.3*(0.6+Math.random()*0.6);
        if (r>0.42){ x.globalAlpha=0.10+f*0.30; x.beginPath(); x.arc(xx,yy,Math.min(2.3,r),0,6.2832); x.fillStyle='#FF5500'; x.fill(); }
      }}
      x.globalAlpha=0.26; x.strokeStyle='#FF5500'; x.lineWidth=0.6;
      const pts=[]; for (let i=0;i<8;i++) pts.push([w*(0.42+Math.random()*0.58), h*Math.random()*0.7]);
      for (let i=0;i<pts.length;i++){ let best=-1,bd=1e9; for(let j=0;j<pts.length;j++){ if(j!==i){ const d=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]); if(d<bd){bd=d;best=j;} } } if(best>=0){ x.beginPath(); x.moveTo(pts[i][0],pts[i][1]); x.lineTo(pts[best][0],pts[best][1]); x.stroke(); } }
      x.globalAlpha=1;
    };
    draw();
    const onR=()=>draw(); window.addEventListener('resize', onR);
    return ()=>window.removeEventListener('resize', onR);
  }, []);
  return <canvas ref={ref} style={{ position:'absolute', top:-18, right:-12, width:480, height:240, zIndex:0, pointerEvents:'none', maskImage:'radial-gradient(125% 120% at 100% 0%, #000 28%, transparent 74%)', WebkitMaskImage:'radial-gradient(125% 120% at 100% 0%, #000 28%, transparent 74%)' }} />;
}

/* ---------- markets home ---------- */
function MarketsHome({ onOpen, liveMarkets }) {
  const cats = ["All", ...Array.from(new Set(window.OBS.markets.map((m) => m.category)))];
  const [f, setF] = uS("All");
  const base = window.OBS.markets.map((m) => withLive(m, liveMarkets));
  const shown = f === "All" ? base : base.filter((m) => m.category === f);
  return (
    <div className="scroll" style={{ overflowY: "auto", height: "100%" }}>
      <div className="page" style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 28px 64px" }}>
        {/* hero band */}
        <div className="hero-band" style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 26 }}>
          <HeroHalftone />
          <div style={{ position: "relative", zIndex: 1 }}>
            <span className="tag" style={{ color: "var(--accent)" }}>PRIVATE PREDICTION MARKETS · ON MIDEN</span>
            <h1 style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 38, letterSpacing: "-0.022em", color: "var(--text)", margin: "12px 0 8px", lineHeight: 1.04 }}>Bet without being watched.</h1>
            <p style={{ fontSize: 15.5, color: "var(--muted)", margin: 0, maxWidth: 540 }}>Public, trustworthy odds — your position, size and P&amp;L stay private. Only a commitment is recorded on-chain.</p>
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 30, paddingBottom: 4 }}>
            {[["Markets", String(window.OBS.markets.length)], ["Odds", "Public"], ["Positions", "Private"]].map(([l, v]) => (
              <div key={l}>
                <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: "var(--text)", letterSpacing: "-0.01em" }}>{v}</div>
                <div className="tag" style={{ color: "var(--faint)", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* filter chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {cats.map((c) => {
            const on = c === f;
            return (
              <button key={c} onClick={() => setF(c)} style={{ height: 32, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 500, border: `1px solid ${on ? "transparent" : "var(--hair)"}`, background: on ? "var(--accent)" : "var(--surface)", color: on ? "#fff" : "var(--muted)", transition: "all 140ms ease" }}>{c}</button>
            );
          })}
        </div>

        {/* grid */}
        <div className="grid-markets" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {shown.map((m) => (
            <MarketTile key={m.id} m={m} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- larger odds chart ---------- */
function OddsChart({ data, color, width = 560, height = 130 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const pad = 6, rng = (max - min) || 1;
  const X = (i) => (i / (data.length - 1)) * width;
  const Y = (v) => height - pad - ((v - min) / rng) * (height - pad * 2);
  const line = data.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const area = line + ` L ${width} ${height} L 0 ${height} Z`;
  const last = data[data.length - 1];
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="ocg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.26" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="rgba(12,12,14,0.06)" strokeWidth="1" />)}
      <path d={area} fill="url(#ocg)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(data.length - 1)} cy={Y(last)} r="4" fill={color} />
      <circle cx={X(data.length - 1)} cy={Y(last)} r="4" fill="none" stroke={color} strokeOpacity="0.5"><animate attributeName="r" from="4" to="11" dur="1.8s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.6" to="0" dur="1.8s" repeatCount="indefinite" /></circle>
    </svg>
  );
}

/* ---------- anonymized live activity ---------- */
function ActivityFeed() {
  const seed = [
    { side: "YES", t: "2s" }, { side: "NO", t: "9s" }, { side: "YES", t: "14s" }, { side: "YES", t: "31s" }, { side: "NO", t: "47s" },
  ];
  const [rows, setRows] = uS(seed);
  uE(() => {
    const id = setInterval(() => {
      setRows((r) => [{ side: Math.random() > 0.5 ? "YES" : "NO", t: "now", k: Math.random() }, ...r.slice(0, 4)]);
    }, 3400);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((r, i) => (
        <div key={r.k || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: i < rows.length - 1 ? "1px solid var(--hair)" : "none", opacity: i === 0 ? 1 : 0.6 - i * 0.08, animation: i === 0 ? "fadeUp 0.4s ease both" : "none" }}>
          <window.Icon name="fingerprint" size={14} color="var(--faint)" />
          <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>0x••••</span>
          <span className="tag" style={{ color: r.side === "YES" ? "var(--yes)" : "var(--no)" }}>{r.side === "YES" ? "▲ YES" : "▼ NO"}</span>
          <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>•••• OBX</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--faint)" }}>{r.t}</span>
        </div>
      ))}
    </div>
  );
}

// Real live trades: derive them from on-chain reserve deltas. When the live
// poll shows yes/no_reserve increased, that increase IS a real trade (side +
// amount). Public side/size, private owner — genuinely anonymized.
function useReserveTrades(ls) {
  const [trades, setTrades] = uS([]);
  const prev = uR(null);
  uE(() => {
    if (!ls) return;
    const p = prev.current;
    if (p) {
      const evs = [];
      const dy = ls.yes - p.yes, dn = ls.no - p.no;
      if (dy > 0) evs.push({ side: "YES", amt: dy, k: "y" + Date.now() });
      if (dn > 0) evs.push({ side: "NO", amt: dn, k: "n" + Date.now() });
      if (evs.length) setTrades((ts) => [...evs, ...ts].slice(0, 8));
    }
    prev.current = { yes: ls.yes, no: ls.no };
  }, [ls && ls.yes, ls && ls.no]);
  return trades;
}

function RealTrades({ trades, isLive }) {
  if (!isLive) return <div className="mono" style={{ fontSize: 12.5, color: "var(--faint)", padding: "10px 4px" }}>Preview market — no on-chain account yet.</div>;
  if (!trades.length) return (
    <div className="mono" style={{ fontSize: 12.5, color: "var(--faint)", padding: "10px 4px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--yes)", animation: "blink 1.6s infinite" }} /> Watching the market account for trades…
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {trades.map((r, i) => (
        <div key={r.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: i < trades.length - 1 ? "1px solid var(--hair)" : "none", animation: i === 0 ? "fadeUp 0.4s ease both" : "none" }}>
          <window.Icon name="activity" size={14} color="var(--faint)" />
          <span className="tag" style={{ color: r.side === "YES" ? "var(--yes)" : "var(--no)" }}>{r.side === "YES" ? "▲ YES" : "▼ NO"}</span>
          <span className="mono" style={{ fontSize: 12.5, color: "var(--text)" }}>+{r.amt} OBX</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--faint)" }}>on-chain</span>
        </div>
      ))}
    </div>
  );
}

const RES_LABEL = { 1: "YES", 2: "NO" };

/* Resolved market: betting closed; winners redeem from the Positions screen. */
function ResolvedPanel({ m, resolution }) {
  const won = RES_LABEL[resolution];
  const c = resolution === 1 ? "var(--yes)" : "var(--no)";
  const bg = resolution === 1 ? "var(--yes-dim)" : "var(--no-dim)";
  return (
    <div className="bet-panel" style={{ position: "sticky", top: 0, background: "var(--glass)", backdropFilter: "blur(14px)", border: "1px solid var(--hair-2)", borderRadius: "var(--r)", padding: 20, boxShadow: "0 20px 50px rgba(12,12,14,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Market resolved</span>
        <span className="tag" style={{ color: c, background: bg, padding: "3px 9px", borderRadius: 999 }}>{won} WON</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: "var(--r-md)", background: bg, border: `1px solid ${c}33` }}>
        <window.Icon name="shield-check" size={20} color={c} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>Outcome: {won}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Recorded on-chain by the resolver. Betting is closed.</div>
        </div>
      </div>
      <p style={{ display: "flex", alignItems: "center", gap: 7, margin: "16px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
        <window.Icon name="wallet" size={14} color="var(--accent)" />
        Hold a winning <b style={{ color: "var(--text)" }}>{won}</b> position? Redeem it from your <b style={{ color: "var(--text)" }}>Positions</b> — only the winning side can redeem (the chain enforces it).
      </p>
    </div>
  );
}

/* ---------- bet panel ---------- */
function BetPanel({ m, balance, onPlace }) {
  const [side, setSide] = uS("YES");
  const [amt, setAmt] = uS(250);
  const [protect, setProtect] = uS(false);
  const price = side === "YES" ? m.yes : 100 - m.yes; // in cents
  const shares = amt / (price / 100);
  const payout = shares; // $1 per winning share
  const profit = payout - amt;
  const roi = (profit / amt) * 100;
  const liq = parseAbb(m.liquidity);
  const impact = Math.min(9, (amt / liq) * 100 * 0.7);
  const max = Math.max(0, balance); // real spendable OBX balance

  if (m._resolution) return <ResolvedPanel m={m} resolution={m._resolution} />;

  return (
    <div className="bet-panel" style={{ position: "sticky", top: 0, background: "var(--glass)", backdropFilter: "blur(14px)", border: "1px solid var(--hair-2)", borderRadius: "var(--r)", padding: 20, boxShadow: "0 20px 50px rgba(12,12,14,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Place position</span>
        <window.StatusTag kind="private" />
      </div>

      {/* YES / NO toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[["YES", m.yes, "var(--yes)", "var(--yes-dim)"], ["NO", 100 - m.yes, "var(--no)", "var(--no-dim)"]].map(([s, p, c, bg]) => {
          const on = side === s;
          return (
            <button key={s} onClick={() => setSide(s)} style={{ textAlign: "left", padding: "13px 15px", borderRadius: "var(--r-md)", cursor: "pointer", border: `1.5px solid ${on ? c : "var(--hair-2)"}`, background: on ? bg : "var(--surface)", transition: "all 140ms ease" }}>
              <div className="tag" style={{ color: on ? c : "var(--muted)" }}>BUY {s}</div>
              <div className="mono" style={{ fontSize: 23, fontWeight: 500, color: "var(--text)", marginTop: 5 }}>{fmtPctC(p)}</div>
            </button>
          );
        })}
      </div>

      {/* amount */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span className="tag" style={{ color: "var(--muted)" }}>AMOUNT</span>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>Balance {balance.toLocaleString()} OBX</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50, padding: "0 14px", borderRadius: "var(--r-md)", border: "1px solid var(--hair-2)", background: "var(--bg)" }}>
          <window.Icon name="dollar-sign" size={17} color="var(--faint)" />
          <input value={amt} onChange={(e) => setAmt(Math.max(0, Math.min(max, parseInt(e.target.value.replace(/\D/g, "")) || 0)))}
            className="mono" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 22, fontWeight: 500 }} />
          <span className="mono" style={{ fontSize: 13, color: "var(--faint)" }}>OBX</span>
        </div>
      </div>

      {/* slider + quick chips */}
      <input type="range" min="0" max={max} value={amt} onChange={(e) => setAmt(parseInt(e.target.value))}
        style={{ width: "100%", margin: "6px 0 12px", background: `linear-gradient(90deg, var(--accent) ${(amt / max) * 100}%, var(--hair-2) ${(amt / max) * 100}%)`, borderRadius: 4, height: 4 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[100, 250, 500, 1000].map((v) => (
          <button key={v} onClick={() => setAmt(v)} style={{ flex: 1, height: 32, borderRadius: "var(--r-sm)", cursor: "pointer", border: "1px solid var(--hair)", background: amt === v ? "var(--surface-2)" : "transparent", color: amt === v ? "#fff" : "var(--muted)", fontSize: 12.5 }} className="mono">${v}</button>
        ))}
      </div>

      {/* preview */}
      <div style={{ padding: "14px 0", borderTop: "1px solid var(--hair)", display: "flex", flexDirection: "column", gap: 11, marginBottom: 16 }}>
        <Row k="Avg price" v={`${fmtPctC(price)}`} />
        <Row k="Est. shares" v={shares.toFixed(1)} />
        <Row k="Price impact" v={`${impact.toFixed(2)}%`} vc={impact > 4 ? "var(--no)" : "var(--muted)"} />
        <div style={{ height: 1, background: "var(--hair)", margin: "2px 0" }} />
        <Row k="Payout if correct" v={window.fmtUsd(payout)} big />
        <Row k="Profit" v={`${profit >= 0 ? "+" : ""}${window.fmtUsd(profit)} · ${roi >= 0 ? "+" : ""}${roi.toFixed(0)}%`} vc="var(--yes)" />
      </div>

      {/* optional Guardian co-sign on this bet */}
      <button onClick={() => setProtect((p) => !p)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", marginBottom: 12, borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", border: `1px solid ${protect ? "var(--accent)" : "var(--hair-2)"}`, background: protect ? "var(--accent-dim)" : "var(--surface)", transition: "all 140ms ease" }}>
        <window.Icon name="shield-check" size={16} color={protect ? "var(--accent)" : "var(--faint)"} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>Protect with Guardian</span>
          <span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>Require a 2-of-N co-sign before this bet lands</span>
        </span>
        <span role="switch" aria-checked={protect} style={{ position: "relative", width: 38, height: 22, borderRadius: 999, flex: "none", background: protect ? "var(--accent)" : "var(--hair-2)", transition: "background 180ms" }}>
          <span style={{ position: "absolute", top: 3, left: protect ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 180ms", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </span>
      </button>

      <window.Btn variant="primary" size="lg" full icon="lock" onClick={() => onPlace({ market: m, side, amount: amt, price, shares, protect })}>
        {protect ? "Co-sign & place position" : "Place private position"}
      </window.Btn>
      <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "12px 0 0", fontSize: 11.5, color: "var(--faint)", textAlign: "center" }}>
        <window.Icon name="eye-off" size={13} color="var(--faint)" /> {protect ? "Guardian co-signs, then your stake is sealed as a private commitment." : "Recorded as a commitment — no owner, side or size revealed."}
      </p>
    </div>
  );
}
function fmtPctC(p) { return (Math.round(p * 10) / 10).toFixed(0) + "¢"; }
function Row({ k, v, vc, big }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{k}</span>
      <span className="mono" style={{ fontSize: big ? 16 : 13, fontWeight: big ? 600 : 500, color: vc || "var(--text)" }}>{v}</span>
    </div>
  );
}

/* ---------- market detail ---------- */
function MarketDetail({ m: m0, go, onPlace, balance, liveMarkets, addresses }) {
  const m = withLive(m0, liveMarkets);
  const isLive = !!m._live;
  const ls = liveMarkets ? liveMarkets[m0.id] : null; // raw on-chain reserves
  const marketHex = addresses ? addresses[m0.id] : null; // on-chain account id
  const resLabel = m._resolution === 1 ? "YES won" : m._resolution === 2 ? "NO won" : "Unresolved";
  const trades = useReserveTrades(ls);
  const [live, flash] = window.useLiveOdds(m.yes);
  const liveHist = uR(m.history.slice());
  const [, force] = uS(0);
  uE(() => { liveHist.current = [...liveHist.current.slice(1), live]; force((x) => x + 1); }, [live]);
  const up = m.change >= 0;

  return (
    <div className="scroll" style={{ overflowY: "auto", height: "100%" }}>
      <div className="page" style={{ maxWidth: 1160, margin: "0 auto", padding: "22px 28px 64px" }}>
        <button onClick={() => go("markets")} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13.5, marginBottom: 20, padding: 0 }}>
          <window.Icon name="arrow-left" size={16} /> All markets
        </button>

        <div className="grid-detail" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 24, alignItems: "start" }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                <window.Cat name={m.category} />
                <window.StatusTag kind="public" />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} className="tag">
                  <window.Icon name="radio" size={12} color={isLive ? "var(--yes)" : "var(--faint)"} />
                  <span style={{ color: isLive ? "var(--yes)" : "var(--faint)" }}>{isLive ? "LIVE · MIDEN TESTNET" : "PREVIEW"}</span>
                </span>
              </div>
              <h1 style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1.12, margin: 0 }}>{m.question}</h1>
            </div>

            {/* odds card — real on-chain odds for live markets (no fake history) */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: 22 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="tag" style={{ color: "var(--yes)" }}>YES</span>
                    <span className="mono" style={{ fontSize: 40, fontWeight: 500, color: "var(--text)", letterSpacing: "-0.02em" }}>{window.fmtPct(isLive ? m.yes : live)}</span>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: isLive ? "var(--yes)" : "var(--faint)", animation: isLive ? "blink 1.6s infinite" : "none" }} />
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>{isLive ? "live from on-chain reserves" : "preview odds"}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>NO {window.fmtPct(100 - (isLive ? m.yes : live))}</div>
                </div>
              </div>
              <window.OddsBar yes={isLive ? m.yes : live} showLabels={false} height={10} />
              {isLive && ls ? (
                <div className="mono" style={{ fontSize: 11, color: "var(--faint)", marginTop: 13, display: "flex", gap: 16 }}>
                  <span>YES reserve <b style={{ color: "var(--text)" }}>{ls.yes.toLocaleString()}</b></span>
                  <span>NO reserve <b style={{ color: "var(--text)" }}>{ls.no.toLocaleString()}</b></span>
                  <span>OBX</span>
                </div>
              ) : null}
              {/* verifiable on-chain market account — anyone can open it on the explorer */}
              {isLive && marketHex ? (
                <div style={{ marginTop: 13, paddingTop: 13, borderTop: "1px solid var(--hair)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                  <span className="tag" style={{ color: "var(--faint)", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                    <window.Icon name="shield-check" size={12} color="var(--faint)" /> MARKET ACCOUNT
                  </span>
                  <a href={`https://testnet.midenscan.com/account/${marketHex}`} target="_blank" rel="noreferrer" className="mono" title={marketHex}
                    style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, background: "var(--accent-dim)", border: "1px solid rgba(255,85,0,0.22)", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap", flexShrink: 0, maxWidth: "100%" }}>
                    {`${marketHex.slice(0, 10)}…${marketHex.slice(-6)}`} <window.Icon name="chevron-right" size={11} color="var(--accent)" /> verify on-chain
                  </a>
                </div>
              ) : null}
            </div>

            {/* stats — real for live markets */}
            <div className="grid-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {(isLive
                ? [["Volume", m.volume, "activity"], ["Liquidity", m.liquidity, "droplet"], ["Resolution", resLabel, "shield-check"], ["Source", "On-chain", "radio"]]
                : [["Volume", m.volume, "activity"], ["Liquidity", m.liquidity, "droplet"], ["Resolves", m.closes, "clock"], ["Status", "Preview", "clock"]]
              ).map(([k, v, ic]) => (
                <div key={k} style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r-md)", padding: 14 }}>
                  <window.Icon name={ic} size={15} color="var(--faint)" />
                  <div className="mono" style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginTop: 10 }}>{v}</div>
                  <div className="tag" style={{ color: "var(--faint)", marginTop: 3 }}>{k}</div>
                </div>
              ))}
            </div>

            {/* two-up: resolution + live trades */}
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <window.Icon name="shield-check" size={15} color="var(--accent)" />
                    <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Resolution</span>
                  </div>
                  <span className="tag" style={{ color: m._resolution ? (m._resolution === 1 ? "var(--yes)" : "var(--no)") : "var(--faint)", background: m._resolution ? (m._resolution === 1 ? "var(--yes-dim)" : "var(--no-dim)") : "transparent", padding: m._resolution ? "3px 8px" : 0, borderRadius: 999 }}>{resLabel}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>Settled on-chain by the <b style={{ color: "var(--text)" }}>resolver</b>: a designated key writes the outcome into the market account's public <span className="mono">resolution</span> slot. Winners redeem against the market; the contract rejects losing redemptions on-chain.</p>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Live trades</span>
                  <span className="tag" style={{ color: "var(--faint)" }}>ON-CHAIN</span>
                </div>
                <RealTrades trades={trades} isLive={isLive} />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <BetPanel m={{ ...m, yes: live }} balance={balance} onPlace={onPlace} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MarketsHome, MarketDetail, parseAbb });
