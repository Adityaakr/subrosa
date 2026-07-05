// Verify the Polymarket mirror end to end through creation of its public Miden
// execution note. The market operator consumes that note in a separate step.
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
  console.log("→ funding a fresh built-in wallet…");
  await page.getByRole("button", { name: /^Fund$/i }).first().click();
  await page.getByText("Funded ✓", { exact: true }).waitFor({ timeout: 300000 });
  await page.getByText("Will Morocco win", { exact: false }).first().click();
  await page.getByRole("button", { name: /Queue Miden position/i }).waitFor({ timeout: 30000 });
  console.log("→ queueing a real 100 OBX execution note…");
  await page.getByRole("button", { name: /^\$100$/ }).click();
  await page.getByRole("button", { name: /Queue Miden position/i }).click();
  await page.getByText("Position queued", { exact: true }).waitFor({ timeout: 300000 });
  const tx = await page.locator('a[href*="testnet.midenscan.com/tx/"]').first().getAttribute("href").catch(() => null);
  console.log(`→ execution note queued ✓ · tx: ${tx || "(none)"}`);
  const ok = !!tx;
  console.log(ok ? "✓ PLACE WORKS — real Miden execution note tx" : "✗ no on-chain tx surfaced");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) { console.log("✗ test error:", String(e).slice(0, 300)); await browser.close(); process.exit(2); }
