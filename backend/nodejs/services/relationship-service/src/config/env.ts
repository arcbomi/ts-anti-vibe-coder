import { validatePort } from "../validation/serviceValidation.ts";
import type { ServiceConfig } from "../types/service.ts";

export function loadRelationshipServiceConfig(): ServiceConfig {
  return {
    serviceName: "relationship-service",
    port: validatePort(process.env.RELATIONSHIP_SERVICE_PORT ?? "3004", "RELATIONSHIP_SERVICE_PORT")
  };
}
