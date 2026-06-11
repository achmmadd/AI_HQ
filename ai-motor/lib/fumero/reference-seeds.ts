import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export { isDummyPlaceholderHtml } from "@/lib/fumero/reference-html-guards";

const SEEDS_DIR = join(__dirname, "seeds");

const CHATBOT_SEED_PATHS = [
  process.env.FUMERO_CHATBOT_SEED_PATH?.trim(),
  join(SEEDS_DIR, "chatbot-reference.html"),
  "/home/pietje/fumero-chatbot/index.html",
  join(process.cwd(), "../../fumero-chatbot/index.html"),
].filter((p): p is string => Boolean(p));

const FLAPPY_SEED_PATHS = [
  process.env.FUMERO_FLAPPY_SEED_PATH?.trim(),
  join(SEEDS_DIR, "flappy-arcade.html"),
  "/home/pietje/flappy-fumero-max/index.html",
  join(process.cwd(), "../../flappy-fumero-max/index.html"),
].filter((p): p is string => Boolean(p));

const FULL_APP_MULTIPAGE_SEED_PATHS = [
  process.env.FUMERO_FULL_APP_SEED_PATH?.trim(),
  join(SEEDS_DIR, "full-app-multipage.html"),
].filter((p): p is string => Boolean(p));

const FULL_APP_B2B_SHOP_SEED_PATHS = [
  join(SEEDS_DIR, "full-app-b2b-shop.html"),
  join(SEEDS_DIR, "full-app-multipage.html"),
].filter((p): p is string => Boolean(p));

function readFirstExisting(paths: string[]): string | null {
  for (const path of paths) {
    try {
      if (!existsSync(path)) continue;
      const html = readFileSync(path, "utf8").trim();
      if (html.length > 200) return html;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Reference-quality Fumero chatbot (KB object, quick replies, toggle widget). */
export function loadChatbotReferenceSeed(): string | null {
  return readFirstExisting(CHATBOT_SEED_PATHS);
}

/** Reference flappy arcade game seed. */
export function loadFlappyReferenceSeed(): string | null {
  return readFirstExisting(FLAPPY_SEED_PATHS);
}

/** Multi-page B2B full_app reference (nav, hash-router, data API fetch). */
export function loadFullAppMultipageSeed(): string | null {
  return readFirstExisting(FULL_APP_MULTIPAGE_SEED_PATHS);
}

/** B2B shop reference (products, cart, orders, checkout, 18+, €49 min). */
export function loadFullAppB2bShopSeed(): string | null {
  return readFirstExisting(FULL_APP_B2B_SHOP_SEED_PATHS);
}

