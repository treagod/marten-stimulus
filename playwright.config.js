const { defineConfig } = require("@playwright/test")

module.exports = defineConfig({
  testDir: "./test/browser",
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "node test/browser/server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
})
