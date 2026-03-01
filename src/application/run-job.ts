import { readRowsFromSource } from "../adapters/google-sheets/reader.ts";
import type { GoogleSheetsClient } from "../adapters/google-sheets/client.ts";
import { SqliteStorage } from "../adapters/storage/sqlite.ts";
import { WhatsAppNotifier } from "../adapters/whatsapp/notifier.ts";
import type { AppEnv } from "../config/env.ts";
import type { ResolvedSheetsConfig } from "../config/sheets-config.ts";
import type {
  ContentRow,
  DailyTransitionItem,
  ExecutionSummary,
  JobExecutionRecord,
  NotificationKind,
  ResponsibleItem,
  StoredRowState
} from "../domain/entities.ts";
import {
  computeRowHash,
  computeTransition,
  decideNotification,
  enrichTransitions,
  isApprovedNotScheduledStatus,
  isNotApprovedStatus,
  isPendingStatus,
  isUnscheduledCandidate,
  shouldAlertOnTransition,
  toResponsibleItem
} from "../domain/rules.ts";
import { renderNotification } from "../domain/summary.ts";
import {
  getAnalysisWindow,
  getLocalDateKey,
  getStartOfLocalDay,
  getZonedDateParts,
  isWithinWindow
} from "../utils/datetime.ts";
import type { Logger } from "../utils/logger.ts";

export interface RunJobDependencies {
  env: AppEnv;
  config: ResolvedSheetsConfig;
  sheetsClient: GoogleSheetsClient;
  storage: SqliteStorage;
  logger: Logger;
  notifier?: WhatsAppNotifier;
}

export interface RunJobOptions {
  now?: Date;
  dryRun?: boolean;
}

export interface RunJobResult {
  summary: ExecutionSummary;
  summaryText: string;
  execution: JobExecutionRecord;
}

function getSourceKey(row: ContentRow): string {
  return `${row.source.sheetId}:${row.source.tabName}`;
}

function getStorageKey(sourceKey: string, rowKey: string): string {
  return `${sourceKey}::${rowKey}`;
}

function toStoredState(
  row: ContentRow,
  approvedTransitionCount: number,
  observedAt: string
): StoredRowState {
  return {
    sourceKey: getSourceKey(row),
    rowKey: row.rowKey,
    code: row.code,
    lastStatus: row.status,
    lastRawStatus: row.rawStatus,
    lastSeenAt: observedAt,
    approvedTransitionCount,
    lastDeadlineIso: row.deadlineIso,
    lastHash: computeRowHash(row)
  };
}

function createEmptySummary(windowStartIso: string, windowEndIso: string): ExecutionSummary {
  return {
    windowStartIso,
    windowEndIso,
    pendingItems: [],
    approvedNotScheduledItems: [],
    notApprovedItems: [],
    unscheduledItems: [],
    dailyTransitions: [],
    newTransitions: [],
    errors: []
  };
}

function pushCategorizedItems(
  summary: ExecutionSummary,
  responsibleItem: ResponsibleItem
): void {
  const status = responsibleItem.row.status;

  if (isUnscheduledCandidate(status)) {
    summary.unscheduledItems.push(responsibleItem);
  }
  if (isPendingStatus(status)) {
    summary.pendingItems.push(responsibleItem);
  }
  if (isApprovedNotScheduledStatus(status)) {
    summary.approvedNotScheduledItems.push(responsibleItem);
  }
  if (isNotApprovedStatus(status)) {
    summary.notApprovedItems.push(responsibleItem);
  }
}

function buildNotificationKey(kind: NotificationKind, now: Date, timeZone: string): string | null {
  const dayKey = getLocalDateKey(now, timeZone);
  if (kind === "morning_unscheduled") {
    return `daily-08h:${dayKey}`;
  }
  if (kind === "midday_changes") {
    return `daily-12h:${dayKey}`;
  }
  if (kind === "nightly_snapshot") {
    return `daily-19h:${dayKey}`;
  }
  return null;
}

export async function runJob(
  dependencies: RunJobDependencies,
  options: RunJobOptions = {}
): Promise<RunJobResult> {
  const { env, config, sheetsClient, storage, logger, notifier } = dependencies;
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const window = getAnalysisWindow(now, env.appTimezone);
  const startOfLocalDay = getStartOfLocalDay(now, env.appTimezone);
  const relevantRows: ContentRow[] = [];
  const ownerByRowKey = new Map<string, string | null>();
  const newTransitionEvents = [];
  const summary = createEmptySummary(window.start.toISOString(), window.end.toISOString());

  let rowsScanned = 0;
  let sourcesProcessed = 0;

  for (const source of config.sources) {
    const result = await readRowsFromSource(
      sheetsClient,
      source,
      config.statusMap,
      env.appTimezone,
      logger
    );

    sourcesProcessed += source.tabs.length;
    rowsScanned += result.rows.length;
    summary.errors.push(...result.errors);

    for (const row of result.rows) {
      if (isWithinWindow(new Date(row.deadlineIso), window.start, window.end)) {
        relevantRows.push(row);
      }
    }
  }

  for (const row of relevantRows) {
    const sourceKey = getSourceKey(row);
    const previousState = storage.getRowState(sourceKey, row.rowKey);
    const transitionResult = computeTransition(row, previousState, now.toISOString());
    const responsibleItem = toResponsibleItem(row, config.owners);

    ownerByRowKey.set(getStorageKey(sourceKey, row.rowKey), responsibleItem.owner);
    pushCategorizedItems(summary, responsibleItem);

    if (transitionResult.transition) {
      storage.insertStatusEvent(transitionResult.transition);
      newTransitionEvents.push(transitionResult.transition);
    }

    storage.upsertRowState(
      toStoredState(row, transitionResult.nextApprovedTransitionCount, now.toISOString())
    );
  }

  const dailyEvents = storage.listStatusEventsBetween(
    startOfLocalDay.toISOString(),
    now.toISOString()
  );

  summary.dailyTransitions = enrichTransitions(dailyEvents, ownerByRowKey);
  summary.newTransitions = enrichTransitions(newTransitionEvents, ownerByRowKey).filter((item) =>
    shouldAlertOnTransition(item.event)
  );

  const localHour = getZonedDateParts(now, env.appTimezone).hour;
  const possibleKind =
    localHour === 8
      ? "morning_unscheduled"
      : localHour === 12
        ? "midday_changes"
        : localHour === 19
          ? "nightly_snapshot"
          : null;

  const notificationKey = possibleKind
    ? buildNotificationKey(possibleKind, now, env.appTimezone)
    : null;
  const notificationAlreadySent = notificationKey
    ? storage.getNotificationState(notificationKey) !== null
    : false;

  const decision = decideNotification(
    localHour,
    notificationAlreadySent,
    summary.newTransitions.length > 0
  );

  const summaryText = renderNotification(decision.kind, summary, env.appTimezone, now);
  let messageSent = false;
  let errorMessage: string | null = null;

  try {
    if (!options.dryRun && decision.shouldSend) {
      if (!notifier) {
        throw new Error("Notifier is required when dryRun is false");
      }
      if (!env.whatsappRecipient) {
        throw new Error("WHATSAPP_RECIPIENT is required");
      }
      await notifier.notify(summaryText, {
        recipient: env.whatsappRecipient,
        templateName: env.whatsappTemplateName,
        templateLanguage: env.whatsappTemplateLang
      });
      messageSent = true;

      const storedKey = buildNotificationKey(decision.kind, now, env.appTimezone);
      if (storedKey) {
        storage.upsertNotificationState({
          key: storedKey,
          sentAt: now.toISOString(),
          fingerprint: null
        });
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to send WhatsApp summary", { error: errorMessage });
  }

  const execution: JobExecutionRecord = {
    startedAt,
    finishedAt: new Date().toISOString(),
    windowStartIso: summary.windowStartIso,
    windowEndIso: summary.windowEndIso,
    sourcesProcessed,
    rowsScanned,
    transitionsCount: newTransitionEvents.length,
    messageSent,
    errorMessage,
    notificationKind: decision.kind
  };

  storage.insertJobExecution(execution);

  if (errorMessage && !options.dryRun) {
    throw new Error(errorMessage);
  }

  return {
    summary,
    summaryText,
    execution
  };
}
