const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  sh: "shell",
  bash: "shell",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  xml: "xml",
  svg: "xml",
  go: "go",
  rs: "rust",
  java: "java",
  php: "php",
  rb: "ruby",
  toml: "ini",
  env: "ini",
};

export function languageFromPath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_LANG[ext] ?? "plaintext";
}

export function isHtmlPath(filePath: string): boolean {
  return /\.(html?)$/i.test(filePath);
}
