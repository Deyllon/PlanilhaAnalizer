import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OwnersConfig, SheetsConfig, StatusMapConfig } from "../domain/entities.ts";

const DEFAULT_STATUS_MAP: Required<StatusMapConfig> = {
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
};

const DEFAULT_OWNERS: OwnersConfig = {
  recorded: "Maju",
  copy: "Gustavo",
  approval: "Você",
  productionByFormat: {
    Reels: "Maju",
    "Estático": "Elaine",
    Carrossel: "Elaine",
    Unknown: "Equipe"
  }
};

export interface ResolvedSheetsConfig extends SheetsConfig {
  statusMap: Required<StatusMapConfig>;
  owners: OwnersConfig;
}

export function loadSheetsConfig(configPath: string, cwd = process.cwd()): ResolvedSheetsConfig {
  const absolutePath = resolve(cwd, configPath);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as SheetsConfig;

  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error("sheets config must define at least one source");
  }

  return {
    ...parsed,
    statusMap: {
      ...DEFAULT_STATUS_MAP,
      ...(parsed.statusMap ?? {})
    },
    owners: {
      ...DEFAULT_OWNERS,
      ...(parsed.owners ?? {}),
      productionByFormat: {
        ...DEFAULT_OWNERS.productionByFormat,
        ...(parsed.owners?.productionByFormat ?? {})
      }
    }
  };
}
