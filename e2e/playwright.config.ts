import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for JD-Clone monorepo.
 *
 * baseURL 从环境变量读取，允许在 CI / 本地 / 预发环境切换。
 *   - E2E_USER_WEB_URL  (default: http://localhost:3000)
 *   - E2E_MERCHANT_URL  (default: http://localhost:3001)
 *   - E2E_ADMIN_URL     (default: http://localhost:3002)
 *
 * 三 project 各自绑定一端的 baseURL；测试文件通过 `test.describe.configure({ project: "..." })`
 * 或按目录/文件名区分（这里通过 `testMatch` 划分）。
 *
 * CI 只做 `playwright test --list` 与 `playwright install --with-deps` 校验，不真跑；
 * 真实 E2E 由人工在本地跑（前提：`docker compose up -d` + seed + `pnpm dev:*` 已起）。
 */
const USER_WEB_URL = process.env.E2E_USER_WEB_URL ?? "http://localhost:3000";
const MERCHANT_URL = process.env.E2E_MERCHANT_URL ?? "http://localhost:3001";
const ADMIN_URL = process.env.E2E_ADMIN_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "user-web",
      testMatch: /tests\/(auth|shopping|orders|aftersales)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: USER_WEB_URL,
      },
    },
    {
      name: "merchant",
      testMatch: /tests\/merchant\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: MERCHANT_URL,
      },
    },
    {
      name: "admin",
      testMatch: /tests\/admin\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_URL,
      },
    },
  ],
});
