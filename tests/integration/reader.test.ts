import assert from "node:assert/strict";
import test from "node:test";
import { readRowsFromSource } from "../../src/adapters/google-sheets/reader.ts";
import { createLogger } from "../../src/utils/logger.ts";

test("readRowsFromSource normalizes rows", async () => {
  const client = {
    async getSheetValues(): Promise<string[][]> {
      return [
        ["ignore"],
        ["CÓDIGO", "PRAZO", "FORMATO", "STATUS", "OBS"],
        ["NEW-MAR001", "02/03/2026 18:00:00", "Reels", "Aprovada", "ok"]
      ];
    }
  };

  const result = await readRowsFromSource(
    client,
    {
      sheetId: "sheet-1",
      spreadsheetLabel: "news",
      tabs: [{ tabName: "Março", headerRow: 2 }]
    },
    {
      pending: ["Pendente"],
      recorded: ["Gravado"],
      inProduction: ["Em produção"],
      inCopy: ["Em copy"],
      inAdjustment: ["Em ajuste"],
      inApproval: ["Em aprovação"],
      approved: ["Aprovada"],
      scheduled: ["Agendada"],
      posted: ["Postada"],
      cancelled: ["Cancelada"],
      paused: ["Pausa/Alterada"]
    },
    "America/Sao_Paulo",
    createLogger()
  );

  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.code, "NEW-MAR001");
  assert.equal(result.rows[0]?.status, "approved");
});
