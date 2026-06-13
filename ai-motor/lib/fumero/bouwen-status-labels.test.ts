import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOUWEN_DONE_LABEL,
  bouwenHumanStatusLabel,
  monotonicCoderBuildPhase,
} from "@/lib/fumero/bouwen-status-labels";
import {
  coderBuildProgressIsIndeterminate,
  coderBuildProgressPercent,
} from "@/lib/fumero/coder-build-phases";

describe("bouwenHumanStatusLabel", () => {
  it("returns Klaar when done", () => {
    assert.equal(
      bouwenHumanStatusLabel("anything", { done: true }),
      BOUWEN_DONE_LABEL,
    );
  });

  it("maps technical scrape steps to verzoek bekijken", () => {
    assert.equal(
      bouwenHumanStatusLabel("Live pagina's ophalen…"),
      "Je verzoek bekijken",
    );
  });

  it("maps build steps to pagina aanpassen", () => {
    assert.equal(
      bouwenHumanStatusLabel("Tool verfijnen…", { building: true }),
      "De pagina aanpassen",
    );
  });

  it("passes through coder build phases unchanged", () => {
    assert.equal(
      bouwenHumanStatusLabel("Het resultaat controleren"),
      "Het resultaat controleren",
    );
  });

  it("maps backend job phases to human steps", () => {
    assert.equal(bouwenHumanStatusLabel("analyzing"), "Je verzoek bekijken");
    assert.equal(bouwenHumanStatusLabel("saving"), "Preview klaarzetten");
    assert.equal(bouwenHumanStatusLabel("planning"), "Je verzoek bekijken");
    assert.equal(bouwenHumanStatusLabel("generating"), "De pagina aanpassen");
    assert.equal(bouwenHumanStatusLabel("validating"), "Het resultaat controleren");
  });
});

describe("monotonicCoderBuildPhase", () => {
  it("never moves backward within a session", () => {
    let max = 0;
    const steps = [
      "planning",
      "De pagina aanpassen",
      "Je verzoek bekijken",
      "validating",
    ];
    for (const step of steps) {
      const next = monotonicCoderBuildPhase(max, step, { building: true });
      assert.ok(next.index >= max, `regressed at ${step}`);
      max = next.index;
    }
    assert.equal(max, 2);
  });
});

describe("coderBuildProgressPercent", () => {
  it("returns null on last phase while building (indeterminate)", () => {
    assert.equal(
      coderBuildProgressPercent("Preview klaarzetten", true),
      null,
    );
    assert.equal(coderBuildProgressIsIndeterminate("Preview klaarzetten", true), true);
  });

  it("returns 100 when build finished", () => {
    assert.equal(coderBuildProgressPercent("Preview klaarzetten", false), 100);
  });
});
