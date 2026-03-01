import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadSheetsConfig } from "../../src/config/sheets-config.ts";
import type { ContentRow } from "../../src/domain/entities.ts";
import {
  computeTransition,
  decideNotification,
  getOwnerForRow,
  isApprovedNotScheduledStatus,
  isNotApprovedStatus,
  isPendingStatus,
  isUnscheduledCandidate,
  normalizeFormat,
  normalizeStatus
} from "../../src/domain/rules.ts";

function createConfig() {
  const tempDir = mkdtempSync(join(tmpdir(), "planilha-analizer-"));
  const filePath = join(tempDir, "sheets.config.json");
  writeFileSync(
    filePath,
    JSON.stringify({
      sources: [{ sheetId: "sheet", spreadsheetLabel: "label", tabs: [{ tabName: "tab", headerRow: 1 }] }]
    })
  );
  return loadSheetsConfig(filePath);
}

function createRow(overrides: Partial<ContentRow> = {}): ContentRow {
  return {
    source: { sheetId: "sheet", spreadsheetLabel: "label", tabName: "tab" },
    rowNumber: 3,
    rowKey: "NEW-MAR001",
    code: "NEW-MAR001",
    deadline: "02/03/2026 18:00:00",
    deadlineIso: "2026-03-02T21:00:00.000Z",
    theme: null,
    description: null,
    strategicIntent: null,
    format: "Reels",
    rawStatus: "Aprovada",
    status: "approved",
    notes: null,
    ...overrides
  };
}

test("normalizeFormat handles supported labels", () => {
  assert.equal(normalizeFormat("Reels"), "Reels");
  assert.equal(normalizeFormat("Estático"), "Estático");
  assert.equal(normalizeFormat("Carrossel"), "Carrossel");
});

test("normalizeStatus handles accent-insensitive values", () => {
  const config = createConfig();
  assert.equal(normalizeStatus("Em producao", config.statusMap), "in_production");
  assert.equal(normalizeStatus("Postado", config.statusMap), "posted");
});

test("computeTransition increments approved on re-entry", () => {
  const result = computeTransition(
    createRow(),
    {
      sourceKey: "sheet:tab",
      rowKey: "NEW-MAR001",
      code: "NEW-MAR001",
      lastStatus: "in_approval",
      lastRawStatus: "Em aprovação",
      lastSeenAt: "2026-03-01T12:00:00.000Z",
      approvedTransitionCount: 1,
      lastDeadlineIso: "2026-03-02T21:00:00.000Z",
      lastHash: "hash"
    },
    "2026-03-01T13:00:00.000Z"
  );

  assert.ok(result.transition);
  assert.equal(result.nextApprovedTransitionCount, 2);
  assert.equal(result.transition?.fromStatus, "in_approval");
});

test("categorizes rows into operational buckets", () => {
  assert.equal(isPendingStatus("pending"), true);
  assert.equal(isApprovedNotScheduledStatus("approved"), true);
  assert.equal(isNotApprovedStatus("in_approval"), true);
  assert.equal(isNotApprovedStatus("pending"), false);
  assert.equal(isUnscheduledCandidate("approved"), true);
  assert.equal(isUnscheduledCandidate("scheduled"), false);
});

test("returns the responsible owner for approval and production states", () => {
  const config = createConfig();
  assert.equal(getOwnerForRow(createRow({ status: "approved" }), config.owners), "Você");
  assert.equal(getOwnerForRow(createRow({ status: "in_copy" }), config.owners), "Gustavo");
  assert.equal(
    getOwnerForRow(createRow({ status: "in_production", format: "Carrossel" }), config.owners),
    "Elaine"
  );
});

test("decides notifications by fixed windows and change alerts", () => {
  assert.equal(decideNotification(8, false, false).kind, "morning_unscheduled");
  assert.equal(decideNotification(8, true, true).kind, "none");
  assert.equal(decideNotification(12, false, false).kind, "midday_changes");
  assert.equal(decideNotification(19, false, false).kind, "nightly_snapshot");
  assert.equal(decideNotification(10, false, false).kind, "none");
  assert.equal(decideNotification(10, false, true).kind, "change_alert");
});
