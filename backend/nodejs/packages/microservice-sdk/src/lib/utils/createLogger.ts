type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, serviceName: string, message: string, metadata?: unknown) {
  const entry = {
    level,
    service: serviceName,
    message,
    ...(metadata ? { metadata } : {}),
    timestamp: new Date().toISOString()
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger(serviceName: string) {
  return {
    info(message: string, metadata?: unknown) {
      log("info", serviceName, message, metadata);
    },
    warn(message: string, metadata?: unknown) {
      log("warn", serviceName, message, metadata);
    },
    error(message: string, metadata?: unknown) {
      log("error", serviceName, message, metadata);
    }
  };
}
