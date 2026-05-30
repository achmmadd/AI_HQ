import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLocalActionFromPrompt,
  shouldUseLocalExecutor,
} from "@/lib/local-action";

test("shouldUseLocalExecutor: agent + maak bestand", () => {
  assert.equal(
    shouldUseLocalExecutor('maak bestand "demo.txt"', "question", {
      agentMode: true,
    }),
    true
  );
});

test("shouldUseLocalExecutor: normale chat met MOTORS_LOCAL_CHAT", () => {
  delete process.env.MOTORS_LOCAL_CHAT;
  assert.equal(
    shouldUseLocalExecutor('maak bestand "demo.txt"', "question", {
      agentMode: false,
    }),
    true
  );
  process.env.MOTORS_LOCAL_CHAT = "0";
  assert.equal(
    shouldUseLocalExecutor('maak bestand "demo.txt"', "question", {
      agentMode: false,
    }),
    false
  );
});

test("shouldUseLocalExecutor: browser vraag niet lokaal", () => {
  assert.equal(
    shouldUseLocalExecutor("open website example.com", "action", {
      agentMode: true,
    }),
    false
  );
});

test("parseLocalActionFromPrompt: write en run", () => {
  const w = parseLocalActionFromPrompt(
    'maak bestand "foo/bar.txt" inhoud: hallo'
  );
  assert.equal(w?.op, "write_file");
  assert.equal(w?.path, "foo/bar.txt");

  const r = parseLocalActionFromPrompt("run npm test in project myapp");
  assert.equal(r?.op, "run_command");
  assert.match(r?.command ?? "", /npm test/);
});
