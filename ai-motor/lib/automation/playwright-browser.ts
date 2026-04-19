import { chromium, type BrowserContext } from "playwright";

export async function withBrowser<T>(
  fn: (context: BrowserContext) => Promise<T>
): Promise<T> {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 MotorsAI-Automation/1.0",
      viewport: { width: 1365, height: 900 },
      locale: "nl-NL",
    });
    try {
      return await fn(context);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
