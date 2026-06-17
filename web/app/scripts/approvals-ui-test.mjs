import { chromium } from "playwright";
const URL = process.env.URL || "http://localhost:5173/app/";
const b = await chromium.launch({ args: ["--enable-features=SharedArrayBuffer","--enable-blink-features=WebAssemblyThreads"] });
const p = await b.newPage();
p.on("console", (m) => { const t = m.text(); if (/error|Error|fail/i.test(t)) console.log("  [page]", t.slice(0,160)); });
try {
  await p.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(2500);
  // 1) Approvals nav exists + empty state
  await p.getByText("Approvals", { exact: true }).first().click();
  await p.waitForTimeout(600);
  const empty = await p.getByText(/No co-sign requests/i).count();
  console.log("approvals nav + empty state:", empty > 0 ? "OK" : "MISSING");
  // 2) Go to Agents, find the request button
  await p.getByText("Agents", { exact: true }).first().click();
  await p.waitForTimeout(600);
  const reqBtn = p.getByText(/Request above-cap trade/i).first();
  const hasBtn = await reqBtn.count();
  console.log("agent request-above-cap button:", hasBtn > 0 ? "OK" : "MISSING");
  // 3) Click it -> should route to Approvals with a pending card
  await reqBtn.click();
  await p.waitForTimeout(900);
  const wants = await p.getByText(/wants to deploy/i).count();
  const cosignBtn = await p.getByRole("button", { name: /Co-sign \(2-of-N\)/i }).count();
  const declineBtn = await p.getByRole("button", { name: /Decline/i }).count();
  const awaiting = await p.getByText(/AWAITING YOUR CO-SIGN/i).count();
  console.log("pending card rendered:", wants > 0 ? "OK" : "MISSING");
  console.log("co-sign button:", cosignBtn > 0 ? "OK" : "MISSING");
  console.log("decline button:", declineBtn > 0 ? "OK" : "MISSING");
  console.log("awaiting chip:", awaiting > 0 ? "OK" : "MISSING");
  // 4) Decline path
  await p.getByRole("button", { name: /Decline/i }).first().click();
  await p.waitForTimeout(600);
  const declined = await p.getByText(/DECLINED/i).count();
  console.log("decline -> DECLINED chip:", declined > 0 ? "OK" : "MISSING");
  const allOk = empty>0 && hasBtn>0 && wants>0 && cosignBtn>0 && declineBtn>0 && awaiting>0 && declined>0;
  console.log(allOk ? "\n✓ APPROVALS UI FLOW WORKS" : "\n✗ SOME CHECKS FAILED");
} catch (e) { console.log("TEST ERROR:", e.message); }
finally { await b.close(); }
