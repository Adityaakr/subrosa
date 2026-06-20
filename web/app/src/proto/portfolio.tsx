// @ts-nocheck
import React from "react";
import { hasGuardianIdentity, getGuardianMultisigId, exportGuardianIdentity, importGuardianIdentity, resetGuardianIdentity } from "../cosign";
/* Subrosa prototype — Your positions + Agents */
const { useState: pS } = React;

// Persistent Guardian identity: the SAME 2-of-N multisig is reused for every
// co-sign (its keys live in localStorage). This card surfaces that address and
// lets the user back up / restore the cosigner keys — the recovery model
// Guardian uses (your keys authorize the account; the operator only co-signs).
function GuardianIdentityCard() {
  const [tick, setTick] = pS(0);
  const [msg, setMsg] = pS(null);
  const fileRef = React.useRef(null);
  const has = hasGuardianIdentity();
  const id = getGuardianMultisigId();
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };

  const backup = () => {
    try {
      const data = exportGuardianIdentity();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `subrosa-guardian-${String(id || "keys").slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash("Backup downloaded — keep it safe.");
    } catch (e) { flash(String(e?.message || e)); }
  };
  const restore = async (file) => {
    try {
      const txt = await file.text();
      const acct = importGuardianIdentity(txt);
      setTick((t) => t + 1);
      flash(`Restored — multisig ${String(acct).slice(0, 10)}…`);
    } catch (e) { flash(String(e?.message || e)); }
  };
  const forget = () => {
    if (!window.confirm("Forget this Guardian account? Without a backup you can't recover it — your next protected bet creates a new one.")) return;
    resetGuardianIdentity(); setTick((t) => t + 1); flash("Identity cleared.");
  };

  return (
    <div style={{ border: "1px solid var(--hair-2)", borderRadius: "var(--r)", padding: "16px 18px", marginBottom: 24, background: "var(--surface)" }}>
      <div className="grid-2" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="tag" style={{ color: "var(--faint)", marginBottom: 4 }}>YOUR GUARDIAN BETTING ACCOUNT · 2-of-N</div>
          {has ? (
            <span className="mono" title={id} style={{ fontSize: 13, color: "var(--text)" }}>{id && id.length > 18 ? `${id.slice(0, 12)}…${id.slice(-6)}` : (id || "keys saved · account on next bet")}</span>
          ) : (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Created on your first protected bet — agent + you, Guardian-co-signed. Reused & recoverable every time.</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} style={ghostBtn}>Restore…</button>
          {has ? <button onClick={backup} style={ghostBtn}>Back up keys</button> : null}
          {has ? <button onClick={forget} title="Forget this multisig" style={{ ...ghostBtn, color: "var(--no)" }}>Forget</button> : null}
        </div>
      </div>
      {msg ? <div className="mono" style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 10 }}>{msg}</div> : null}
    </div>
  );
}
const ghostBtn = { height: 32, padding: "0 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hair-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" };

function Toggle({ on, onClick, color = "var(--accent)" }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} style={{ position: "relative", width: 38, height: 22, borderRadius: 999, border: "none", cursor: "pointer", background: on ? color : "var(--hair-2)", transition: "background 200ms ease", flex: "none" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 200ms cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
    </button>
  );
}

function SummaryCard({ label, value, sub, glow, valueColor }) {
  return (
    <div style={{ flex: 1, background: "var(--surface)", border: `1px solid ${glow ? "rgba(255,85,0,0.3)" : "var(--hair)"}`, borderRadius: "var(--r)", padding: 18, boxShadow: glow ? "0 0 30px rgba(255,85,0,0.12)" : "none" }}>
      <div className="tag" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 500, color: valueColor || "var(--text)", marginTop: 10, letterSpacing: "-0.01em" }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function PositionRow({ pos, last, resolution, onRedeem }) {
  const m = window.OBS.markets.find((x) => x.id === pos.marketId) || { question: pos.question, category: "Markets" };
  const [revealed, setRevealed] = pS(pos.revealed);
  const win = pos.pnl >= 0;
  const won = resolution && ((resolution === 1 && pos.side === "YES") || (resolution === 2 && pos.side === "NO"));
  return (
    <div className="pos-row" style={{ display: "grid", gridTemplateColumns: "2.3fr 0.7fr 0.8fr 1fr 1fr 1.4fr", gap: 14, alignItems: "center", padding: "16px 20px", borderBottom: last ? "none" : "1px solid var(--hair)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <window.Cat name={m.category} />
          <window.StatusTag kind={revealed ? "public" : "private"} style={{ height: 18 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.question}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 3, flexWrap: "wrap" }}>
          <span className="mono" title="Private position commitment (note id) — on-chain, but reveals nothing about side or size" style={{ fontSize: 11, color: "var(--faint)" }}>
            commit {pos.commitment}
          </span>
          {pos.tx ? (
            <a className="mono" href={`https://testnet.midenscan.com/tx/${pos.tx}`} target="_blank" rel="noreferrer" title="Public transaction that created this position" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>tx ↗</a>
          ) : null}
        </div>
      </div>
      <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 9px", borderRadius: 999, justifySelf: "start", color: pos.side === "YES" ? "var(--yes)" : "var(--no)", background: pos.side === "YES" ? "var(--yes-dim)" : "var(--no-dim)" }}>{pos.side}</span>
      <span className="mono" style={{ fontSize: 13.5, color: "var(--text)" }}>{window.fmtUsd(pos.size)}</span>
      <span className="mono" style={{ fontSize: 13.5, color: "var(--muted)" }}>{pos.avg}¢</span>
      <div>
        <div className="mono" style={{ fontSize: 13.5, color: "var(--text)" }}>{window.fmtUsd(pos.value)}</div>
        <div className="mono" style={{ fontSize: 12, color: win ? "var(--yes)" : "var(--no)", marginTop: 2 }}>{win ? "+" : ""}{pos.pnl}%</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, justifySelf: "end" }}>
        {resolution ? (
          pos.redeemed ? (
            <span className="tag" style={{ color: "var(--yes)", background: "var(--yes-dim)", padding: "4px 10px", borderRadius: 999 }}>Redeemed ✓</span>
          ) : won ? (
            <button onClick={() => onRedeem && onRedeem(pos)} disabled={pos.redeeming} style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 12.5, cursor: pos.redeeming ? "default" : "pointer", opacity: pos.redeeming ? 0.7 : 1 }}>
              <window.Icon name="wallet" size={13} color="#fff" /> {pos.redeeming ? "Redeeming…" : "Redeem"}
            </button>
          ) : (
            <span className="tag" title="Losing side — the contract rejects its redemption" style={{ color: "var(--no)", background: "var(--no-dim)", padding: "4px 10px", borderRadius: 999 }}>Lost</span>
          )
        ) : (
          <>
            <span className="tag" style={{ color: "var(--faint)" }}>{revealed ? "PUBLIC" : "REVEAL"}</span>
            <Toggle on={revealed} onClick={() => setRevealed((r) => !r)} color="var(--oracle)" />
          </>
        )}
      </div>
    </div>
  );
}

function PositionsScreen({ positions, balance, go, live, onRedeem }) {
  const all = positions;
  const bookValue = all.reduce((s, p) => s + p.value, 0);
  const cost = all.reduce((s, p) => s + p.size, 0);
  const pnlUsd = bookValue - cost;
  const pnlPct = cost ? (pnlUsd / cost) * 100 : 0;

  return (
    <div className="scroll" style={{ overflowY: "auto", height: "100%" }}>
      <div className="page" style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 28px 64px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <span className="tag" style={{ color: "var(--accent)" }}>YOUR PRIVATE BOOK</span>
            <h1 style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text)", margin: "10px 0 6px" }}>Positions</h1>
            <p style={{ fontSize: 14.5, color: "var(--muted)", margin: 0 }}>Full detail, visible only to you. The chain holds commitments — flip a position public only if you choose.</p>
          </div>
          <window.Btn variant="secondary" icon="plus" onClick={() => go("markets")}>New position</window.Btn>
        </div>

        <div className="summary-row" style={{ display: "flex", gap: 14, marginBottom: 22 }}>
          <SummaryCard label="Book value" value={window.fmtUsd(bookValue)} glow />
          <SummaryCard label="Unrealized P&L" value={`${pnlUsd >= 0 ? "+" : ""}${window.fmtUsd(pnlUsd)}`} sub={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`} valueColor={pnlUsd >= 0 ? "var(--yes)" : "var(--no)"} />
          <SummaryCard label="Open positions" value={String(all.length)} />
          <SummaryCard label="Visible on-chain" value="0" sub="commitments only" />
        </div>

        <GuardianIdentityCard />

        <div className="pos-table" style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div className="pos-row" style={{ display: "grid", gridTemplateColumns: "2.3fr 0.7fr 0.8fr 1fr 1fr 1.4fr", gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--hair)", background: "var(--bg-2)" }}>
            {["Market", "Side", "Size", "Avg", "Value", "Reveal publicly"].map((h, i) => (
              <span key={i} className="tag" style={{ color: "var(--faint)", justifySelf: i === 5 ? "end" : "start" }}>{h}</span>
            ))}
          </div>
          {all.map((p, i) => <PositionRow key={p.id} pos={p} last={i === all.length - 1} resolution={(live && live[p.marketId] && live[p.marketId].resolution) || 0} onRedeem={onRedeem} />)}
          {all.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--faint)" }}>
              <window.Icon name="wallet" size={26} color="var(--faint)" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14 }}>No positions yet. Place your first private bet.</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Agents ---------- */
function AgentCard({ a, onPropose }) {
  const active = a.status === "active";
  const pct = Math.round((a.deployed / a.cap) * 100);
  const atCap = a.deployed >= a.cap;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: "var(--r-md)", background: "rgba(163,0,214,0.12)", border: "1px solid rgba(163,0,214,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <window.Icon name="bot" size={20} color="var(--agent)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 14.5, color: "var(--text)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.strat}</div>
          </div>
        </div>
        <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 9px", borderRadius: 999, flex: "none", color: active ? "var(--yes)" : "var(--faint)", background: active ? "var(--yes-dim)" : "var(--surface-2)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "var(--yes)" : "var(--faint)", animation: active ? "blink 1.6s infinite" : "none" }} />{active ? "TRADING" : "PAUSED"}
        </span>
      </div>

      {/* strategy hidden */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg)", border: "1px solid var(--hair)" }}>
        <window.Icon name="eye-off" size={14} color="var(--faint)" />
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Strategy &amp; book</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 13, color: "var(--faint)", letterSpacing: 2 }}>••••••</span>
      </div>

      {/* programmable auth: risk cap */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="tag" style={{ color: "var(--faint)" }}>PROGRAMMABLE AUTH</span>
          {a.cosign
            ? <window.Chip color="var(--accent)" border="1px solid rgba(255,85,0,0.3)"><window.Icon name="key-round" size={11} color="var(--accent)" />HUMAN CO-SIGN</window.Chip>
            : <window.Chip color="var(--muted)" border="1px solid var(--hair-2)"><window.Icon name="zap" size={11} color="var(--muted)" />AUTONOMOUS</window.Chip>}
        </div>
        <div style={{ position: "relative", height: 8, borderRadius: 999, background: "var(--hair-2)", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "linear-gradient(90deg,#A300D6,#FF5500)", borderRadius: 999, transition: "width 600ms ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text)" }}>{window.fmtUsd(a.deployed)} deployed</span>
          <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>cap {window.fmtUsd(a.cap)}</span>
        </div>
      </div>

      {/* programmable auth in action: a trade beyond the cap needs a human co-sign */}
      {a.cosign && onPropose ? (
        <button onClick={() => onPropose(a)} title="The agent wants to deploy beyond its cap — raise a 2-of-N Guardian co-sign request for you to approve"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", cursor: "pointer", border: "1px solid rgba(255,85,0,0.3)", background: "var(--accent-dim)", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, transition: "all 140ms ease" }}>
          <window.Icon name="key-round" size={13} color="var(--accent)" />
          {atCap ? "At cap — request above-cap trade" : "Request above-cap trade"}
        </button>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--hair)" }}>
        <span style={{ fontSize: 12.5, color: "var(--faint)" }}><b style={{ color: "var(--text)" }} className="mono">{a.markets}</b> markets · {a.since}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="tag" style={{ color: "var(--faint)" }}>P&L</span>
          <window.Icon name="eye-off" size={13} color="var(--faint)" />
          <span className="mono" style={{ fontSize: 13, color: "var(--faint)", letterSpacing: 1 }}>••••</span>
        </span>
      </div>
    </div>
  );
}

function AgentsScreen({ agents, onPropose } = {}) {
  const A = agents || window.OBS.agents;
  const activeN = A.filter((a) => a.status === "active").length;
  const cap = A.reduce((s, a) => s + a.cap, 0);
  const dep = A.reduce((s, a) => s + a.deployed, 0);
  return (
    <div className="scroll" style={{ overflowY: "auto", height: "100%" }}>
      <div className="page" style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 28px 64px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <span className="tag" style={{ color: "var(--agent)" }}>POLYBASKETS · CONFIDENTIAL AGENT TIER</span>
            <h1 style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text)", margin: "10px 0 6px" }}>Confidential agents</h1>
            <p style={{ fontSize: 14.5, color: "var(--muted)", margin: 0, maxWidth: 600 }}>Autonomous agents trade from private accounts — strategy and book stay hidden, so an edge can't be copied. Risk caps run on Miden's programmable auth.</p>
          </div>
          <window.Btn variant="primary" icon="plus">Deploy agent</window.Btn>
        </div>

        <div className="summary-row" style={{ display: "flex", gap: 14, marginBottom: 22 }}>
          <SummaryCard label="Active agents" value={String(activeN)} sub={`of ${A.length} deployed`} />
          <SummaryCard label="Combined cap" value={window.fmtUsd(cap)} glow />
          <SummaryCard label="Capital deployed" value={window.fmtUsd(dep)} sub={`${Math.round((dep / cap) * 100)}% of cap`} />
          <SummaryCard label="Strategies exposed" value="0" sub="agent edge stays private" />
        </div>

        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {A.map((a) => <AgentCard key={a.id} a={a} onPropose={onPropose} />)}
        </div>
      </div>
    </div>
  );
}

/* ---------- Guardian approvals ---------- */
function ApprovalRow({ ap, onCoSign, onDecline }) {
  const signing = ap.status === "signing";
  const approved = ap.status === "approved";
  const declined = ap.status === "declined";
  const over = Math.round(((ap.requested - ap.cap) / ap.cap) * 100);
  const statusChip = approved
    ? <window.Chip color="var(--yes)" border="1px solid var(--yes)"><window.Icon name="shield-check" size={11} color="var(--yes)" />GUARDIAN VERIFIED · 2-of-N</window.Chip>
    : declined
    ? <window.Chip color="var(--faint)" border="1px solid var(--hair-2)"><window.Icon name="x" size={11} color="var(--faint)" />DECLINED</window.Chip>
    : signing
    ? <window.Chip color="var(--accent)" border="1px solid rgba(255,85,0,0.3)"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "blink 1.2s infinite" }} />CO-SIGNING…</window.Chip>
    : <window.Chip color="var(--accent)" border="1px solid rgba(255,85,0,0.3)"><window.Icon name="key-round" size={11} color="var(--accent)" />AWAITING YOUR CO-SIGN</window.Chip>;
  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${approved ? "var(--yes)" : declined ? "var(--hair)" : "rgba(255,85,0,0.3)"}`, borderRadius: "var(--r)", padding: 18, display: "flex", flexDirection: "column", gap: 14, opacity: declined ? 0.62 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: "var(--r-md)", background: "rgba(163,0,214,0.12)", border: "1px solid rgba(163,0,214,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <window.Icon name="bot" size={18} color="var(--agent)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{ap.agentName}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>wants to deploy <b className="mono" style={{ color: "var(--accent)" }}>{window.fmtUsd(ap.requested)}</b> on <span style={{ color: "var(--text)" }}>{ap.marketName}</span></div>
          </div>
        </div>
        {statusChip}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg)", border: "1px solid var(--hair)", fontSize: 12.5, color: "var(--muted)" }}>
        <window.Icon name="alert-triangle" size={14} color="var(--accent)" />
        <span>Exceeds its programmable-auth cap of <b className="mono" style={{ color: "var(--text)" }}>{window.fmtUsd(ap.cap)}</b> by <b style={{ color: "var(--accent)" }}>{over}%</b> — a human co-sign is required before this capital is authorized.</span>
      </div>

      {signing && ap.step ? (
        <div className="mono" style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "blink 1.2s infinite" }} />{ap.step}
        </div>
      ) : null}

      {approved && ap.multisig ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 13, borderTop: "1px solid var(--hair)" }}>
          <span className="tag" style={{ color: "var(--faint)" }}>MULTISIG ACCOUNT</span>
          <a href={`https://testnet.midenscan.com/account/${ap.multisig}`} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, background: "var(--accent-dim)", border: "1px solid rgba(255,85,0,0.22)", borderRadius: 999, padding: "3px 9px" }}>
            {String(ap.multisig).length > 14 ? `${String(ap.multisig).slice(0, 8)}…${String(ap.multisig).slice(-4)}` : ap.multisig} <window.Icon name="chevron-right" size={11} color="var(--accent)" /> explorer
          </a>
        </div>
      ) : ap.status === "pending" ? (
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <window.Btn variant="primary" full icon="key-round" onClick={() => onCoSign(ap)}>Co-sign (2-of-N)</window.Btn>
          <window.Btn variant="ghost" icon="x" onClick={() => onDecline(ap.id)}>Decline</window.Btn>
        </div>
      ) : null}
    </div>
  );
}

function ApprovalsScreen({ approvals = [], onCoSign, onDecline, go } = {}) {
  const pending = approvals.filter((a) => a.status === "pending" || a.status === "signing");
  const resolved = approvals.filter((a) => a.status === "approved" || a.status === "declined");
  return (
    <div className="scroll" style={{ overflowY: "auto", height: "100%" }}>
      <div className="page" style={{ maxWidth: 920, margin: "0 auto", padding: "30px 28px 64px" }}>
        <span className="tag" style={{ color: "var(--accent)" }}>MIDEN GUARDIAN · OPENZEPPELIN</span>
        <h1 style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text)", margin: "10px 0 6px" }}>Guardian approvals</h1>
        <p style={{ fontSize: 14.5, color: "var(--muted)", margin: "0 0 24px", maxWidth: 620 }}>When an agent wants to act beyond its risk cap, it can't sign alone. The trade waits here for a human co-sign — a real 2-of-N multisig, verified on-chain by the Guardian, before any capital is authorized.</p>

        <GuardianIdentityCard />

        {approvals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--faint)", border: "1px dashed var(--hair-2)", borderRadius: "var(--r)" }}>
            <window.Icon name="shield-check" size={26} color="var(--faint)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14 }}>No co-sign requests. Open <b style={{ color: "var(--muted)", cursor: "pointer" }} onClick={() => go && go("agents")}>Agents</b> and request an above-cap trade to see the flow.</div>
          </div>
        ) : null}

        {pending.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: resolved.length ? 28 : 0 }}>
            {pending.map((ap) => <ApprovalRow key={ap.id} ap={ap} onCoSign={onCoSign} onDecline={onDecline} />)}
          </div>
        ) : null}

        {resolved.length ? (
          <>
            <div className="tag" style={{ color: "var(--faint)", marginBottom: 12 }}>HISTORY</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {resolved.map((ap) => <ApprovalRow key={ap.id} ap={ap} onCoSign={onCoSign} onDecline={onDecline} />)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, { PositionsScreen, AgentsScreen, ApprovalsScreen });
