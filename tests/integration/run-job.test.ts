import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SqliteStorage } from "../../src/adapters/storage/sqlite.ts";
import { runJob } from "../../src/application/run-job.ts";
import { loadEnv } from "../../src/config/env.ts";
import { loadSheetsConfig } from "../../src/config/sheets-config.ts";
import { createLogger } from "../../src/utils/logger.ts";

function createSetup() {
  const tempDir = mkdtempSync(join(tmpdir(), "planilha-analizer-"));
  const configPath = join(tempDir, "sheets.config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      sources: [{ sheetId: "sheet-1", spreadsheetLabel: "news", tabs: [{ tabName: "Março", headerRow: 1 }] }]
    })
  );

  return {
    env: {
      ...loadEnv(tempDir),
      sheetsConfigPath: configPath,
      databaseUrl: ":memory:",
      whatsappRecipient: "5511999999999"
    },
    config: loadSheetsConfig(configPath),
    storage: new SqliteStorage(":memory:")
  };
}

test("runJob sends only on relevant changes outside fixed windows and deduplicates fixed reports", async () => {
  const { env, config, storage } = createSetup();
  const sentMessages: string[] = [];
  const notifier = {
    async notify(text: string): Promise<void> {
      sentMessages.push(text);
    }
  };

  const baseClient = {
    async getSheetValues(): Promise<string[][]> {
      return [
        ["CÓDIGO", "PRAZO", "FORMATO", "STATUS", "OBS"],
        ["NEW-MAR001", "02/03/2026 18:00:00", "Reels", "Em aprovação", ""],
        ["NEW-MAR002", "03/03/2026 08:00:00", "Carrossel", "Pendente", ""],
        ["NEW-MAR003", "03/03/2026 10:00:00", "Carrossel", "Agendada", ""]
      ];
    }
  };

  const changedClient = {
    async getSheetValues(): Promise<string[][]> {
      return [
        ["CÓDIGO", "PRAZO", "FORMATO", "STATUS", "OBS"],
        ["NEW-MAR001", "02/03/2026 18:00:00", "Reels", "Aprovada", ""],
        ["NEW-MAR002", "03/03/2026 08:00:00", "Carrossel", "Pendente", ""],
        ["NEW-MAR003", "03/03/2026 10:00:00", "Carrossel", "Agendada", ""]
      ];
    }
  };

  const nine = await runJob(
    { env, config, sheetsClient: baseClient, storage, logger: createLogger(), notifier: notifier as never },
    { now: new Date("2026-03-01T12:00:00.000Z") }
  );
  assert.equal(nine.execution.messageSent, false);

  const ten = await runJob(
    { env, config, sheetsClient: changedClient, storage, logger: createLogger(), notifier: notifier as never },
    { now: new Date("2026-03-01T13:00:00.000Z") }
  );
  assert.equal(ten.execution.messageSent, true);
  assert.equal(ten.execution.notificationKind, "change_alert");

  const tenAgain = await runJob(
    { env, config, sheetsClient: changedClient, storage, logger: createLogger(), notifier: notifier as never },
    { now: new Date("2026-03-01T13:30:00.000Z") }
  );
  assert.equal(tenAgain.execution.messageSent, false);

  const eight = await runJob(
    { env, config, sheetsClient: changedClient, storage, logger: createLogger(), notifier: notifier as never },
    { now: new Date("2026-03-02T11:05:00.000Z") }
  );
  assert.equal(eight.execution.notificationKind, "morning_unscheduled");
  assert.equal(eight.execution.messageSent, true);
  assert.match(eight.summaryText, /Não agendados/u);
  assert.match(eight.summaryText, /responsável: Você/u);

  const eightAgain = await runJob(
    { env, config, sheetsClient: changedClient, storage, logger: createLogger(), notifier: notifier as never },
    { now: new Date("2026-03-02T11:30:00.000Z") }
  );
  assert.equal(eightAgain.execution.messageSent, false);

  const noon = await runJob(
    { env, config, sheetsClient: changedClient, storage, logger: createLogger(), notifier: notifier as never },
    { now: new Date("2026-03-02T15:10:00.000Z") }
  );
  assert.equal(noon.execution.notificationKind, "midday_changes");
  assert.equal(noon.execution.messageSent, true);

  const night = await runJob(
    { env, config, sheetsClient: changedClient, storage, logger: createLogger(), notifier: notifier as never },
    { now: new Date("2026-03-02T22:10:00.000Z") }
  );
  assert.equal(night.execution.notificationKind, "nightly_snapshot");
  assert.equal(night.execution.messageSent, true);
  assert.match(night.summaryText, /Pendentes/u);
  assert.match(night.summaryText, /Aprovados e ainda não agendados/u);

  assert.equal(sentMessages.length, 4);
  storage.close();
});
