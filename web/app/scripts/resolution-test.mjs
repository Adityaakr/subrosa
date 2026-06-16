// Verify the dapp reflects the on-chain resolution: Fed market reads
// resolution=1 and its detail shows "Market resolved / YES WON" (betting locked).
import { chromium } from "playwright";
const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const FED = "0x60de1a3b8cf5cb10384598e50506cf";
const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__subrosaReadMarket === "function", { timeout: 90000 });
  // confirm on-chain read
  let s = null;
  for (let i = 0; i < 10 && !(s && s.resolution); i++) { try { s = await page.evaluate((h) => window.__subrosaReadMarket(h), FED); } catch {} if (!(s && s.resolution)) await page.waitForTimeout(2500); }
  console.log("→ Fed on-chain resolution:", s && s.resolution, "(1 = YES)");
  // wait for grid to pick up live state, open the Fed market
  await page.getByText("Will the Fed cut rates", { exact: false }).first().waitFor({ timeout: 60000 });
  await page.getByText("Will the Fed cut rates", { exact: false }).first().click();
  await page.waitForTimeout(2500);
  const body = (await page.textContent("body")) || "";
  const resolved = /Market resolved/i.test(body) && /YES WON/i.test(body);
  const noBet = !/Place private position/i.test(body); // bet button gone when resolved
  console.log(`→ detail shows resolved: ${resolved} · betting locked: ${noBet}`);
  const ok = s && s.resolution === 1 && resolved && noBet;
  console.log(ok ? "✓ RESOLUTION UI OK (resolved + betting locked)" : "✗ resolution UI incomplete");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) { console.log("✗ test error:", String(e).slice(0, 300)); await browser.close(); process.exit(2); }
