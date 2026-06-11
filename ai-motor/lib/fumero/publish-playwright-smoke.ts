/**
 * Playwright publish gate — alleen importeren vanuit API routes (geen client bundle).
 */
import { runBuildSmokeTest, type SmokeTestResult } from "@/lib/fumero/build-smoke-test";

export function isPublishPlaywrightEnabled(): boolean {
  return process.env.MOTORSAI_PUBLISH_PLAYWRIGHT === "1";
}

export async function runPlaywrightSmokeTest(html: string): Promise<string[]> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      errors.push(`Runtime: ${err.message}`);
    });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const buttonCount = await page.locator("button").count();
    if (buttonCount > 0) {
      const first = page.locator("button").first();
      await first.click({ timeout: 2000 }).catch(() => {
        errors.push("Eerste knop reageert niet op klik");
      });
    }
    await browser.close();
    return errors;
  } catch {
    return [];
  }
}

export async function runFullPublishSmokeTest(
  html: string,
  opts?: { templateId?: string; isGame?: boolean; usePlaywright?: boolean }
): Promise<SmokeTestResult> {
  const base = runBuildSmokeTest(html, opts);
  if (!opts?.usePlaywright || !base.passed) return base;

  const pwErrors = await runPlaywrightSmokeTest(html);
  if (pwErrors.length === 0) return base;

  return {
    ...base,
    passed: false,
    errors: [...base.errors, ...pwErrors],
  };
}
