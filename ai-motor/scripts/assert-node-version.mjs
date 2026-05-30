import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nvmrc = path.join(root, ".nvmrc");

if (!fs.existsSync(nvmrc)) {
  process.exit(0);
}

const wanted = fs.readFileSync(nvmrc, "utf8").trim().replace(/^v/, "");
if (!wanted) process.exit(0);

const cur = process.version.slice(1);
const wp = wanted.split(".").map((x) => parseInt(x, 10));
const cp = cur.split(".").map((x) => parseInt(x, 10));

const match =
  wp.length === 1
    ? cp[0] === wp[0]
    : wp.length === 2
      ? cp[0] === wp[0] && cp[1] === wp[1]
      : cp[0] === wp[0] && cp[1] === wp[1] && cp[2] === wp[2];

if (!match) {
  console.error(
    `ai-motor: Node ${wanted}+ vereist (zie .nvmrc), nu ${process.version}. ` +
      `Gebruik: nvm use  (of PATH naar dezelfde binary als PM2 in ecosystem.config.cjs).`,
  );
  process.exit(1);
}
