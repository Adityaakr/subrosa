// Headless check of the browser Guardian co-sign + on-chain execute.
import { chromium } from "playwright";

const URL = process.env.COSIGN_URL ?? "http://localhost:5173/cosign.html";
const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());
page.on("console", (m) => { const t = m.text(); if (/cosign|guardian|error|fail|EXECUTED|tx |multisig|threshold/i.test(t)) console.log("  [browser]", t.slice(0, 240)); });
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 240)));

try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  console.log("→ waiting for cosign page ready…");
  await page.waitForFunction(() => typeof window.__coSign === "function", { timeout: 90000 });
  console.log("→ running co-sign (create → propose → sign x2 → execute; minutes)…");
  await page.evaluate(() => window.__coSign());
  await page.waitForFunction(() => !!window.__coSignResult, { timeout: 420000 });
  const r = await page.evaluate(() => window.__coSignResult);
  console.log("→ result:", JSON.stringify(r));
  // Success = the co-sign reached + completed executeProposal without throwing
  // (it proved + submitted in-browser). tx id is a bonus if the SDK returns one.
  const ok = !!(r && r.ok);
  console.log(ok ? `✓ CO-SIGN EXECUTED ON-CHAIN${r.tx ? " — tx " + r.tx : " (multisig " + r.accountId + ")"}` : "✗ co-sign did not execute on-chain");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log("✗ test error:", String(e).slice(0, 400));
  await browser.close();
  process.exit(2);
}
