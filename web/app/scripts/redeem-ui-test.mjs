// Verify the dapp redemption flow: on the resolved Fed market, the winning YES
// position shows Redeem → real on-chain tx → "Redeemed ✓" pop-up; the losing NO
// position shows "Lost".
import { chromium } from "playwright";
const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());
page.on("console", (m) => { const t = m.text(); if (/redeem|resolved|error/i.test(t)) console.log("  [browser]", t.slice(0, 160)); });
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__subrosaReadMarket === "function", { timeout: 90000 });
  // useLiveMarkets reads 3 markets sequentially (network) → give the live state
  // time to populate fed's resolution before going to Positions.
  await page.waitForTimeout(7000); // let live resolution populate
  await page.getByRole("button", { name: /Positions/ }).first().click();
  console.log("→ on Positions; waiting for the Redeem button (≤90s)…");
  const redeemBtn = page.getByRole("button", { name: /^Redeem$/ }).first();
  await redeemBtn.waitFor({ timeout: 90000 });
  const lostShown = await page.getByText("Lost", { exact: true }).count();
  console.log(`→ Redeem button present ✓ · Lost badge present: ${lostShown > 0}`);
  console.log("→ clicking Redeem (real on-chain redeem; ~30-90s)…");
  await redeemBtn.click();
  await page.getByText("Redeemed ✓", { exact: false }).first().waitFor({ timeout: 300000 });
  const tx = await page.locator('a[href*="testnet.midenscan.com/tx/"]').first().getAttribute("href").catch(() => null);
  console.log(`→ Redeemed pop-up shown ✓ · tx: ${tx || "(none)"}`);
  const ok = lostShown > 0 && !!tx;
  console.log(ok ? "✓ REDEMPTION UI OK (winner redeems on-chain, loser shows Lost)" : "✗ redemption incomplete");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) { console.log("✗ test error:", String(e).slice(0, 300)); await browser.close(); process.exit(2); }
