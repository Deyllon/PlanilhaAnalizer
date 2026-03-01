import { formatDateForDisplay, formatWindowForDisplay, getLocalDateKey } from "../utils/datetime.ts";
import type {
  DailyTransitionItem,
  ExecutionSummary,
  NotificationKind,
  ResponsibleItem
} from "./entities.ts";
import { getStatusLabel } from "./rules.ts";

function sortItems(items: ResponsibleItem[]): ResponsibleItem[] {
  return [...items].sort((left, right) => left.row.deadlineIso.localeCompare(right.row.deadlineIso));
}

function renderResponsibleItems(title: string, items: ResponsibleItem[], timeZone: string): string[] {
  if (items.length === 0) {
    return [];
  }

  return [
    title,
    ...sortItems(items).map(({ row, owner }) => {
      const ownerText = owner ? ` | responsável: ${owner}` : "";
      return `- ${row.code} | ${formatDateForDisplay(row.deadlineIso, timeZone)} | ${getStatusLabel(row.status)}${ownerText}`;
    })
  ];
}

function renderTransitionItems(title: string, items: DailyTransitionItem[], timeZone: string): string[] {
  if (items.length === 0) {
    return [];
  }

  return [
    title,
    ...items.map(({ event, owner }) => {
      const deadlineText = event.deadlineIso ? formatDateForDisplay(event.deadlineIso, timeZone) : "--";
      const ownerText = owner ? ` | responsável atual: ${owner}` : "";
      return `- ${event.code} | ${deadlineText} | ${getStatusLabel(event.fromStatus ?? "unknown")} -> ${getStatusLabel(event.toStatus)}${ownerText}`;
    })
  ];
}

export function renderMorningUnscheduledReport(summary: ExecutionSummary, timeZone: string): string {
  const sections = [
    ["Relatório 08h", `Janela: ${formatWindowForDisplay(summary.windowStartIso, summary.windowEndIso, timeZone)}`],
    renderResponsibleItems("Não agendados", summary.unscheduledItems, timeZone),
    summary.errors.length > 0 ? ["Erros de leitura", ...summary.errors.map((error) => `- ${error}`)] : []
  ].filter((section) => section.length > 0);

  return sections.map((section) => section.join("\n")).join("\n\n");
}

export function renderMiddayChangesReport(
  summary: ExecutionSummary,
  timeZone: string,
  now: Date
): string {
  const sections = [
    ["Relatório 12h", `Mudanças do dia: ${getLocalDateKey(now, timeZone)}`],
    renderTransitionItems("Mudanças de status", summary.dailyTransitions, timeZone),
    summary.dailyTransitions.length === 0 ? ["Mudanças de status", "- Nenhuma mudança registrada hoje."] : []
  ].filter((section) => section.length > 0);

  return sections.map((section) => section.join("\n")).join("\n\n");
}

export function renderNightlySnapshotReport(summary: ExecutionSummary, timeZone: string): string {
  const sections = [
    ["Resumo 19h", `Janela: ${formatWindowForDisplay(summary.windowStartIso, summary.windowEndIso, timeZone)}`],
    renderResponsibleItems("Pendentes", summary.pendingItems, timeZone),
    renderResponsibleItems("Aprovados e ainda não agendados", summary.approvedNotScheduledItems, timeZone),
    renderResponsibleItems("Não aprovados", summary.notApprovedItems, timeZone),
    summary.errors.length > 0 ? ["Erros de leitura", ...summary.errors.map((error) => `- ${error}`)] : []
  ].filter((section) => section.length > 0);

  return sections.map((section) => section.join("\n")).join("\n\n");
}

export function renderChangeAlert(summary: ExecutionSummary, timeZone: string): string {
  const sections = [
    ["Mudanças de status"],
    renderTransitionItems("Atualizações", summary.newTransitions, timeZone)
  ].filter((section) => section.length > 0);

  return sections.map((section) => section.join("\n")).join("\n\n");
}

export function renderNotification(
  kind: NotificationKind,
  summary: ExecutionSummary,
  timeZone: string,
  now: Date
): string {
  if (kind === "morning_unscheduled") {
    return renderMorningUnscheduledReport(summary, timeZone);
  }
  if (kind === "midday_changes") {
    return renderMiddayChangesReport(summary, timeZone, now);
  }
  if (kind === "nightly_snapshot") {
    return renderNightlySnapshotReport(summary, timeZone);
  }
  if (kind === "change_alert") {
    return renderChangeAlert(summary, timeZone);
  }
  return renderNightlySnapshotReport(summary, timeZone);
}
