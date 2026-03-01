import assert from "node:assert/strict";
import test from "node:test";
import { getAnalysisWindow, parseBrazilianDateTime } from "../../src/utils/datetime.ts";

test("parseBrazilianDateTime parses dd/MM/yyyy HH:mm:ss", () => {
  const parsed = parseBrazilianDateTime("02/03/2026 18:00:00", "America/Sao_Paulo");
  assert.ok(parsed);
  assert.equal(parsed.toISOString(), "2026-03-02T21:00:00.000Z");
});

test("getAnalysisWindow covers today plus two days", () => {
  const now = new Date("2026-03-01T13:00:00.000Z");
  const window = getAnalysisWindow(now, "America/Sao_Paulo");
  assert.equal(window.start.toISOString(), "2026-03-01T03:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-03-04T02:59:59.999Z");
});
