// @ts-nocheck
import React from "react";
/* Subrosa prototype — shared UI (window.*) */
const { useState, useEffect, useRef } = React;

/* ---------- helpers ---------- */
const fmtUsd = (n) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const fmtPct = (n) => (Math.round(n * 10) / 10).toFixed(1) + "%";

/* ---------- status tag motif: PRIVATE / PUBLIC / ORACLE ---------- */
function StatusTag({ kind = "private", style = {} }) {
  const map = {
    private: { c: "var(--accent)", bg: "var(--accent-dim)", t: "PRIVATE", icon: "lock" },
    public: { c: "var(--oracle)", bg: "rgba(6,110,255,0.14)", t: "PUBLIC", icon: "eye" },
    oracle: { c: "var(--oracle)", bg: "rgba(6,110,255,0.14)", t: "ORACLE", icon: "radio" },
    agent: { c: "var(--agent)", bg: "rgba(163,0,214,0.16)", t: "AGENT", icon: "bot" },
    sealed: { c: "var(--accent)", bg: "var(--accent-dim)", t: "SEALED", icon: "shield-check" },
  };
  const m = map[kind] || map.private;
  return (
    <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 21, padding: "0 8px", borderRadius: "var(--r-sm)", color: m.c, background: m.bg, ...style }}>
      <window.Icon name={m.icon} size={11} color={m.c} />{m.t}
    </span>
  );
}

/* ---------- generic pill / chip ---------- */
function Chip({ children, color = "var(--muted)", bg = "transparent", border, style = {} }) {
  return (
    <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 20, padding: "0 8px", borderRadius: 999, color, background: bg, border: border || "none", ...style }}>
      {children}
    </span>
  );
}

/* ---------- button ---------- */
function Btn({ variant = "primary", size = "md", icon, iconRight, full, disabled, onClick, children, style = {} }) {
  const [h, setH] = useState(false);
  const [a, setA] = useState(false);
  const S = { sm: { h: 34, px: 12, fs: 13 }, md: { h: 40, px: 16, fs: 14 }, lg: { h: 50, px: 22, fs: 15.5 } }[size];
  const V = {
    primary: { background: a ? "var(--accent-hover)" : h ? "var(--accent-hover)" : "var(--accent)", color: "#fff", border: "1px solid transparent", boxShadow: h ? "0 6px 22px rgba(255,85,0,0.34)" : "0 1px 0 rgba(255,255,255,0.12) inset" },
    secondary: { background: h ? "var(--surface-2)" : "transparent", color: "var(--text)", border: "1px solid var(--hair-2)" },
    ghost: { background: h ? "var(--surface-2)" : "transparent", color: "var(--muted)", border: "1px solid transparent" },
    yes: { background: h ? "#14a045" : "var(--yes)", color: "#fff", border: "1px solid transparent", boxShadow: h ? "0 6px 22px rgba(22,163,74,0.3)" : "none" },
  }[variant];
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => { setH(false); setA(false); }}
      onMouseDown={() => setA(true)} onMouseUp={() => setA(false)}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: full ? "100%" : "auto", height: S.h, padding: `0 ${S.px}px`, fontSize: S.fs, fontWeight: 600, letterSpacing: "0.005em", borderRadius: "var(--r-md)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "all 140ms cubic-bezier(0.22,1,0.36,1)", transform: a && !disabled ? "translateY(1px)" : "none", whiteSpace: "nowrap", ...V, ...style }}>
      {icon ? <window.Icon name={icon} size={S.fs + 2} /> : null}
      {children}
      {iconRight ? <window.Icon name={iconRight} size={S.fs + 1} /> : null}
    </button>
  );
}

/* ---------- sparkline ---------- */
function Sparkline({ data, color = "var(--accent)", width = 96, height = 30, strokeWidth = 1.6, fill = true }) {
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - ((v - min) / rng) * (height - 4) - 2]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L ${width} ${height} L 0 ${height} Z`;
  const gid = "sg" + Math.round(min * 100) + data.length;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {fill ? <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs> : null}
      {fill ? <path d={area} fill={`url(#${gid})`} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- odds bar (YES green / NO red) ---------- */
function OddsBar({ yes, height = 8, showLabels = true, labelSize = 13 }) {
  const y = Math.max(0, Math.min(100, yes));
  return (
    <div style={{ width: "100%" }}>
      {showLabels ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span className="tag" style={{ color: "var(--yes)" }}>YES</span>
            <span className="mono" style={{ fontSize: labelSize + 3, fontWeight: 500, color: "var(--text)" }}>{fmtPct(y)}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono" style={{ fontSize: labelSize + 3, fontWeight: 500, color: "var(--muted)" }}>{fmtPct(100 - y)}</span>
            <span className="tag" style={{ color: "var(--no)" }}>NO</span>
          </span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 3, height, width: "100%" }}>
        <div style={{ width: `${y}%`, background: "linear-gradient(90deg, #16A34A, #1DBA56)", borderRadius: "999px 4px 4px 999px", transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }} />
        <div style={{ width: `${100 - y}%`, background: "rgba(229,72,77,0.55)", borderRadius: "4px 999px 999px 4px", transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }} />
      </div>
    </div>
  );
}

/* ---------- live odds hook (gentle drift) ---------- */
function useLiveOdds(initial, vol = 0.4, period = 2600) {
  const [v, setV] = useState(initial);
  const [flash, setFlash] = useState(0); // -1 down, +1 up
  useEffect(() => {
    const t = setInterval(() => {
      setV((prev) => {
        const nv = Math.max(5, Math.min(95, prev + (Math.random() - 0.5) * vol * 2));
        setFlash(nv > prev ? 1 : nv < prev ? -1 : 0);
        return Math.round(nv * 10) / 10;
      });
      setTimeout(() => setFlash(0), 700);
    }, period);
    return () => clearInterval(t);
  }, []);
  return [v, flash];
}

/* ---------- category dot ---------- */
function Cat({ name }) {
  const c = window.OBS.CAT_COLOR[name] || "var(--muted)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
      <span className="tag" style={{ color: "var(--faint)" }}>{name}</span>
    </span>
  );
}

/* ---------- sidebar ---------- */
function NavBtn({ it, on, onClick }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", background: on ? "var(--accent-dim)" : h ? "var(--surface-2)" : "transparent", color: on ? "var(--text)" : "var(--muted)", fontSize: 14, fontWeight: on ? 600 : 500, transition: "background 140ms ease, color 140ms ease", textAlign: "left", position: "relative" }}>
      {on ? <span style={{ position: "absolute", left: -16, top: 10, bottom: 10, width: 3, borderRadius: 3, background: "var(--accent)" }} /> : null}
      <window.Icon name={it.icon} size={17} color={on ? "var(--accent)" : "var(--faint)"} />
      {it.label}
      {it.badge ? <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--faint)", background: "var(--surface-2)", borderRadius: 6, padding: "1px 6px" }}>{it.badge}</span> : null}
    </button>
  );
}

function Sidebar({ route, go, positionsCount }) {
  const items = [
    { k: "markets", label: "Markets", icon: "layers" },
    { k: "positions", label: "Positions", icon: "wallet", badge: positionsCount },
    { k: "agents", label: "Agents", icon: "bot" },
  ];
  const active = (k) => route === k || (k === "markets" && route === "detail");
  return (
    <aside style={{ width: 234, flex: "none", borderRight: "1px solid var(--hair)", background: "var(--surface)", display: "flex", flexDirection: "column", padding: "20px 16px", position: "relative", zIndex: 2 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "4px 8px 22px" }}>
        <img className="logo-on-light" src="/logo/subrosa-wordmark-dark.svg" alt="Subrosa" height="24" />
        <img className="logo-on-dark" src="/logo/subrosa-wordmark-light.svg" alt="Subrosa" height="24" />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((it) => <NavBtn key={it.k} it={it} on={active(it.k)} onClick={() => go(it.k)} />)}
      </nav>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: 12, borderRadius: "var(--r-md)", border: "1px solid var(--hair)", background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <window.Icon name="shield-check" size={14} color="var(--accent)" />
            <span className="tag" style={{ color: "var(--text)" }}>PRIVACY ON</span>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: "var(--faint)" }}>Positions held in your private account. Chain sees commitments only.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--yes)", boxShadow: "0 0 8px var(--yes)" }} />
          <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>Miden testnet</span>
        </div>
      </div>
    </aside>
  );
}

/* ---------- theme toggle ---------- */
function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === "dark");
  const flip = () => {
    const n = !dark;
    document.documentElement.dataset.theme = n ? "dark" : "light";
    try { localStorage.setItem("subrosa-theme", n ? "dark" : "light"); } catch (e) {}
    setDark(n);
  };
  return (
    <button onClick={flip} title="Toggle theme" style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--r-md)", border: "1px solid var(--hair)", background: "var(--surface)", cursor: "pointer", color: "var(--muted)", transition: "all 140ms ease" }}>
      <window.Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}

/* ---------- top bar ---------- */
function shortId(s) { return s && s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : (s || ""); }

function TopBar({ left, wallet }) {
  const w = wallet || {};
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", gap: 16, height: 60, padding: "0 28px", borderBottom: "1px solid var(--hair)", background: "var(--glass)", backdropFilter: "blur(14px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>{left}</div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <ThemeToggle />
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair)", background: "var(--surface)", width: 200 }}>
          <window.Icon name="search" size={15} color="var(--faint)" />
          <span style={{ fontSize: 13, color: "var(--faint)" }}>Search markets</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--faint)", border: "1px solid var(--hair-2)", borderRadius: 5, padding: "1px 5px" }}>/</span>
        </div>
        {!w.connected ? (
          <button onClick={() => w.connect && w.connect()} disabled={w.connecting} style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: w.connecting ? "default" : "pointer", opacity: w.connecting ? 0.7 : 1 }}>
            <window.Icon name="wallet" size={15} color="#fff" />
            {w.connecting ? "Connecting…" : "Connect wallet"}
          </button>
        ) : (
          <>
            <div title="Live OBX balance on testnet" style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair)", background: "var(--surface)" }}>
              <window.Icon name="wallet" size={15} color="var(--accent)" />
              <span className="mono" style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{w.balanceLabel ?? "0"}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>OBX</span>
            </div>
            <button onClick={() => w.fund && w.fund()} title="Request test OBX from the faucet" style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              <window.Icon name="plus" size={14} color="var(--accent)" /> Fund
            </button>
            <button onClick={() => w.disconnect && w.disconnect()} title="Disconnect" style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 10px 0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair-2)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg,#FF5500,#A300D6)" }} />
              <span className="mono" style={{ fontSize: 12.5 }}>{shortId(w.walletId)}</span>
              <window.Icon name="chevron-down" size={14} color="var(--faint)" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}

Object.assign(window, { fmtUsd, fmtPct, StatusTag, Chip, Btn, Sparkline, OddsBar, useLiveOdds, Cat, Sidebar, TopBar });
