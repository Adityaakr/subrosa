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
        {m._live ? <LiveBadge /> : (
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
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 28px 64px" }}>
        {/* hero band */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 26 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
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
          <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>•••• USDC</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--faint)" }}>{r.t}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- bet panel ---------- */
function BetPanel({ m, balance, onPlace }) {
  const [side, setSide] = uS("YES");
  const [amt, setAmt] = uS(250);
  const price = side === "YES" ? m.yes : 100 - m.yes; // in cents
  const shares = amt / (price / 100);
  const payout = shares; // $1 per winning share
  const profit = payout - amt;
  const roi = (profit / amt) * 100;
  const liq = parseAbb(m.liquidity);
  const impact = Math.min(9, (amt / liq) * 100 * 0.7);
  const max = Math.min(2000, balance);

  return (
    <div style={{ position: "sticky", top: 0, background: "var(--glass)", backdropFilter: "blur(14px)", border: "1px solid var(--hair-2)", borderRadius: "var(--r)", padding: 20, boxShadow: "0 20px 50px rgba(12,12,14,0.12)" }}>
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
          <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>Balance {window.fmtUsd(balance)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50, padding: "0 14px", borderRadius: "var(--r-md)", border: "1px solid var(--hair-2)", background: "var(--bg)" }}>
          <window.Icon name="dollar-sign" size={17} color="var(--faint)" />
          <input value={amt} onChange={(e) => setAmt(Math.max(0, Math.min(max, parseInt(e.target.value.replace(/\D/g, "")) || 0)))}
            className="mono" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 22, fontWeight: 500 }} />
          <span className="mono" style={{ fontSize: 13, color: "var(--faint)" }}>USDC</span>
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

      <window.Btn variant="primary" size="lg" full icon="lock" onClick={() => onPlace({ market: m, side, amount: amt, price, shares })}>
        Place private position
      </window.Btn>
      <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "12px 0 0", fontSize: 11.5, color: "var(--faint)", textAlign: "center" }}>
        <window.Icon name="eye-off" size={13} color="var(--faint)" /> Recorded as a commitment — no owner, side or size revealed.
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
function MarketDetail({ m: m0, go, onPlace, balance, liveMarkets }) {
  const m = withLive(m0, liveMarkets);
  const [live, flash] = window.useLiveOdds(m.yes);
  const liveHist = uR(m.history.slice());
  const [, force] = uS(0);
  uE(() => { liveHist.current = [...liveHist.current.slice(1), live]; force((x) => x + 1); }, [live]);
  const up = m.change >= 0;

  return (
    <div className="scroll" style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "22px 28px 64px" }}>
        <button onClick={() => go("markets")} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13.5, marginBottom: 20, padding: 0 }}>
          <window.Icon name="arrow-left" size={16} /> All markets
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 24, alignItems: "start" }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                <window.Cat name={m.category} />
                <window.StatusTag kind="public" />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} className="tag">
                  <window.Icon name="radio" size={12} color="var(--oracle)" /><span style={{ color: "var(--oracle)" }}>{m.oracle.toUpperCase()}</span>
                </span>
              </div>
              <h1 style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1.12, margin: 0 }}>{m.question}</h1>
            </div>

            {/* odds card */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: 22 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="tag" style={{ color: "var(--yes)" }}>YES</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span className="mono" style={{ fontSize: 40, fontWeight: 500, color: "var(--text)", letterSpacing: "-0.02em", transition: "color 200ms", textShadow: flash ? `0 0 18px ${flash > 0 ? "var(--yes)" : "var(--no)"}` : "none" }}>{window.fmtPct(live)}</span>
                      <window.Icon name={flash >= 0 ? "trending-up" : "trending-down"} size={18} color={flash > 0 ? "var(--yes)" : flash < 0 ? "var(--no)" : "var(--faint)"} />
                    </span>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--yes)", animation: "blink 1.6s infinite" }} />
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>updates live</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 13, color: up ? "var(--yes)" : "var(--no)" }}>{up ? "+" : ""}{m.change}% 24h</div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>NO {window.fmtPct(100 - live)}</div>
                </div>
              </div>
              <OddsChart data={liveHist.current} color="var(--yes)" />
              <div style={{ marginTop: 14 }}><window.OddsBar yes={live} showLabels={false} height={8} /></div>
            </div>

            {/* stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[["Volume", m.volume, "activity"], ["Liquidity", m.liquidity, "droplet"], ["Resolves", m.closes, "clock"], ["Traders", m.traders.toLocaleString(), "fingerprint"]].map(([k, v, ic]) => (
                <div key={k} style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r-md)", padding: 14 }}>
                  <window.Icon name={ic} size={15} color="var(--faint)" />
                  <div className="mono" style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginTop: 10 }}>{v}</div>
                  <div className="tag" style={{ color: "var(--faint)", marginTop: 3 }}>{k}</div>
                </div>
              ))}
            </div>

            {/* two-up: resolution + activity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <window.Icon name="radio" size={15} color="var(--oracle)" />
                  <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Resolution</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>Settled by <b style={{ color: "var(--text)" }}>{m.oracle}</b> oracle on resolution date. Winners redeem privately against the market account.</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hair)" }}>
                  <window.Icon name="droplet" size={14} color="var(--accent)" />
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Liquidity backstopped by <b style={{ color: "var(--text)" }}>Cusp</b> LPs.</span>
                </div>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Live trades</span>
                  <span className="tag" style={{ color: "var(--faint)" }}>ANONYMIZED</span>
                </div>
                <ActivityFeed />
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
