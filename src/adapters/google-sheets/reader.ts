import type { Logger } from "../../utils/logger.ts";
import { parseBrazilianDateTime } from "../../utils/datetime.ts";
import { normalizeFormat, normalizeStatus } from "../../domain/rules.ts";
import type { ContentRow, SheetSourceConfig, SheetSourceRef, StatusMapConfig } from "../../domain/entities.ts";
import type { GoogleSheetsClient } from "./client.ts";

const HEADER_ALIASES: Record<string, string[]> = {
  code: ["CÓDIGO", "CODIGO"],
  deadline: ["PRAZO"],
  theme: ["TEMA"],
  description: ["DESCRIÇÃO DE CONTEÚDO", "DESCRICAO DE CONTEUDO"],
  strategicIntent: ["INTENÇÃO ESTRATÉGICA", "INTENCAO ESTRATEGICA"],
  format: ["FORMATO"],
  status: ["STATUS"],
  notes: ["OBSERVAÇÕES", "OBSERVACOES", "OBS"]
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedAliases = aliases.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) => normalizedAliases.includes(header));
}

interface HeaderIndexes {
  code: number;
  deadline: number;
  theme: number;
  description: number;
  strategicIntent: number;
  format: number;
  status: number;
  notes: number;
}

function resolveHeaders(headers: string[]): HeaderIndexes {
  const indexes: HeaderIndexes = {
    code: findHeaderIndex(headers, HEADER_ALIASES.code),
    deadline: findHeaderIndex(headers, HEADER_ALIASES.deadline),
    theme: findHeaderIndex(headers, HEADER_ALIASES.theme),
    description: findHeaderIndex(headers, HEADER_ALIASES.description),
    strategicIntent: findHeaderIndex(headers, HEADER_ALIASES.strategicIntent),
    format: findHeaderIndex(headers, HEADER_ALIASES.format),
    status: findHeaderIndex(headers, HEADER_ALIASES.status),
    notes: findHeaderIndex(headers, HEADER_ALIASES.notes)
  };

  if (indexes.code < 0 || indexes.deadline < 0 || indexes.format < 0 || indexes.status < 0) {
    throw new Error("Required headers not found");
  }

  return indexes;
}

function getCell(row: string[], index: number): string {
  if (index < 0) {
    return "";
  }
  return String(row[index] ?? "").trim();
}

function createRowKey(
  duplicatesByCode: Map<string, number>,
  code: string,
  deadlineIso: string,
  rowNumber: number,
  logger: Logger,
  source: SheetSourceRef
): string {
  if ((duplicatesByCode.get(code) ?? 0) <= 1) {
    return code;
  }

  logger.warn("Duplicate code detected; using deadline fallback in row key", {
    sourceKey: `${source.sheetId}:${source.tabName}`,
    code,
    rowNumber
  });
  return `${code}:${deadlineIso || rowNumber}`;
}

export async function readRowsFromSource(
  client: GoogleSheetsClient,
  sourceConfig: SheetSourceConfig,
  statusMap: Required<StatusMapConfig>,
  timeZone: string,
  logger: Logger
): Promise<{ rows: ContentRow[]; errors: string[] }> {
  const rows: ContentRow[] = [];
  const errors: string[] = [];

  for (const tab of sourceConfig.tabs) {
    const source: SheetSourceRef = {
      sheetId: sourceConfig.sheetId,
      spreadsheetLabel: sourceConfig.spreadsheetLabel,
      tabName: tab.tabName
    };

    try {
      const values = await client.getSheetValues(sourceConfig.sheetId, `${tab.tabName}!A:Z`);
      const headerRowIndex = tab.headerRow - 1;
      const headers = values[headerRowIndex];
      if (!headers) {
        throw new Error(`Header row ${tab.headerRow} is empty`);
      }

      const indexes = resolveHeaders(headers);
      const body = values.slice(headerRowIndex + 1);
      const duplicatesByCode = new Map<string, number>();

      for (const row of body) {
        const code = getCell(row, indexes.code);
        if (!code) {
          continue;
        }
        duplicatesByCode.set(code, (duplicatesByCode.get(code) ?? 0) + 1);
      }

      for (let offset = 0; offset < body.length; offset += 1) {
        const row = body[offset];
        const code = getCell(row, indexes.code);
        if (!code) {
          continue;
        }

        const deadline = getCell(row, indexes.deadline);
        const parsedDeadline = parseBrazilianDateTime(deadline, timeZone);
        if (!parsedDeadline) {
          logger.warn("Skipping row with invalid deadline", {
            sourceKey: `${source.sheetId}:${source.tabName}`,
            rowNumber: headerRowIndex + 2 + offset,
            code,
            deadline
          });
          continue;
        }

        const rowNumber = headerRowIndex + 2 + offset;
        const deadlineIso = parsedDeadline.toISOString();
        rows.push({
          source,
          rowNumber,
          rowKey: createRowKey(duplicatesByCode, code, deadlineIso, rowNumber, logger, source),
          code,
          deadline,
          deadlineIso,
          theme: getCell(row, indexes.theme) || null,
          description: getCell(row, indexes.description) || null,
          strategicIntent: getCell(row, indexes.strategicIntent) || null,
          format: normalizeFormat(getCell(row, indexes.format)),
          rawStatus: getCell(row, indexes.status),
          status: normalizeStatus(getCell(row, indexes.status), statusMap),
          notes: getCell(row, indexes.notes) || null
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${sourceConfig.spreadsheetLabel}/${tab.tabName}: ${message}`);
      logger.error("Failed to read tab", {
        sourceKey: `${sourceConfig.sheetId}:${tab.tabName}`,
        error: message
      });
    }
  }

  return { rows, errors };
}
