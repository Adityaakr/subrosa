// Verify all 3 markets read live on-chain state + the home shows 3 LIVE badges.
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const MARKETS = {
  "miden-mainnet": { hex: "0x5ff0303f0b795d1039ca5b51d8480b", yes: 42.3 },
  "eth-4k": { hex: "0x612f7f710da01a10116a1ca76afac5", yes: 63 },
  "fed-sep": { hex: "0x60de1a3b8cf5cb10384598e50506cf", yes: 45 },
};

const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());

try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__subrosaReadMarket === "function", { timeout: 90000 });

  let allRead = true;
  for (const [id, { hex, yes }] of Object.entries(MARKETS)) {
    let s = null;
    for (let i = 0; i < 10 && !(s && s.yesPct); i++) {
      try { s = await page.evaluate((h) => window.__subrosaReadMarket(h), hex); } catch (e) {}
      if (!(s && (s.yes || s.no))) await page.waitForTimeout(2500);
    }
    const ok = s && Math.abs(s.yesPct - yes) < 1.5;
    console.log(`  ${id}: yesPct=${s?.yesPct} (expect ~${yes}) liq=${s?.liquidity} vol=${s?.volume} ${ok ? "✓" : "✗"}`);
    if (!ok) allRead = false;
  }

  await page.waitForTimeout(3000); // let useLiveMarkets populate the grid
  const badges = await page.getByText("Live", { exact: true }).count();
  console.log(`→ LIVE badges on home: ${badges} (expect 3)`);

  const pass = allRead && badges >= 3;
  console.log(pass ? "✓ ALL 3 MARKETS LIVE" : "✗ not all live");
  await browser.close();
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.log("✗ test error:", String(e).slice(0, 300));
  await browser.close();
  process.exit(2);
}
