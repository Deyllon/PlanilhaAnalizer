export type ContentFormat = "Reels" | "Estático" | "Carrossel" | "Unknown";

export type NormalizedStatus =
  | "pending"
  | "recorded"
  | "in_production"
  | "in_copy"
  | "in_adjustment"
  | "in_approval"
  | "approved"
  | "scheduled"
  | "posted"
  | "cancelled"
  | "paused"
  | "unknown";

export interface SheetTabConfig {
  tabName: string;
  headerRow: number;
}

export interface SheetSourceConfig {
  sheetId: string;
  spreadsheetLabel: string;
  tabs: SheetTabConfig[];
}

export interface SheetSourceRef {
  sheetId: string;
  spreadsheetLabel: string;
  tabName: string;
}

export interface StatusMapConfig {
  pending?: string[];
  recorded?: string[];
  inProduction?: string[];
  inCopy?: string[];
  inAdjustment?: string[];
  inApproval?: string[];
  approved?: string[];
  scheduled?: string[];
  posted?: string[];
  cancelled?: string[];
  paused?: string[];
}

export interface OwnersConfig {
  recorded: string;
  copy: string;
  approval: string;
  productionByFormat: Partial<Record<ContentFormat, string>>;
}

export interface SheetsConfig {
  sources: SheetSourceConfig[];
  statusMap?: StatusMapConfig;
  owners?: Partial<OwnersConfig>;
}

export interface ContentRow {
  source: SheetSourceRef;
  rowNumber: number;
  rowKey: string;
  code: string;
  deadline: string;
  deadlineIso: string;
  theme: string | null;
  description: string | null;
  strategicIntent: string | null;
  format: ContentFormat;
  rawStatus: string;
  status: NormalizedStatus;
  notes: string | null;
}

export interface StoredRowState {
  sourceKey: string;
  rowKey: string;
  code: string;
  lastStatus: NormalizedStatus;
  lastRawStatus: string;
  lastSeenAt: string;
  approvedTransitionCount: number;
  lastDeadlineIso: string | null;
  lastHash: string;
}

export interface StatusTransitionEvent {
  sourceKey: string;
  rowKey: string;
  code: string;
  fromStatus: NormalizedStatus | null;
  toStatus: NormalizedStatus;
  occurredAt: string;
  deadlineIso: string | null;
}

export interface ResponsibleItem {
  row: ContentRow;
  owner: string | null;
}

export interface DailyTransitionItem {
  event: StatusTransitionEvent;
  owner: string | null;
}

export interface ExecutionSummary {
  windowStartIso: string;
  windowEndIso: string;
  pendingItems: ResponsibleItem[];
  approvedNotScheduledItems: ResponsibleItem[];
  notApprovedItems: ResponsibleItem[];
  unscheduledItems: ResponsibleItem[];
  dailyTransitions: DailyTransitionItem[];
  newTransitions: DailyTransitionItem[];
  errors: string[];
}

export interface NotificationState {
  key: string;
  sentAt: string;
  fingerprint: string | null;
}

export type NotificationKind =
  | "morning_unscheduled"
  | "midday_changes"
  | "nightly_snapshot"
  | "change_alert"
  | "none";

export interface NotificationDecision {
  kind: NotificationKind;
  shouldSend: boolean;
  reason: string;
  notificationKey?: string;
}

export interface JobExecutionRecord {
  startedAt: string;
  finishedAt: string;
  windowStartIso: string;
  windowEndIso: string;
  sourcesProcessed: number;
  rowsScanned: number;
  transitionsCount: number;
  messageSent: boolean;
  errorMessage: string | null;
  notificationKind: NotificationKind;
}
