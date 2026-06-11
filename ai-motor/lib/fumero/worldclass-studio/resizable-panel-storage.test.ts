import assert from "node:assert/strict";
import test from "node:test";
import {
  clampMakerPanelWidth,
  MAKER_PANEL_DEFAULT,
  MAKER_PANEL_MAX,
  MAKER_PANEL_MIN,
  readMakerPanelWidth,
  writeMakerPanelWidth,
} from "./resizable-panel-storage";

test("clampMakerPanelWidth respecteert min en max", () => {
  assert.equal(clampMakerPanelWidth(100), MAKER_PANEL_MIN);
  assert.equal(clampMakerPanelWidth(999), MAKER_PANEL_MAX);
  assert.equal(clampMakerPanelWidth(340), 340);
});

test("readMakerPanelWidth valt terug op default", () => {
  const storage = { getItem: () => null };
  assert.equal(readMakerPanelWidth(storage), MAKER_PANEL_DEFAULT);
});

test("readMakerPanelWidth leest en clamp waarde", () => {
  const storage = { getItem: () => "500" };
  assert.equal(readMakerPanelWidth(storage), MAKER_PANEL_MAX);
});

test("writeMakerPanelWidth persist en clamp", () => {
  let saved = "";
  const storage = {
    setItem: (_k: string, v: string) => {
      saved = v;
    },
  };
  assert.equal(writeMakerPanelWidth(200, storage), MAKER_PANEL_MIN);
  assert.equal(saved, String(MAKER_PANEL_MIN));
  assert.equal(writeMakerPanelWidth(340, storage), 340);
  assert.equal(saved, "340");
});
