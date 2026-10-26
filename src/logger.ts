type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? 1;

function log(level: Level, message: string, meta?: unknown): void {
  if (LEVELS[level] < threshold) return;

  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  const sink = level === "error" ? console.error : console.log;

  if (meta === undefined) sink(line);
  else sink(line, meta);
}

export const logger = {
  debug: (message: string, meta?: unknown) => log("debug", message, meta),
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};
