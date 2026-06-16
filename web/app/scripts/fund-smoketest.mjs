// Headless end-to-end check of the wallet fund flow against the running dev
// server. Connects the built-in wallet, clicks Fund, and waits for the live
// balance to credit. Run: node scripts/fund-smoketest.mjs
import { chromium } from "playwright";

const URL = process.env.APP_URL ?? "http://localhost:5173/app/";

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"],
});
const page = await browser.newContext().then((c) => c.newPage());
page.on("console", (m) => {
  const t = m.text();
  if (/error|fail|fund|wallet|assert|procedure|OBX|Funded|Minting|Claiming|faucet/i.test(t)) console.log("  [browser]", t.slice(0, 260));
});
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 260)));

const balanceNow = async () => {
  const body = (await page.textContent("body")) || "";
  const m = body.match(/([\d][\d.,]*)\s*OBX/);
  return { raw: m && m[1], val: m ? parseFloat(m[1].replace(/,/g, "")) : null, body };
};

try {
  console.log("→ loading", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: "domcontentloaded" });
  const iso = await page.evaluate(() => ({ coi: self.crossOriginIsolated, sab: typeof SharedArrayBuffer !== "undefined" }));
  console.log(`  crossOriginIsolated=${iso.coi} SharedArrayBuffer=${iso.sab} (mtst build needs these)`);

  console.log("→ waiting for app + Connect wallet (WASM init)…");
  await page.getByText("Connect wallet", { exact: false }).first().waitFor({ timeout: 90000 });
  await page.getByText("Connect wallet", { exact: false }).first().click();

  console.log("→ choosing Subrosa Wallet…");
  await page.getByText("Subrosa Wallet", { exact: false }).first().click({ timeout: 15000 });

  console.log("→ waiting for connected (Fund button)…");
  await page.getByRole("button", { name: /Fund/i }).first().waitFor({ timeout: 120000 });
  console.log("✓ connected");

  console.log("→ clicking Fund (createFaucet → mint → consume; can take minutes)…");
  await page.getByRole("button", { name: /^Fund$/i }).first().click();

  let funded = false;
  for (let i = 0; i < 90; i++) {       // up to ~7.5 min
    await page.waitForTimeout(5000);
    const { raw, val } = await balanceNow();
    if (i % 3 === 0) console.log(`  t+${i * 5}s  balance=${raw ?? "?"} OBX`);
    if (val && val > 0) { funded = true; console.log(`✓ FUNDED — balance ${raw} OBX`); break; }
  }
  if (!funded) console.log("✗ balance still 0 after timeout");
  await browser.close();
  process.exit(funded ? 0 : 1);
} catch (e) {
  console.log("✗ test error:", String(e).slice(0, 400));
  await browser.close();
  process.exit(2);
}
