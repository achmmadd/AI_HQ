import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_KENNISBANK_DIR = join(
  process.env.HOME || "/home/pietje",
  "AI_HQ/factory-os/klanten/fumero/kennisbank"
);

const TOPIC_FILES: { pattern: RegExp; files: string[] }[] = [
  {
    pattern: /\b(betaal|betalen|ideal|crypto|depay|bankoverschrijving)\b/i,
    files: ["fumero_nl__betaalmethoden.md"],
  },
  {
    pattern: /\b(verzend|lever|retour|track)\b/i,
    files: ["fumero_nl__verzenden-retourneren.md"],
  },
  {
    pattern: /\b(faq|veelgestelde|vragen|chatbot|chat)\b/i,
    files: ["fumero_nl__veel-gestelde-vragen.md", "fumero_nl__contact.md"],
  },
  {
    pattern: /\b(hhc|product|shop|vape)\b/i,
    files: ["fumero_nl__shop.md", "fumero_nl__nieuwe-producten.md", "fumero_nl__hhc-gebruikershandleiding.md"],
  },
  {
    pattern: /\b(contact|info@|mail)\b/i,
    files: ["fumero_nl__contact.md"],
  },
];

const MAX_SNIPPET_CHARS = 2800;

function kennisbankDir(): string {
  const fromEnv = process.env.FUMERO_KENNISBANK_DIR?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return DEFAULT_KENNISBANK_DIR;
}

function readMarkdownSnippet(filename: string): string | null {
  const path = join(kennisbankDir(), filename);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const body = raw.replace(/^---[\s\S]*?---\s*/m, "").trim();
    return body.slice(0, MAX_SNIPPET_CHARS);
  } catch {
    return null;
  }
}

function isChatOrGamePrompt(prompt: string): boolean {
  return /\b(chatbot|faq|game|spel|flappy|arcade|canvas|widget)\b/i.test(prompt);
}

function isFullAppBuildPrompt(prompt: string): boolean {
  return /\b(website|webshop|shop|checkout|dashboard|app|applicatie|b2b|voorraad|producten|bestellingen?|orders?)\b/i.test(
    prompt
  );
}

/**
 * Load relevant kennisbank markdown into build prompts (payment, shipping, FAQ, etc.).
 */
export function loadFumeroBuildKennisbankContext(prompt: string): string {
  if (!isChatOrGamePrompt(prompt) && !isFullAppBuildPrompt(prompt)) return "";

  const dir = kennisbankDir();
  if (!existsSync(dir)) return "";

  const selected = new Set<string>();
  for (const topic of TOPIC_FILES) {
    if (topic.pattern.test(prompt)) {
      for (const file of topic.files) selected.add(file);
    }
  }

  if (selected.size === 0) {
    for (const file of ["website-content.md", "fumero_nl__veel-gestelde-vragen.md"]) {
      if (existsSync(join(dir, file))) selected.add(file);
    }
  }

  const snippets: string[] = [];
  for (const file of selected) {
    const snippet = readMarkdownSnippet(file);
    if (snippet) snippets.push(`### ${file}\n${snippet}`);
  }

  if (snippets.length === 0) {
    const any = readdirSync(dir).filter((f) => f.endsWith(".md")).slice(0, 2);
    for (const file of any) {
      const snippet = readMarkdownSnippet(file);
      if (snippet) snippets.push(`### ${file}\n${snippet}`);
    }
  }

  if (snippets.length === 0) return "";

  return [
    "KENNISBANK (bron van waarheid — verzin geen betaalmethoden, levertijden of prijzen):",
    ...snippets,
  ].join("\n\n");
}
