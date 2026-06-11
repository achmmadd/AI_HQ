import test from "node:test";
import assert from "node:assert/strict";
import { goalDisplayLabel, sanitizeGoalText } from "@/lib/fumero/max-goal-shared";

test("sanitizeGoalText strips orphan HTML closing tags from button labels", () => {
  const raw = "</span> </button> </div> <span class='x'>";
  assert.equal(sanitizeGoalText(raw), "");
});

test("goalDisplayLabel never returns raw markup fragments", () => {
  const label = goalDisplayLabel(
    "Bouw shop </span> </button> </div> met checkout",
    120
  );
  assert.ok(!label.includes("</"));
  assert.ok(!label.includes(">"));
  assert.match(label, /checkout/);
});

test("goalDisplayLabel handles empty after sanitize", () => {
  assert.equal(goalDisplayLabel("</button></div>"), "");
});
