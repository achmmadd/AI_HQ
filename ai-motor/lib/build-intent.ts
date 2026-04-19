/** Client-safe: detecteert “maak een app”-achtige prompts zonder Dify/build-deps. */
export function isBuildLikePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const keywords = [
    "maak ",
    "maak een ",
    "bouw ",
    "genereer een ",
    "create ",
    "build ",
    "webapp",
    "mini app",
    "rekenmachine",
    "calculator",
    "timer",
    "todo",
    "klok",
    "dashboard",
    "formulier",
    "widget",
  ];
  return keywords.some((k) => lower.includes(k));
}
