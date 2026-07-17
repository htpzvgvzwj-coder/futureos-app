import { chromium } from "playwright-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function waitForNoLoading(page, timeout = 20000) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading") && !document.body.innerText.includes("加载"),
    { timeout }
  );
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console.error: " + msg.text());
  });

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

  // Navigate: Home -> Mirror tab
  await page.getByRole("button", { name: /mirror/i }).first().click().catch(async () => {
    // fallback: click nav icon by testid/class if role-based lookup fails
    await page.click("text=Future Mirror");
  });
  await page.waitForTimeout(500);

  // Click the Home entry option in Life Goal Selection
  const homeEntry = page.locator(".weddingEntryOption").filter({ hasText: /home|买房|Rumah|வீடு/i });
  await homeEntry.first().click({ timeout: 10000 });
  await page.waitForTimeout(500);

  console.log("Navigated to home planner screen. URL/content check...");
  const title = await page.locator(".pageHeader h1").first().innerText();
  console.log("Header title:", title);

  // Wait for initial session load to finish
  await waitForNoLoading(page, 15000);

  // Fill in the AI text input and submit
  const textarea = page.locator(".aiTextInputCard textarea");
  await textarea.fill(
    "We want a 4-room BTO or resale flat in Punggol or Sengkang, just for the two of us, first-timer Singapore citizens."
  );
  await page.locator(".aiTextInputCard button[type=submit]").click();

  console.log("Submitted request, waiting for plans (can take ~45-60s)...");
  await page.waitForSelector(".weddingPlanTile", { timeout: 90000 });
  const tileCount = await page.locator(".weddingPlanTile").count();
  console.log("Plan tiles rendered:", tileCount);

  const firstTileText = await page.locator(".weddingPlanTile").first().innerText();
  console.log("--- First tile text ---\n" + firstTileText.slice(0, 500));

  // Click "customize" on the first tile
  await page.locator(".weddingPlanTile button").first().click();
  await page.waitForTimeout(500);

  const editorVisible = await page.locator(".recommendationPanel").count();
  console.log("Editor panel visible:", editorVisible > 0);

  // Move the price slider and check live recompute
  const slider = page.locator(".wideSlider");
  const before = await page.locator(".weddingLineItems").first().innerText();
  await slider.evaluate((el) => {
    el.value = Number(el.max);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const after = await page.locator(".weddingLineItems").first().innerText();
  console.log("Live recompute changed values:", before !== after);

  // Finalize
  await page.locator(".recommendationPanel .primaryButton").last().click();
  console.log("Clicked finalize, waiting for confirmation (can take ~30-60s)...");
  await page.waitForSelector(".recommendationPanel .insightCard", { timeout: 90000 });
  const confirmedText = await page.locator(".recommendationPanel").first().innerText();
  console.log("--- Confirmed plan text ---\n" + confirmedText.slice(0, 600));

  // Stage 2: start the down payment savings plan
  console.log("\nStarting stage2 savings plan...");
  await page.locator(".needHeroCard button.primaryButton").click();
  console.log("Requested savings plan, waiting (can take ~30-60s)...");
  await page.waitForSelector(".scenarioStack .scenarioCard", { timeout: 90000 });
  const strategyCount = await page.locator(".scenarioStack .scenarioCard").count();
  console.log("Savings strategies rendered:", strategyCount);
  const firstStrategyText = await page.locator(".scenarioStack .scenarioCard").first().innerText();
  console.log("--- First strategy text ---\n" + firstStrategyText.slice(0, 500));

  // Confirm the first strategy via the text input
  const stage2Textarea = page.locator(".aiTextInputCard textarea");
  await stage2Textarea.fill("The first strategy works well for me, let's finalize that one as my savings plan.");
  await page.locator(".aiTextInputCard button[type=submit]").click();
  console.log("Submitted stage2 confirmation, waiting (can take ~30-60s)...");
  await page.waitForSelector(".recommendationPanel:has-text('Confirmed Savings Plan')", { timeout: 90000 });
  const confirmedSavingsText = await page.locator(".recommendationPanel", { hasText: "Confirmed Savings Plan" }).innerText();
  console.log("--- Confirmed savings plan text ---\n" + confirmedSavingsText.slice(0, 600));

  console.log("\n=== JS errors captured ===");
  console.log(errors.length ? errors.join("\n") : "(none)");

  await browser.close();
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
