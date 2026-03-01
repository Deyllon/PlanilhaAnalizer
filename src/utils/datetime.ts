const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const read = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Missing ${type} from formatter`);
    }
    return Number.parseInt(value, 10);
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second")
  };
}

function getOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = getZonedDateParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return zonedAsUtc - date.getTime();
}

export function zonedTimeToUtc(parts: ZonedDateParts, timeZone: string): Date {
  const guess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );
  const offset = getOffsetMilliseconds(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

export function parseBrazilianDateTime(value: string, timeZone: string): Date | null {
  const match = value.trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) {
    return null;
  }

  const [, day, month, year, hour = "00", minute = "00", second = "00"] = match;
  return zonedTimeToUtc(
    {
      year: Number.parseInt(year, 10),
      month: Number.parseInt(month, 10),
      day: Number.parseInt(day, 10),
      hour: Number.parseInt(hour, 10),
      minute: Number.parseInt(minute, 10),
      second: Number.parseInt(second, 10)
    },
    timeZone
  );
}

function shiftCivilDate(parts: ZonedDateParts, days: number): ZonedDateParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
}

export function getAnalysisWindow(now: Date, timeZone: string): { start: Date; end: Date } {
  const current = getZonedDateParts(now, timeZone);
  const start = zonedTimeToUtc(
    { year: current.year, month: current.month, day: current.day, hour: 0, minute: 0, second: 0 },
    timeZone
  );
  const plusTwo = shiftCivilDate(current, 2);
  const plusTwoEnd = zonedTimeToUtc(
    {
      year: plusTwo.year,
      month: plusTwo.month,
      day: plusTwo.day,
      hour: 23,
      minute: 59,
      second: 59
    },
    timeZone
  );

  return {
    start,
    end: new Date(plusTwoEnd.getTime() + 999)
  };
}

export function getStartOfLocalDay(now: Date, timeZone: string): Date {
  const current = getZonedDateParts(now, timeZone);
  return zonedTimeToUtc(
    { year: current.year, month: current.month, day: current.day, hour: 0, minute: 0, second: 0 },
    timeZone
  );
}

export function getLocalDateKey(now: Date, timeZone: string): string {
  const current = getZonedDateParts(now, timeZone);
  const month = String(current.month).padStart(2, "0");
  const day = String(current.day).padStart(2, "0");
  return `${current.year}-${month}-${day}`;
}

export function isWithinWindow(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function formatDateForDisplay(dateIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(dateIso));
}

export function formatWindowForDisplay(startIso: string, endIso: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  return `${formatter.format(new Date(startIso))} a ${formatter.format(new Date(endIso))}`;
}
