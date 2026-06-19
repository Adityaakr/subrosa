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
  const soon = !!it.soon;
  return (
    <button onClick={soon ? undefined : onClick} disabled={soon} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={soon ? "Coming soon" : undefined}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: "var(--r-md)", border: "none", cursor: soon ? "default" : "pointer", background: on ? "var(--accent-dim)" : (h && !soon) ? "var(--surface-2)" : "transparent", color: on ? "var(--text)" : "var(--muted)", fontSize: 14, fontWeight: on ? 600 : 500, transition: "background 140ms ease, color 140ms ease", textAlign: "left", position: "relative", opacity: soon ? 0.5 : 1 }}>
      {on ? <span style={{ position: "absolute", left: -16, top: 10, bottom: 10, width: 3, borderRadius: 3, background: "var(--accent)" }} /> : null}
      <window.Icon name={it.icon} size={17} color={on ? "var(--accent)" : "var(--faint)"} />
      {it.label}
      {soon ? <span className="tag" style={{ marginLeft: "auto", fontSize: 9.5, letterSpacing: "0.04em", color: "var(--faint)", background: "var(--surface-2)", borderRadius: 6, padding: "2px 6px" }}>SOON</span>
        : it.badge ? <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--faint)", background: "var(--surface-2)", borderRadius: 6, padding: "1px 6px" }}>{it.badge}</span> : null}
    </button>
  );
}

function Sidebar({ route, go, positionsCount, approvalsCount }) {
  const items = [
    { k: "markets", label: "Markets", icon: "layers" },
    { k: "positions", label: "Positions", icon: "wallet", badge: positionsCount },
    { k: "agents", label: "Agents", icon: "bot", soon: true },
    { k: "approvals", label: "Approvals", icon: "shield-check", badge: approvalsCount, soon: true },
  ];
  const active = (k) => route === k || (k === "markets" && route === "detail");
  return (
    <aside className="sidebar" style={{ width: 234, flex: "none", borderRight: "1px solid var(--hair)", background: "var(--surface)", display: "flex", flexDirection: "column", padding: "20px 16px", position: "relative", zIndex: 2 }}>
      <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", padding: "4px 8px 22px" }}>
        <img className="logo-on-light" src="/logo/subrosa-wordmark-dark.svg" alt="Subrosa" height="24" />
        <img className="logo-on-dark" src="/logo/subrosa-wordmark-light.svg" alt="Subrosa" height="24" />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((it) => <NavBtn key={it.k} it={it} on={active(it.k)} onClick={() => go(it.k)} />)}
      </nav>
      <div className="sidebar-foot" style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
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

// Connected-wallet pill + dropdown: full address, copy, view on Midenscan,
// disconnect. Disconnect is a SOFT toggle for the built-in wallet — the same
// account returns on reconnect (it is never regenerated).
function WalletMenu({ w }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const addr = w.walletId || "";
  const isMf = w.kind === "midenfi";
  const explorer = `${EXPLORER}/account/${addr}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(addr); } catch (e) { try { const t = document.createElement("textarea"); t.value = addr; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); } catch (e2) {} }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  const item = { display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text)", fontSize: 13, textDecoration: "none" };
  const hov = (e, on) => (e.currentTarget.style.background = on ? "var(--bg-2)" : "transparent");
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title="Wallet options"
        style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 10px 0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair-2)", background: open ? "var(--bg-2)" : "var(--surface-2)", color: "var(--text)", cursor: "pointer" }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", background: isMf ? "#0C0C0E" : "linear-gradient(135deg,#FF5500,#A300D6)", fontFamily: "var(--disp)", fontWeight: 700, color: "var(--accent)", fontSize: 11 }}>{isMf ? "m" : ""}</span>
        <span className="mono" style={{ fontSize: 12.5 }}>{shortId(addr)}</span>
        <window.Icon name="chevron-down" size={14} color="var(--faint)" />
      </button>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: 44, right: 0, width: 312, zIndex: 41, background: "var(--surface)", border: "1px solid var(--hair-2)", borderRadius: "var(--r-md)", boxShadow: "0 20px 50px rgba(12,12,14,0.22)", padding: 8, animation: "fadeUp 0.18s ease both" }}>
            <div className="tag" style={{ color: "var(--faint)", padding: "8px 10px 6px" }}>{isMf ? "MIDEN WALLET" : "SUBROSA WALLET"}</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--text)", padding: "0 10px 10px", wordBreak: "break-all", lineHeight: 1.5 }}>{addr}</div>
            <button onClick={copy} style={item} onMouseEnter={(e) => hov(e, true)} onMouseLeave={(e) => hov(e, false)}>
              <window.Icon name={copied ? "check" : "copy"} size={15} color={copied ? "var(--yes)" : "var(--faint)"} />
              {copied ? "Copied ✓" : "Copy address"}
            </button>
            <a href={explorer} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} style={item} onMouseEnter={(e) => hov(e, true)} onMouseLeave={(e) => hov(e, false)}>
              <window.Icon name="external-link" size={15} color="var(--faint)" />
              View on Midenscan
            </a>
            <div style={{ height: 1, background: "var(--hair)", margin: "6px 4px" }} />
            <button onClick={() => { setOpen(false); w.disconnect && w.disconnect(); }} style={{ ...item, color: "var(--no)" }} onMouseEnter={(e) => hov(e, true)} onMouseLeave={(e) => hov(e, false)}>
              <window.Icon name="x" size={15} color="var(--no)" />
              Disconnect
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function WalletChooser({ w, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div style={{ position: "absolute", top: 44, right: 0, width: 280, zIndex: 41, background: "var(--surface)", border: "1px solid var(--hair-2)", borderRadius: "var(--r-md)", boxShadow: "0 20px 50px rgba(12,12,14,0.22)", padding: 8, animation: "fadeUp 0.18s ease both" }}>
        <div className="tag" style={{ color: "var(--faint)", padding: "8px 10px 6px" }}>Connect a wallet</div>
        <button onClick={() => { onClose(); w.connectBuiltin && w.connectBuiltin(); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "10px 10px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><window.Icon name="wallet" size={16} color="#fff" /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Subrosa Wallet</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>Built-in · no extension needed</span>
          </span>
        </button>
        <button onClick={() => { onClose(); w.connectMidenFi && w.connectMidenFi(); }} disabled={!w.midenfiAvailable} title={w.midenfiAvailable ? "" : "Miden Wallet extension not detected"} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "10px 10px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: w.midenfiAvailable ? "pointer" : "not-allowed", opacity: w.midenfiAvailable ? 1 : 0.5, color: "var(--text)" }} onMouseEnter={(e) => { if (w.midenfiAvailable) e.currentTarget.style.background = "var(--bg-2)"; }} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "#0C0C0E", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: "var(--disp)", fontWeight: 700, color: "var(--accent)", fontSize: 17 }}>m</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Miden Wallet</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>{w.midenfiAvailable ? "Browser extension" : "Not detected"}</span>
          </span>
        </button>
      </div>
    </>
  );
}

function TopBar({ left, wallet }) {
  const w = wallet || {};
  const [chooserOpen, setChooserOpen] = React.useState(false);
  return (
    <header className="topbar" style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", gap: 16, height: 60, padding: "0 28px", borderBottom: "1px solid var(--hair)", background: "var(--glass)", backdropFilter: "blur(14px)" }}>
      <div className="topbar-left" style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>{left}</div>
      <div className="topbar-right" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <ThemeToggle />
        <div className="topbar-search" style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair)", background: "var(--surface)", width: 200 }}>
          <window.Icon name="search" size={15} color="var(--faint)" />
          <span style={{ fontSize: 13, color: "var(--faint)" }}>Search markets</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--faint)", border: "1px solid var(--hair-2)", borderRadius: 5, padding: "1px 5px" }}>/</span>
        </div>
        {!w.connected ? (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
            {w.error ? <span className="mono" title={w.error} style={{ fontSize: 11, color: "var(--no)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.error}</span> : null}
            <button onClick={() => !w.connecting && setChooserOpen((o) => !o)} disabled={w.connecting} style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 16px", borderRadius: "var(--r-md)", border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: w.connecting ? "default" : "pointer", opacity: w.connecting ? 0.7 : 1 }}>
              <window.Icon name="wallet" size={15} color="#fff" />
              {w.connecting ? "Connecting…" : "Connect wallet"}
            </button>
            {chooserOpen ? <WalletChooser w={w} onClose={() => setChooserOpen(false)} /> : null}
          </div>
        ) : (
          <>
            <div title="Live OBX balance on testnet" style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair)", background: "var(--surface)" }}>
              <window.Icon name="wallet" size={15} color="var(--accent)" />
              <span className="mono" style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{w.balanceLabel ?? "0"}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>OBX</span>
            </div>
            {w.fundMsg ? <span className="mono" style={{ fontSize: 11, color: "var(--faint)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.fundMsg}</span> : null}
            <button className="fund-btn" onClick={() => w.fund && w.fund()} disabled={w.funding} title="Mint test OBX to this wallet" style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, fontWeight: 500, cursor: w.funding ? "default" : "pointer", opacity: w.funding ? 0.7 : 1 }}>
              <window.Icon name="plus" size={14} color="var(--accent)" /><span className="fund-label">{w.funding ? "Funding…" : "Fund"}</span>
            </button>
            <WalletMenu w={w} />
          </>
        )}
      </div>
    </header>
  );
}

/* ---------- transaction pop-up (toast) ---------- */
// Any flow fires window.txToast({ kind, title, desc, tx, account }) when a tx
// is signed/lands; ToastHost renders a clear card with what it did + a clickable
// hash to the explorer.
const EXPLORER = "https://testnet.midenscan.com";
const shortTx = (s) => (s && s.length > 16 ? `${s.slice(0, 10)}…${s.slice(-6)}` : (s || ""));

function txToast(detail) {
  try { window.dispatchEvent(new CustomEvent("subrosa:tx", { detail: detail || {} })); } catch (e) {}
}

function TxCard({ t, onClose }) {
  const ic = t.kind === "fund" ? "wallet" : t.kind === "cosign" ? "shield-check" : t.kind === "error" ? "x" : "shield-check";
  const accent = t.kind === "error" ? "var(--no)" : "var(--accent)";
  return (
    <div style={{ width: 360, background: "var(--glass)", backdropFilter: "blur(18px)", border: "1px solid var(--hair-2)", borderRadius: "var(--r-md)", boxShadow: "0 24px 60px rgba(12,12,14,0.28)", padding: 16, animation: "fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both", position: "relative", overflow: "hidden" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", color: "var(--faint)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <window.Icon name="x" size={14} />
      </button>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: t.kind === "error" ? "var(--no-dim)" : "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <window.Icon name={ic} size={18} color={accent} />
        </span>
        <div style={{ minWidth: 0, paddingRight: 14 }}>
          <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 14.5, color: "var(--text)" }}>{t.title}</div>
          {t.desc ? <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)", marginTop: 3 }}>{t.desc}</div> : null}
          {t.tx ? (
            <a className="mono" href={`${EXPLORER}/tx/${t.tx}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 9, fontSize: 11.5, color: "var(--accent)", textDecoration: "none", background: "var(--accent-dim)", border: "1px solid rgba(255,85,0,0.22)", borderRadius: 999, padding: "3px 9px" }}>
              tx {shortTx(t.tx)} <window.Icon name="chevron-right" size={12} color="var(--accent)" /> explorer
            </a>
          ) : null}
          {t.account ? (
            <a className="mono" href={`${EXPLORER}/account/${t.account}`} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--faint)", textDecoration: "none" }}>
              account {shortTx(t.account)} ↗
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const onTx = (e) => {
      const t = { id: Math.random().toString(36).slice(2), kind: "tx", ...(e.detail || {}) };
      setToasts((ts) => [...ts.slice(-3), t]);
      const ms = t.duration ?? (t.kind === "error" ? 9000 : 11000);
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), ms);
    };
    window.addEventListener("subrosa:tx", onTx);
    return () => window.removeEventListener("subrosa:tx", onTx);
  }, []);
  const close = (id) => setToasts((ts) => ts.filter((x) => x.id !== id));
  return (
    <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 200, display: "flex", flexDirection: "column", gap: 12 }}>
      {toasts.map((t) => <TxCard key={t.id} t={t} onClose={() => close(t.id)} />)}
    </div>
  );
}

/* ---------- Guardian co-sign progress (the ~1–2 min flow) ---------- */
const COSIGN_STEPS = [
  { label: "Connecting to Guardian", desc: "Reaching your self-hosted Guardian server.", m: /connect/i },
  { label: "Preparing your 2-of-N multisig", desc: "Your durable Guardian multisig — agent + you, reused each time.", m: /creat|load|multisig/i },
  { label: "Collecting signatures", desc: "Agent signs, then your signature (2-of-N).", m: /collect|signatur/i },
  { label: "Executing on-chain", desc: "Proving + submitting the co-signed transaction to Miden.", m: /execut|on-chain/i },
];

function Elapsed({ since }) {
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
  return <>{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</>;
}

// step = the live onStep string from guardianCoSign (null = hidden).
function CoSignModal({ step }) {
  const startRef = useRef(0);
  if (step && !startRef.current) startRef.current = Date.now();
  if (!step) { startRef.current = 0; return null; }
  const active = Math.max(0, COSIGN_STEPS.findIndex((x) => x.m.test(step)));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16,16,18,0.55)", backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease both", padding: 18 }}>
      <div style={{ width: "min(420px, 94vw)", background: "var(--glass)", backdropFilter: "blur(20px)", border: "1px solid var(--hair-2)", borderRadius: 20, padding: 24, boxShadow: "0 40px 100px rgba(12,12,14,0.3)", animation: "scaleIn 0.28s cubic-bezier(0.22,1,0.36,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <window.Icon name="shield-check" size={17} color="var(--accent)" />
            </span>
            <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Guardian co-sign · 2-of-N</span>
          </span>
          <span className="mono" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}><Elapsed since={startRef.current} /></span>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>Your 2-of-N multisig is being co-signed on Miden — this is genuine on-chain work, so it takes about <b style={{ color: "var(--text)" }}>1–2 minutes</b>.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {COSIGN_STEPS.map((s, i) => {
            const done = i < active, now = i === active;
            return (
              <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", opacity: done || now ? 1 : 0.45 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "none", marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--yes)" : now ? "var(--accent)" : "var(--surface-2)", border: now ? "none" : done ? "none" : "1px solid var(--hair-2)" }}>
                  {done ? <window.Icon name="check" size={12} color="#fff" />
                    : now ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "blink 1.1s infinite" }} />
                    : <span className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>{i + 1}</span>}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: now ? 600 : 500, color: done || now ? "var(--text)" : "var(--faint)" }}>{s.label}{now ? "…" : ""}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--faint)", marginTop: 1 }}>{s.desc}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid var(--hair)", display: "flex", alignItems: "center", gap: 7 }}>
          <window.Icon name="key-round" size={13} color="var(--faint)" />
          <span style={{ fontSize: 11.5, color: "var(--faint)" }}>Keep this tab open — closing it cancels the co-sign.</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { fmtUsd, fmtPct, StatusTag, Chip, Btn, Sparkline, OddsBar, useLiveOdds, Cat, Sidebar, TopBar, ToastHost, txToast, CoSignModal });
