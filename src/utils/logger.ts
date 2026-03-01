export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function write(level: string, message: string, context?: Record<string, unknown>): void {
  const payload = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(context ?? {})
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  console.log(payload);
}

export function createLogger(): Logger {
  return {
    info(message, context) {
      write("info", message, context);
    },
    warn(message, context) {
      write("warn", message, context);
    },
    error(message, context) {
      write("error", message, context);
    }
  };
}
