// Headless check that the web client reads the live market's REAL on-chain
// state. Cross-checks against the CLI baseline (yes=1500, no=1100, vol=600).
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const EXPECT = { yes: 1500, no: 1100, volume: 600 }; // from `miden-client account -s`

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"],
});
const page = await browser.newContext().then((c) => c.newPage());
page.on("console", (m) => { const t = m.text(); if (/market|error|fail/i.test(t)) console.log("  [browser]", t.slice(0, 200)); });

try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  console.log("→ waiting for client ready (window.__subrosaReadMarket)…");
  await page.waitForFunction(() => typeof window.__subrosaReadMarket === "function", { timeout: 90000 });

  let state = null;
  for (let i = 0; i < 20; i++) {
    try { state = await page.evaluate(() => window.__subrosaReadMarket()); } catch (e) { state = { error: String(e).slice(0, 120) }; }
    if (state && !state.error && (state.yes || state.no)) break;
    await page.waitForTimeout(3000);
  }
  console.log("→ read market state:", JSON.stringify(state));

  const ok = state && state.yes === EXPECT.yes && state.no === EXPECT.no && state.volume === EXPECT.volume;
  console.log(`→ expected yes=${EXPECT.yes} no=${EXPECT.no} vol=${EXPECT.volume}`);
  console.log(ok ? `✓ LIVE READ MATCHES — YES ${state.yesPct}% · liq ${state.liquidity} · vol ${state.volume}` : "✗ mismatch / not read");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log("✗ test error:", String(e).slice(0, 300));
  await browser.close();
  process.exit(2);
}
