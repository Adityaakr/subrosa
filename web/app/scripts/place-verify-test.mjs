// Verify Place private position: connect → open a live market → Place →
// real on-chain tx surfaced (seal + tx pop-up with explorer link).
import { chromium } from "playwright";
const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());
page.on("console", (m) => { const t = m.text(); if (/place|tx|error|seal/i.test(t)) console.log("  [b]", t.slice(0, 160)); });
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Connect wallet", { exact: false }).first().waitFor({ timeout: 90000 });
  await page.getByText("Connect wallet", { exact: false }).first().click();
  await page.getByText("Subrosa Wallet", { exact: false }).first().click({ timeout: 15000 });
  await page.getByRole("button", { name: /^Fund$/i }).first().waitFor({ timeout: 120000 }); // connected
  await page.waitForTimeout(5000);
  await page.getByText("Will ETH close above", { exact: false }).first().click();
  await page.getByRole("button", { name: /Place private position/i }).first().waitFor({ timeout: 30000 });
  console.log("→ clicking Place private position (real on-chain commitment; ~1-2 min)…");
  await page.getByRole("button", { name: /Place private position/i }).first().click();
  // the seal shows; the real tx pop-up appears when it lands
  await page.getByText("position sealed", { exact: false }).first().waitFor({ timeout: 300000 });
  const tx = await page.locator('a[href*="testnet.midenscan.com/tx/"]').first().getAttribute("href").catch(() => null);
  console.log(`→ position sealed pop-up ✓ · tx: ${tx || "(none)"}`);
  const ok = !!tx;
  console.log(ok ? "✓ PLACE WORKS — real on-chain commitment tx" : "✗ no on-chain tx surfaced");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) { console.log("✗ test error:", String(e).slice(0, 300)); await browser.close(); process.exit(2); }
