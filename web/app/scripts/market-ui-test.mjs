// Headless check that the markets UI renders LIVE on-chain odds: the LIVE badge
// shows on the home grid, and the Miden market detail shows the real ~42% YES
// (the mock value is 71%, so seeing ~42 proves the on-chain override worked).
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"],
});
const page = await browser.newContext().then((c) => c.newPage());
page.on("console", (m) => { const t = m.text(); if (/market|error|fail/i.test(t)) console.log("  [browser]", t.slice(0, 160)); });

try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__subrosaReadMarket === "function", { timeout: 90000 });

  console.log("→ waiting for LIVE badge on markets home…");
  await page.getByText("Live", { exact: true }).first().waitFor({ timeout: 60000 });
  console.log("✓ LIVE badge shown");

  console.log("→ opening the Miden mainnet market…");
  await page.getByText("Will Miden mainnet launch", { exact: false }).first().click();
  await page.waitForTimeout(2000);

  const body = (await page.textContent("body")) || "";
  const pcts = [...body.matchAll(/(\d{1,3}(?:\.\d+)?)%/g)].map((x) => parseFloat(x[1]));
  const hasLive = pcts.some((p) => p >= 40 && p <= 44); // real YES ≈ 42.3
  const hasMock = pcts.some((p) => p >= 70 && p <= 72); // the old mock value (71)
  console.log("→ percentages on detail:", JSON.stringify([...new Set(pcts)].sort((a, b) => a - b)));
  console.log(hasLive && !hasMock ? "✓ DETAIL SHOWS LIVE ODDS (~42%)" : `✗ live=${hasLive} mock71=${hasMock}`);
  await browser.close();
  process.exit(hasLive && !hasMock ? 0 : 1);
} catch (e) {
  console.log("✗ test error:", String(e).slice(0, 300));
  await browser.close();
  process.exit(2);
}
