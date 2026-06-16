// @ts-nocheck
import React from "react";
/* Subrosa prototype — the privacy-seal moment (centerpiece) */
const { useState: sS, useEffect: sE, useRef: sR } = React;

function Scramble({ target, active, dur = 900 }) {
  const [txt, setTxt] = sS("0x0000…0000");
  sE(() => {
    if (!active) return;
    const hex = "0123456789abcdef";
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const reveal = Math.floor(p * target.length);
      let out = "";
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (ch === "x" || ch === "…" || (ch === "0" && i === 0)) { out += ch; continue; }
        out += i < reveal ? ch : hex[(Math.random() * 16) | 0];
      }
      setTxt(out);
      if (p >= 1) { clearInterval(id); setTxt(target); }
    }, 45);
    return () => clearInterval(id);
  }, [active]);
  return <span>{txt}</span>;
}

// Shows the value → redaction wipe (sealing, dramatizing "hidden from chain") →
// reveals the value again once `revealed` (done): it's YOUR data, only the chain
// never sees it.
function RedactField({ label, value, sealing, revealed }) {
  const hidden = sealing && !revealed;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
      <span className="tag" style={{ color: "var(--faint)" }}>{label}</span>
      <div style={{ position: "relative", height: 24, overflow: "hidden" }}>
        <span className="mono" style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", transition: "opacity 200ms", opacity: hidden ? 0 : 1 }}>{value}</span>
        <span style={{ position: "absolute", inset: 0, background: "var(--accent)", borderRadius: 4, transformOrigin: "left", transform: hidden ? "scaleX(1)" : "scaleX(0)", transition: "transform 480ms cubic-bezier(0.7,0,0.2,1)" }} />
        <span className="mono" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", fontSize: 15, color: "#fff", letterSpacing: 2, opacity: hidden ? 1 : 0, transition: "opacity 200ms 360ms" }}>••••••</span>
      </div>
    </div>
  );
}

function PrivacySeal({ order, publicYes, realTx, onView, onClose }) {
  // phases: review -> sealing -> committing -> done
  const [phase, setPhase] = sS("review");
  const sealing = phase === "sealing" || phase === "committing" || phase === "done";
  sE(() => {
    const t1 = setTimeout(() => setPhase("sealing"), 650);
    const t2 = setTimeout(() => setPhase("committing"), 1650);
    const t3 = setTimeout(() => setPhase("done"), 2750);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  const [oddsTick] = window.useLiveOdds(publicYes, 0.3, 1500);

  const status = { review: "Preparing position…", sealing: "Sealing into your private account…", committing: "Writing commitment to Miden…", done: "Position sealed" }[phase];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16,16,18,0.55)", backdropFilter: "blur(8px)", animation: "fadeIn 0.25s ease both" }}>
      <div style={{ width: 440, background: "var(--glass)", backdropFilter: "blur(20px)", border: "1px solid var(--hair-2)", borderRadius: 20, padding: 28, boxShadow: "0 40px 100px rgba(12,12,14,0.3)", animation: "scaleIn 0.3s cubic-bezier(0.22,1,0.36,1) both", position: "relative", overflow: "hidden" }}>
        {/* close */}
        {phase === "done" ? (
          <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--hair)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
            <window.Icon name="x" size={15} />
          </button>
        ) : null}

        {/* STAGE */}
        <div style={{ position: "relative", height: 188, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
          {/* expanding rings */}
          {sealing ? [0, 1, 2].map((i) => (
            <span key={i} style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", border: "1px solid var(--accent)", animation: `ringExpand 2s ${i * 0.5}s ease-out infinite` }} />
          )) : null}

          {/* shield */}
          <svg width="150" height="170" viewBox="0 0 24 26" style={{ position: "absolute", filter: phase === "done" ? "drop-shadow(0 0 22px rgba(255,85,0,0.5))" : "none", transition: "filter 400ms" }}>
            <path d="M12 2 C 14.5 3.8 17 5 19 5 a1 1 0 0 1 1 1 v7 c0 5 -3.5 7.5 -7.66 8.95 a1 1 0 0 1 -.67 -.01 C 7.5 21.5 4 19 4 14 V6 a1 1 0 0 1 1 -1 c2 0 4.5 -1.2 6.24 -2.72 a1.17 1.17 0 0 1 .76 -.28 Z"
              fill={sealing ? "rgba(255,85,0,0.10)" : "transparent"}
              stroke="var(--accent)" strokeWidth={sealing ? 0.9 : 0.6} strokeLinejoin="round"
              style={{ strokeDasharray: 90, strokeDashoffset: sealing ? 0 : 90, transition: "stroke-dashoffset 900ms ease, fill 600ms ease" }} />
            {phase === "done" ? (
              <path d="M8.5 13 l2.4 2.4 L15.5 11" fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ strokeDasharray: 12, strokeDashoffset: 0, animation: "spinDash 0.4s ease both" }} />
            ) : null}
          </svg>

          {/* lock glyph for committing */}
          {phase === "committing" ? (
            <div style={{ position: "absolute", bottom: 6, display: "flex", alignItems: "center", gap: 7, color: "var(--accent)" }}>
              <window.Icon name="key-round" size={14} color="var(--accent)" />
              <span className="mono" style={{ fontSize: 11.5 }}>STARK proof</span>
            </div>
          ) : null}
        </div>

        {/* status */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {phase !== "done" ? <Spinner /> : <window.Icon name="shield-check" size={18} color="var(--accent)" />}
            <span style={{ fontFamily: "var(--disp)", fontWeight: 500, fontSize: 18, color: "var(--text)" }}>{status}</span>
          </div>
        </div>

        {/* ticket — YOUR position (revealed to you once sealed) */}
        <div style={{ background: "var(--bg)", border: "1px solid var(--hair-2)", borderRadius: "var(--r-md)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="tag" style={{ color: "var(--faint)" }}>YOUR POSITION · VISIBLE ONLY TO YOU</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--accent)" }}><window.Icon name="eye-off" size={12} color="var(--accent)" /> PRIVATE</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <RedactField label="SIDE" value={order.side} sealing={sealing} revealed={phase === "done"} />
            <RedactField label="SIZE" value={`${order.amount} OBX`} sealing={sealing} revealed={phase === "done"} />
            <RedactField label="SHARES" value={order.shares.toFixed(1)} sealing={sealing} revealed={phase === "done"} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--hair)", gap: 10 }}>
            <span className="tag" style={{ color: "var(--faint)", whiteSpace: "nowrap" }}>POSITION COMMITMENT</span>
            {realTx && realTx.noteId ? (
              <span className="mono" title="The on-chain commitment of your private position — reveals nothing about side or size" style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {realTx.noteId.slice(0, 10)}…{realTx.noteId.slice(-6)}
              </span>
            ) : (
              <span className="mono" style={{ fontSize: 12.5, color: sealing ? "var(--accent)" : "var(--faint)" }}>sealing…</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, gap: 10 }}>
            <span className="tag" style={{ color: "var(--faint)", whiteSpace: "nowrap" }}>ON-CHAIN TX · PUBLIC</span>
            {realTx ? (
              <a href={`https://testnet.midenscan.com/tx/${realTx.tx}`} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                {realTx.tx.slice(0, 10)}…{realTx.tx.slice(-6)} <window.Icon name="chevron-right" size={12} color="var(--accent)" />
              </a>
            ) : (
              <span className="mono" style={{ fontSize: 12.5, color: sealing ? "var(--accent)" : "var(--faint)" }}>writing on-chain…</span>
            )}
          </div>
        </div>

        {/* done content */}
        {phase === "done" ? (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "16px 0", padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--accent-dim)", border: "1px solid rgba(255,85,0,0.25)" }}>
              <window.Icon name="shield-check" size={15} color="var(--accent)" style={{ marginTop: 1 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
                <b style={{ color: "var(--text)" }}>Public proof, private position.</b> The transaction above is real and verifiable on the explorer — but it carries <b style={{ color: "var(--text)" }}>only a commitment</b>. Your side, size and identity are never written on-chain.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px 16px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--yes)", animation: "blink 1.6s infinite" }} />
                <span className="tag" style={{ color: "var(--faint)" }}>PUBLIC ODDS</span>
              </span>
              <span className="mono" style={{ fontSize: 13, color: "var(--text)" }}>YES {window.fmtPct(oddsTick)} <span style={{ color: "var(--yes)" }}>▲</span></span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <window.Btn variant="secondary" full onClick={onClose}>Stay here</window.Btn>
              <window.Btn variant="primary" full icon="wallet" onClick={onView}>View position</window.Btn>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--hair-2)" strokeWidth="2.5" />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

Object.assign(window, { PrivacySeal });
