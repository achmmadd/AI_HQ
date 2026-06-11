import assert from "node:assert/strict";
import test from "node:test";
import {
  readPendingBouwenClarify,
  writePendingBouwenClarify,
} from "@/lib/fumero/bouwen-clarify-session";

test("pending clarify round-trip in sessionStorage", () => {
  const store = new Map<string, string>();
  const g = globalThis as typeof globalThis & {
    sessionStorage?: Storage;
    window?: Window & typeof globalThis;
  };
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  g.sessionStorage = mockStorage as Storage;
  g.window = g as Window & typeof globalThis;

  writePendingBouwenClarify({
    seedPrompt: "maak chatbot",
    clarifications: ["faq van fumero.nl"],
  });
  assert.deepEqual(readPendingBouwenClarify(), {
    seedPrompt: "maak chatbot",
    clarifications: ["faq van fumero.nl"],
  });

  writePendingBouwenClarify(null);
  assert.equal(readPendingBouwenClarify(), null);
});
