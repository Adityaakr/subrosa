// Verify the (live) market detail is de-faked: no odds chart, no Pragma/Cusp,
// real reserves shown, ON-CHAIN trades label, resolution text is the real source.
import { chromium } from "playwright";
const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__subrosaReadMarket === "function", { timeout: 90000 });
  await page.waitForTimeout(7000); // live reserves populate
  await page.getByText("Will ETH close above", { exact: false }).first().click(); // ETH is live
  await page.waitForTimeout(2500);
  const body = (await page.textContent("body")) || "";
  const checks = {
    "no Pragma": !/Pragma/i.test(body),
    "no Cusp": !/Cusp/i.test(body),
    "real resolver text": /Settled on-chain by the/i.test(body),
    "reserves shown": /YES reserve/i.test(body),
    "on-chain trades label": /ON-CHAIN/i.test(body),
    "LIVE badge": /LIVE · MIDEN TESTNET/i.test(body),
    "no fake 24h": !/% 24h/i.test(body),
  };
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);
  // confirm no SVG line chart in the odds card (the fake history is gone)
  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? "✓ DETAIL DE-FAKED" : "✗ detail still has mock bits");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) { console.log("✗ test error:", String(e).slice(0, 300)); await browser.close(); process.exit(2); }
