import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  JobExecutionRecord,
  NotificationState,
  StatusTransitionEvent,
  StoredRowState
} from "../../domain/entities.ts";

interface PersistedState {
  rowStates: Record<string, StoredRowState>;
  statusEvents: StatusTransitionEvent[];
  jobExecutions: JobExecutionRecord[];
  notificationStates: Record<string, NotificationState>;
}

function createEmptyState(): PersistedState {
  return {
    rowStates: {},
    statusEvents: [],
    jobExecutions: [],
    notificationStates: {}
  };
}

export class SqliteStorage {
  databaseUrl: string;
  state: PersistedState;

  constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
    this.state = this.loadState();
  }

  loadState(): PersistedState {
    if (this.databaseUrl === ":memory:") {
      return createEmptyState();
    }

    const path = resolve(process.cwd(), this.databaseUrl);
    if (!existsSync(path)) {
      mkdirSync(dirname(path), { recursive: true });
      return createEmptyState();
    }

    return JSON.parse(readFileSync(path, "utf8")) as PersistedState;
  }

  flush(): void {
    if (this.databaseUrl === ":memory:") {
      return;
    }

    const path = resolve(process.cwd(), this.databaseUrl);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(this.state, null, 2));
  }

  key(sourceKey: string, rowKey: string): string {
    return `${sourceKey}::${rowKey}`;
  }

  getRowState(sourceKey: string, rowKey: string): StoredRowState | null {
    return this.state.rowStates[this.key(sourceKey, rowKey)] ?? null;
  }

  upsertRowState(state: StoredRowState): void {
    this.state.rowStates[this.key(state.sourceKey, state.rowKey)] = state;
    this.flush();
  }

  insertStatusEvent(event: StatusTransitionEvent): void {
    this.state.statusEvents.push(event);
    this.flush();
  }

  listStatusEventsBetween(startIso: string, endIso: string): StatusTransitionEvent[] {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    return this.state.statusEvents.filter((event) => {
      const time = new Date(event.occurredAt).getTime();
      return time >= start && time <= end;
    });
  }

  getNotificationState(key: string): NotificationState | null {
    return this.state.notificationStates[key] ?? null;
  }

  upsertNotificationState(state: NotificationState): void {
    this.state.notificationStates[state.key] = state;
    this.flush();
  }

  insertJobExecution(record: JobExecutionRecord): void {
    this.state.jobExecutions.push(record);
    this.flush();
  }

  countStatusEvents(): number {
    return this.state.statusEvents.length;
  }

  close(): void {}
}
