import { defineConfig, devices } from "@playwright/test";

/* Hermetic: the island is local-first (localStorage + a canvas), so the only
   live process is the Vite dev server below. Tests seed their own save. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5174", trace: "on-first-retry" },
  /* Chromium at phone size: the app ships in a WebView, but only Chromium is
     on this machine, and every flow here is layout and state, not engine. */
  projects: [{
    name: "mobile",
    /* the machine's own Chrome, so the suite needs no browser download */
    use: {
      ...devices["Desktop Chrome"], channel: "chrome",
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    },
  }],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
