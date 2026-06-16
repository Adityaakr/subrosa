// Headless check: funding fires the tx pop-up card with title + explorer link.
import { chromium } from "playwright";
const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Connect wallet", { exact: false }).first().waitFor({ timeout: 90000 });
  await page.getByText("Connect wallet", { exact: false }).first().click();
  await page.getByText("Subrosa Wallet", { exact: false }).first().click({ timeout: 15000 });
  await page.getByRole("button", { name: /^Fund$/i }).first().waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: /^Fund$/i }).first().click();
  console.log("→ funding… waiting for the tx pop-up card");
  // wait for the toast title
  await page.getByText("Wallet funded", { exact: false }).first().waitFor({ timeout: 300000 });
  const explorerHref = await page.locator('a[href*="testnet.midenscan.com/tx/"]').first().getAttribute("href").catch(() => null);
  const hasDesc = await page.getByText("Minted 1,000 test OBX", { exact: false }).count();
  console.log(`→ toast title shown ✓ · explorer link: ${explorerHref || "(none)"} · desc shown: ${hasDesc > 0}`);
  const ok = !!explorerHref && hasDesc > 0;
  console.log(ok ? "✓ TX POP-UP CARD OK (title + description + explorer tx link)" : "✗ pop-up incomplete");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log("✗ test error:", String(e).slice(0, 300));
  await browser.close();
  process.exit(2);
}
