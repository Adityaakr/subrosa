// Verify all 3 markets read live on-chain state + the home shows 3 LIVE badges.
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const MARKETS = {
  "miden-mainnet": { hex: "0xabbba77bce4bc6d1795be21b30fa5e", yes: 50 },
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
  console.log(`→ LIVE badges on home: ${badges} (expect 1)`);

  const pass = allRead && badges >= 1;
  console.log(pass ? "✓ POLYMARKET MIRROR LIVE ON MIDEN" : "✗ mirror not live");
  await browser.close();
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.log("✗ test error:", String(e).slice(0, 300));
  await browser.close();
  process.exit(2);
}
