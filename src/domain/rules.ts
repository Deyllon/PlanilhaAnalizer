import { createHash } from "node:crypto";
import type {
  ContentFormat,
  ContentRow,
  DailyTransitionItem,
  NormalizedStatus,
  NotificationDecision,
  OwnersConfig,
  ResponsibleItem,
  StatusMapConfig,
  StatusTransitionEvent,
  StoredRowState
} from "./entities.ts";

const STATUS_LABELS: Record<NormalizedStatus, string> = {
  pending: "Pendente",
  recorded: "Gravado",
  in_production: "Em produção",
  in_copy: "Em copy",
  in_adjustment: "Em ajuste",
  in_approval: "Em aprovação",
  approved: "Aprovada",
  scheduled: "Agendada",
  posted: "Postada",
  cancelled: "Cancelada",
  paused: "Pausa/Alterada",
  unknown: "Desconhecido"
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function normalizeStatus(rawStatus: string, statusMap: Required<StatusMapConfig>): NormalizedStatus {
  const value = normalizeText(rawStatus);
  const contains = (candidates: string[] | undefined) =>
    (candidates ?? []).some((candidate) => normalizeText(candidate) === value);

  if (contains(statusMap.pending)) return "pending";
  if (contains(statusMap.recorded)) return "recorded";
  if (contains(statusMap.inProduction)) return "in_production";
  if (contains(statusMap.inCopy)) return "in_copy";
  if (contains(statusMap.inAdjustment)) return "in_adjustment";
  if (contains(statusMap.inApproval)) return "in_approval";
  if (contains(statusMap.approved)) return "approved";
  if (contains(statusMap.scheduled)) return "scheduled";
  if (contains(statusMap.posted)) return "posted";
  if (contains(statusMap.cancelled)) return "cancelled";
  if (contains(statusMap.paused)) return "paused";
  return "unknown";
}

export function normalizeFormat(rawFormat: string): ContentFormat {
  const value = normalizeText(rawFormat);
  if (value === "reels") return "Reels";
  if (value === "estatico") return "Estático";
  if (value === "carrossel") return "Carrossel";
  return "Unknown";
}

export function getOwnerForRow(row: ContentRow, owners: OwnersConfig): string | null {
  if (row.status === "recorded") {
    return owners.recorded;
  }
  if (row.status === "in_copy") {
    return owners.copy;
  }
  if (row.status === "in_production") {
    return owners.productionByFormat[row.format] ?? owners.productionByFormat.Unknown ?? null;
  }
  if (row.status === "in_approval" || row.status === "approved") {
    return owners.approval;
  }
  return null;
}

export function computeRowHash(row: ContentRow): string {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify({
      rowKey: row.rowKey,
      status: row.status,
      rawStatus: row.rawStatus,
      deadlineIso: row.deadlineIso
    })
  );
  return hash.digest("hex");
}

export interface TransitionComputation {
  transition: StatusTransitionEvent | null;
  nextApprovedTransitionCount: number;
}

export function computeTransition(
  row: ContentRow,
  previousState: StoredRowState | null,
  occurredAt: string
): TransitionComputation {
  if (!previousState) {
    return {
      transition: null,
      nextApprovedTransitionCount: row.status === "approved" ? 1 : 0
    };
  }

  if (previousState.lastStatus === row.status) {
    return {
      transition: null,
      nextApprovedTransitionCount: previousState.approvedTransitionCount
    };
  }

  return {
    transition: {
      sourceKey: `${row.source.sheetId}:${row.source.tabName}`,
      rowKey: row.rowKey,
      code: row.code,
      fromStatus: previousState.lastStatus,
      toStatus: row.status,
      occurredAt,
      deadlineIso: row.deadlineIso
    },
    nextApprovedTransitionCount:
      row.status === "approved"
        ? previousState.approvedTransitionCount + 1
        : previousState.approvedTransitionCount
  };
}

export function getStatusLabel(status: NormalizedStatus): string {
  return STATUS_LABELS[status];
}

export function isArchivedStatus(status: NormalizedStatus): boolean {
  return status === "posted" || status === "cancelled" || status === "paused";
}

export function isUnscheduledCandidate(status: NormalizedStatus): boolean {
  return !isArchivedStatus(status) && status !== "scheduled";
}

export function isPendingStatus(status: NormalizedStatus): boolean {
  return status === "pending";
}

export function isApprovedNotScheduledStatus(status: NormalizedStatus): boolean {
  return status === "approved";
}

export function isNotApprovedStatus(status: NormalizedStatus): boolean {
  return (
    status !== "approved" &&
    status !== "pending" &&
    status !== "scheduled" &&
    !isArchivedStatus(status)
  );
}

export function shouldAlertOnTransition(event: StatusTransitionEvent): boolean {
  return !isArchivedStatus(event.toStatus);
}

export function toResponsibleItem(row: ContentRow, owners: OwnersConfig): ResponsibleItem {
  return {
    row,
    owner: getOwnerForRow(row, owners)
  };
}

export function enrichTransitions(
  events: StatusTransitionEvent[],
  ownerByRowKey: Map<string, string | null>
): DailyTransitionItem[] {
  return events.map((event) => ({
    event,
    owner: ownerByRowKey.get(`${event.sourceKey}::${event.rowKey}`) ?? null
  }));
}

export function decideNotification(
  localHour: number,
  notificationAlreadySent: boolean,
  hasRelevantNewTransitions: boolean
): NotificationDecision {
  if (localHour === 8) {
    return {
      kind: notificationAlreadySent ? "none" : "morning_unscheduled",
      shouldSend: !notificationAlreadySent,
      reason: notificationAlreadySent ? "Morning report already sent" : "Morning report window",
      notificationKey: notificationAlreadySent ? undefined : "daily-08h"
    };
  }

  if (localHour === 12) {
    return {
      kind: notificationAlreadySent ? "none" : "midday_changes",
      shouldSend: !notificationAlreadySent,
      reason: notificationAlreadySent ? "Midday report already sent" : "Midday report window",
      notificationKey: notificationAlreadySent ? undefined : "daily-12h"
    };
  }

  if (localHour === 19) {
    return {
      kind: notificationAlreadySent ? "none" : "nightly_snapshot",
      shouldSend: !notificationAlreadySent,
      reason: notificationAlreadySent ? "Nightly report already sent" : "Nightly report window",
      notificationKey: notificationAlreadySent ? undefined : "daily-19h"
    };
  }

  if (hasRelevantNewTransitions) {
    return {
      kind: "change_alert",
      shouldSend: true,
      reason: "Relevant transition detected"
    };
  }

  return {
    kind: "none",
    shouldSend: false,
    reason: "No relevant changes outside fixed windows"
  };
}
