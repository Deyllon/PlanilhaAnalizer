import assert from "node:assert/strict";
import test from "node:test";
import {
  renderChangeAlert,
  renderMiddayChangesReport,
  renderNightlySnapshotReport
} from "../../src/domain/summary.ts";

const summary = {
  windowStartIso: "2026-03-01T03:00:00.000Z",
  windowEndIso: "2026-03-04T02:59:59.999Z",
  pendingItems: [
    {
      row: {
        source: { sheetId: "sheet", spreadsheetLabel: "label", tabName: "tab" },
        rowNumber: 2,
        rowKey: "ROW1",
        code: "ROW1",
        deadline: "01/03/2026 08:00:00",
        deadlineIso: "2026-03-01T11:00:00.000Z",
        theme: null,
        description: null,
        strategicIntent: null,
        format: "Reels" as const,
        rawStatus: "Pendente",
        status: "pending" as const,
        notes: null
      },
      owner: null
    }
  ],
  approvedNotScheduledItems: [],
  notApprovedItems: [],
  unscheduledItems: [],
  dailyTransitions: [],
  newTransitions: [
    {
      event: {
        sourceKey: "sheet:tab",
        rowKey: "ROW1",
        code: "ROW1",
        fromStatus: "pending" as const,
        toStatus: "in_approval" as const,
        occurredAt: "2026-03-01T15:00:00.000Z",
        deadlineIso: "2026-03-01T11:00:00.000Z"
      },
      owner: "Você"
    }
  ],
  errors: []
};

test("renderNightlySnapshotReport renders the new sections", () => {
  const text = renderNightlySnapshotReport(summary, "America/Sao_Paulo");
  assert.match(text, /Resumo 19h/u);
  assert.match(text, /Pendentes/u);
});

test("renderMiddayChangesReport includes empty state when there are no changes", () => {
  const text = renderMiddayChangesReport(
    { ...summary, dailyTransitions: [] },
    "America/Sao_Paulo",
    new Date("2026-03-01T15:00:00.000Z")
  );
  assert.match(text, /Nenhuma mudança registrada hoje/u);
});

test("renderChangeAlert renders transition updates", () => {
  const text = renderChangeAlert(summary, "America/Sao_Paulo");
  assert.match(text, /Mudanças de status/u);
  assert.match(text, /responsável atual: Você/u);
});
