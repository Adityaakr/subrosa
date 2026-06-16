// Verify the de-mock sweep: positions book empty (no mock), single real agent,
// bet panel uses OBX not USDC, no $2,480 mock balance.
import { chromium } from "playwright";
const URL = process.env.APP_URL ?? "http://localhost:5173/app/";
const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer", "--enable-blink-features=WebAssemblyThreads"] });
const page = await browser.newContext().then((c) => c.newPage());
try {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__subrosaReadMarket === "function", { timeout: 90000 });

  // Positions: empty book
  await page.getByRole("button", { name: /Positions/ }).first().click();
  await page.waitForTimeout(1500);
  let body = (await page.textContent("body")) || "";
  const posEmpty = /No positions yet/i.test(body);
  const noMockPos = !/0x4a1c|0x7b2e|0x1c5d/i.test(body); // old mock commitments gone

  // Agents: single real agent
  await page.getByRole("button", { name: /Agents/ }).first().click();
  await page.waitForTimeout(1200);
  body = (await page.textContent("body")) || "";
  const realAgent = /subrosa-agent-01/i.test(body);
  const noMockAgents = !/delta-neutral-01|sharp-fade-02|oracle-arb-09/i.test(body);

  // Bet panel: OBX not USDC (open a live market)
  await page.getByRole("button", { name: /Markets/ }).first().click();
  await page.waitForTimeout(800);
  await page.getByText("Will ETH close above", { exact: false }).first().click();
  await page.waitForTimeout(1500);
  body = (await page.textContent("body")) || "";
  const obx = /Balance .*OBX/i.test(body);
  const noUsdcMock = !/USDC/i.test(body) && !/\$2,480/.test(body);

  const checks = { "positions empty": posEmpty, "no mock commitments": noMockPos, "real agent shown": realAgent, "no mock agents": noMockAgents, "bet panel OBX": obx, "no USDC/$2480 mock": noUsdcMock };
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);
  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? "✓ DE-MOCK OK" : "✗ de-mock incomplete");
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (e) { console.log("✗ test error:", String(e).slice(0, 300)); await browser.close(); process.exit(2); }
