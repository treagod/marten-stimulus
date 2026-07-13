const { test, expect } = require("@playwright/test")

test("imports the Stimulus loader exports", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await expect.poll(() => page.evaluate(() => ({
    eagerLoadControllersFrom: typeof window.stimulusLoadingExports?.eagerLoadControllersFrom,
    lazyLoadControllersFrom: typeof window.stimulusLoadingExports?.lazyLoadControllersFrom,
  }))).toEqual({
    eagerLoadControllersFrom: "function",
    lazyLoadControllersFrom: "function",
  })
})
