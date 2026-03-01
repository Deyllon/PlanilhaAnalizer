import { SqliteStorage } from "../adapters/storage/sqlite.ts";
import { runJob, type RunJobResult } from "../application/run-job.ts";
import type { AppEnv } from "../config/env.ts";
import type { ResolvedSheetsConfig } from "../config/sheets-config.ts";
import { createLogger, type Logger } from "../utils/logger.ts";

interface PreviewOutput {
  morning: string;
  midday: string;
  nightly: string;
}

function createPreviewEnv(): AppEnv {
  return {
    appTimezone: "America/Sao_Paulo",
    whatsappProvider: "twilio",
    whatsappRecipient: "5511999999999",
    databaseUrl: ":memory:",
    sheetsConfigPath: "./config/sheets.config.json"
  };
}

function createPreviewConfig(): ResolvedSheetsConfig {
  return {
    sources: [
      {
        sheetId: "preview-sheet",
        spreadsheetLabel: "preview",
        tabs: [{ tabName: "Março", headerRow: 1 }]
      }
    ],
    statusMap: {
      pending: ["Pendente"],
      recorded: ["Gravado"],
      inProduction: ["Em produção"],
      inCopy: ["Em copy"],
      inAdjustment: ["Em ajuste"],
      inApproval: ["Em aprovação"],
      approved: ["Aprovada", "Aprovado"],
      scheduled: ["Agendada", "Agendado"],
      posted: ["Postada", "Postado"],
      cancelled: ["Cancelada", "Cancelado"],
      paused: ["Pausa/Alterada"]
    },
    owners: {
      recorded: "Maju",
      copy: "Gustavo",
      approval: "Você",
      productionByFormat: {
        Reels: "Maju",
        "Estático": "Elaine",
        Carrossel: "Elaine",
        Unknown: "Equipe"
      }
    }
  };
}

function createSilentLogger(): Logger {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

function createSheetsClient(rows: string[][]) {
  return {
    async getSheetValues(): Promise<string[][]> {
      return rows;
    }
  };
}

async function runPreviewStep(
  storage: SqliteStorage,
  rows: string[][],
  nowIso: string,
  logger: Logger
): Promise<RunJobResult> {
  return runJob(
    {
      env: createPreviewEnv(),
      config: createPreviewConfig(),
      sheetsClient: createSheetsClient(rows),
      storage,
      logger
    },
    {
      now: new Date(nowIso),
      dryRun: true
    }
  );
}

export async function generatePreviewMessages(): Promise<PreviewOutput> {
  const storage = new SqliteStorage(":memory:");
  const logger = createSilentLogger();

  const morningRows = [
    ["CÓDIGO", "PRAZO", "FORMATO", "STATUS", "OBS"],
    ["NEW-MAR001", "02/03/2026 18:00:00", "Reels", "Em aprovação", ""],
    ["NEW-MAR002", "03/03/2026 08:00:00", "Carrossel", "Pendente", ""],
    ["NEW-MAR003", "03/03/2026 10:00:00", "Carrossel", "Agendada", ""]
  ];

  const changedRows = [
    ["CÓDIGO", "PRAZO", "FORMATO", "STATUS", "OBS"],
    ["NEW-MAR001", "02/03/2026 18:00:00", "Reels", "Aprovada", ""],
    ["NEW-MAR002", "03/03/2026 08:00:00", "Carrossel", "Pendente", ""],
    ["NEW-MAR003", "03/03/2026 10:00:00", "Carrossel", "Agendada", ""]
  ];

  try {
    const morning = await runPreviewStep(
      storage,
      morningRows,
      "2026-03-02T11:05:00.000Z",
      logger
    );

    await runPreviewStep(
      storage,
      changedRows,
      "2026-03-02T13:10:00.000Z",
      logger
    );

    const midday = await runPreviewStep(
      storage,
      changedRows,
      "2026-03-02T15:10:00.000Z",
      logger
    );

    const nightly = await runPreviewStep(
      storage,
      changedRows,
      "2026-03-02T22:10:00.000Z",
      logger
    );

    return {
      morning: morning.summaryText,
      midday: midday.summaryText,
      nightly: nightly.summaryText
    };
  } finally {
    storage.close();
  }
}

export function formatPreviewMessages(preview: PreviewOutput): string {
  return [
    "=== 08h ===",
    preview.morning,
    "",
    "=== 12h ===",
    preview.midday,
    "",
    "=== 19h ===",
    preview.nightly
  ].join("\n");
}
