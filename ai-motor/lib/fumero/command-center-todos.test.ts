import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTaskState,
  formatCommandCenterDigest,
  sortCommandCenterTasks,
  type CommandCenterTask,
} from "@/lib/fumero/command-center-todos";

describe("sortCommandCenterTasks", () => {
  it("sorts by priority then newest timestamp", () => {
    const tasks: CommandCenterTask[] = [
      {
        id: "a",
        type: "todo",
        title: "Laag oud",
        priority: "laag",
        status: "open",
        href: "/fumero",
        source: "Test",
        timestamp: "2026-01-01T10:00:00Z",
      },
      {
        id: "b",
        type: "approval",
        title: "Kritiek nieuw",
        priority: "kritiek",
        status: "open",
        href: "/approvals",
        source: "Test",
        timestamp: "2026-06-01T10:00:00Z",
      },
      {
        id: "c",
        type: "briefing_action",
        title: "Hoog mid",
        priority: "hoog",
        status: "open",
        href: "/fumero/chat",
        source: "Test",
        timestamp: "2026-03-01T10:00:00Z",
      },
    ];
    const sorted = sortCommandCenterTasks(tasks);
    assert.equal(sorted[0]?.id, "b");
    assert.equal(sorted[1]?.id, "c");
    assert.equal(sorted[2]?.id, "a");
  });
});

describe("applyTaskState", () => {
  it("drops ignored briefing actions", () => {
    const task: CommandCenterTask = {
      id: "briefing_action:0",
      type: "briefing_action",
      title: "Plan social post",
      priority: "normaal",
      status: "open",
      href: "/fumero/chat",
      source: "Afdeling-AI",
      timestamp: "2026-06-01T08:00:00Z",
    };
    const result = applyTaskState(task, {
      item_key: "briefing_action:0",
      status: "genegeerd",
      actor: null,
      completed_at: "2026-06-01T09:00:00Z",
      updated_at: "2026-06-01T09:00:00Z",
    });
    assert.equal(result, null);
  });

  it("applies in_behandeling override", () => {
    const task: CommandCenterTask = {
      id: "briefing_action:1",
      type: "briefing_action",
      title: "Check drafts",
      priority: "normaal",
      status: "open",
      href: "/fumero/chat",
      source: "Afdeling-AI",
      timestamp: "2026-06-01T08:00:00Z",
    };
    const result = applyTaskState(task, {
      item_key: "briefing_action:1",
      status: "in_behandeling",
      actor: "operator",
      completed_at: null,
      updated_at: "2026-06-01T09:00:00Z",
    });
    assert.equal(result?.status, "in_behandeling");
    assert.equal(result?.actor, "operator");
  });
});

describe("formatCommandCenterDigest", () => {
  it("formats open count and top items with link", () => {
    const text = formatCommandCenterDigest(
      {
        open: [
          {
            id: "approval:1",
            type: "approval",
            title: "Factuur goedkeuren",
            priority: "hoog",
            status: "wacht_goedkeuring",
            href: "/approvals",
            source: "Goedkeuring",
            timestamp: "2026-06-11T08:00:00Z",
          },
          {
            id: "automation_failed:2",
            type: "automation_failure",
            title: "Orders sync mislukt",
            priority: "kritiek",
            status: "open",
            href: "/fumero/automations",
            source: "Automatisering",
            timestamp: "2026-06-11T07:00:00Z",
          },
        ],
        done: [],
        counts: {
          open: 2,
          done: 0,
          by_status: {
            open: 1,
            in_behandeling: 0,
            wacht_goedkeuring: 1,
            afgerond: 0,
            genegeerd: 0,
          },
        },
        generated_at: "2026-06-11T09:00:00Z",
      },
      "https://app.example.com"
    );
    assert.match(text, /Te doen: 2 openstaande acties/);
    assert.match(text, /1\. Factuur goedkeuren/);
    assert.match(text, /Open Command Center: https:\/\/app\.example\.com\/fumero/);
  });

  it("shows empty state when no open items", () => {
    const text = formatCommandCenterDigest(
      {
        open: [],
        done: [],
        counts: {
          open: 0,
          done: 0,
          by_status: {
            open: 0,
            in_behandeling: 0,
            wacht_goedkeuring: 0,
            afgerond: 0,
            genegeerd: 0,
          },
        },
        generated_at: "2026-06-11T09:00:00Z",
      },
      "https://app.example.com"
    );
    assert.match(text, /Geen openstaande acties/);
  });
});
