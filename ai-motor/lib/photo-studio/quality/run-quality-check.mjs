#!/usr/bin/env node
/**
 * Run: npx tsx lib/photo-studio/quality/run-quality-check.mjs <output> [--input <path>] [--format 1:1|4:5|9:16]
 *
 * Example:
 *   npx tsx lib/photo-studio/quality/run-quality-check.mjs ./out.jpg --input ./in.jpg --format 4:5
 */
import { parseArgs } from "node:util";
import { runQualityChecks } from "./index.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    input: { type: "string", short: "i" },
    format: { type: "string", short: "f", default: "1:1" },
    bbox: { type: "string" },
  },
});

const outputPath = positionals[0];
if (!outputPath) {
  console.error(
    "Usage: node lib/photo-studio/quality/run-quality-check.mjs <output> [--input path] [--format 1:1|4:5|9:16] [--bbox x,y,w,h]"
  );
  process.exit(1);
}

const format = values.format;
if (!["1:1", "4:5", "9:16"].includes(format)) {
  console.error(`Invalid format: ${format}`);
  process.exit(1);
}

let productBbox;
if (values.bbox) {
  const [x, y, w, h] = values.bbox.split(",").map(Number);
  if ([x, y, w, h].some((n) => Number.isNaN(n))) {
    console.error("Invalid --bbox; use x,y,width,height (normalized 0-1 or pixels)");
    process.exit(1);
  }
  productBbox = { x, y, width: w, height: h };
}

const results = await runQualityChecks({
  outputPath,
  inputPath: values.input,
  format,
  productBbox,
});

const summary = { pass: 0, warn: 0, fail: 0 };
for (const r of results) summary[r.status]++;

console.log(JSON.stringify({ results, summary }, null, 2));
process.exit(summary.fail > 0 ? 1 : 0);
