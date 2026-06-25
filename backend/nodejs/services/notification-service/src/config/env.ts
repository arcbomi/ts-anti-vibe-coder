import { validatePort } from "../validation/serviceValidation.ts";
import type { ServiceConfig } from "../types/service.ts";

export function loadNotificationServiceConfig(): ServiceConfig {
  return {
    serviceName: "notification-service",
    port: validatePort(process.env.NOTIFICATION_SERVICE_PORT ?? "3003", "NOTIFICATION_SERVICE_PORT")
  };
}
