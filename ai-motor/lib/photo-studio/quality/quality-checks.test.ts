import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  checkFileFormat,
  checkResolution,
  checkSafeZone,
  checkSsim,
  computeSsim,
  generateSafeZoneOverlay,
  getSafeZone,
  isWithinSafeZone,
  runQualityChecks,
} from "@/lib/photo-studio/quality";

async function writeTestImage(
  dir: string,
  name: string,
  width: number,
  height: number,
  fill: { r: number; g: number; b: number } = { r: 200, g: 100, b: 50 }
): Promise<string> {
  const filePath = path.join(dir, name);
  const buffer = await sharp({
    create: { width, height, channels: 3, background: fill },
  })
    .jpeg()
    .toBuffer();
  await writeFile(filePath, buffer);
  return filePath;
}

test("getSafeZone returns Meta margins per format", () => {
  const square = getSafeZone("1:1");
  assert.equal(square.margins.top, 0.05);
  assert.ok(Math.abs(square.contentRect.width - 0.9) < 0.001);

  const story = getSafeZone("9:16");
  assert.equal(story.margins.top, 0.14);
  assert.equal(story.margins.bottom, 0.35);
  assert.ok(story.contentRect.height < 0.6);
});

test("isWithinSafeZone detects bbox inside and outside safe area", () => {
  const w = 1080;
  const h = 1920;
  const inside = isWithinSafeZone(
    { x: 100, y: 400, width: 800, height: 800 },
    "9:16",
    w,
    h
  );
  assert.equal(inside, true);

  const outside = isWithinSafeZone(
    { x: 0, y: 0, width: 200, height: 200 },
    "9:16",
    w,
    h
  );
  assert.equal(outside, false);
});

test("generateSafeZoneOverlay returns PNG buffer", async () => {
  const overlay = await generateSafeZoneOverlay("4:5", 1080, 1350);
  assert.ok(Buffer.isBuffer(overlay));
  const meta = await sharp(overlay).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1350);
});

test("checkResolution pass/warn/fail thresholds", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-quality-"));

  const passPath = await writeTestImage(dir, "pass.jpg", 2048, 2048);
  const pass = await checkResolution(passPath, "1:1");
  assert.equal(pass.status, "pass");
  assert.equal(pass.id, "S3");

  const warnPath = await writeTestImage(dir, "warn.jpg", 1500, 1500);
  const warn = await checkResolution(warnPath, "4:5");
  assert.equal(warn.status, "warn");

  const failPath = await writeTestImage(dir, "fail.jpg", 800, 800);
  const fail = await checkResolution(failPath, "1:1");
  assert.equal(fail.status, "fail");
});

test("checkFileFormat accepts JPEG and rejects oversize", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-quality-"));
  const okPath = await writeTestImage(dir, "ok.jpg", 512, 512);
  const ok = await checkFileFormat(okPath);
  assert.equal(ok.status, "pass");
  assert.equal(ok.id, "S7");
});

test("computeSsim scores identical images high and different images lower", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-quality-"));
  const a = await writeTestImage(dir, "a.jpg", 256, 256, { r: 120, g: 80, b: 40 });
  const b = await writeTestImage(dir, "b.jpg", 256, 256, { r: 120, g: 80, b: 40 });
  const c = await writeTestImage(dir, "c.jpg", 256, 256, { r: 20, g: 200, b: 240 });

  const identical = await computeSsim(a, b);
  assert.ok(identical >= 0.99);

  const different = await computeSsim(a, c);
  assert.ok(different < 0.85);
});

test("checkSsim returns pass/fail statuses", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-quality-"));
  const input = await writeTestImage(dir, "in.jpg", 128, 128);
  const same = await writeTestImage(dir, "same.jpg", 128, 128);
  const diff = await writeTestImage(dir, "diff.jpg", 128, 128, { r: 10, g: 10, b: 10 });

  const pass = await checkSsim(input, same);
  assert.equal(pass.status, "pass");

  const fail = await checkSsim(input, diff);
  assert.equal(fail.status, "fail");
});

test("checkSafeZone passes aspect ratio and fails out-of-zone product", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-quality-"));
  const image = await writeTestImage(dir, "sq.jpg", 1080, 1080);

  const aspectOnly = await checkSafeZone(image, "1:1");
  assert.equal(aspectOnly.status, "pass");

  const inZone = await checkSafeZone(image, "1:1", {
    x: 200,
    y: 200,
    width: 600,
    height: 600,
  });
  assert.equal(inZone.status, "pass");

  const outZone = await checkSafeZone(image, "1:1", {
    x: 0,
    y: 0,
    width: 50,
    height: 50,
  });
  assert.equal(outZone.status, "fail");
});

test("runQualityChecks orchestrates all checks", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-quality-"));
  const input = await writeTestImage(dir, "input.jpg", 2048, 2048);
  const output = await writeTestImage(dir, "output.jpg", 2048, 2048);

  const withoutSsim = await runQualityChecks({
    outputPath: output,
    format: "1:1",
  });
  assert.equal(withoutSsim.length, 3);
  assert.ok(withoutSsim.every((r) => r.id && r.criterion && r.message));

  const withSsim = await runQualityChecks({
    inputPath: input,
    outputPath: output,
    format: "1:1",
    productBbox: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
  });
  assert.equal(withSsim.length, 4);
  assert.ok(withSsim.some((r) => r.id === "T3" && r.status === "pass"));
});
