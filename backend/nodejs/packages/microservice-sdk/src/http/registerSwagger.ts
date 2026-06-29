import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export type RegisterSwaggerOptions = {
  serviceName: string;
  title: string;
  description?: string;
  version?: string;
  routePrefix?: string;
  enabled?: boolean;
};

export async function registerSwagger(app: FastifyInstance, options: RegisterSwaggerOptions) {
  const routePrefix = options.routePrefix ?? "/docs";
  const enabled = options.enabled ?? readSwaggerEnabled();

  if (!enabled) {
    return;
  }

  app.register(swagger, {
    openapi: {
      info: {
        title: options.title,
        description: options.description,
        version: options.version ?? "1.0.0"
      },
      servers: [
        {
          url: "/",
          description: `${options.serviceName} local server`
        }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          },
          InternalServiceToken: {
            type: "apiKey",
            in: "header",
            name: "x-internal-service-token"
          }
        }
      }
    },
    exposeRoute: true,
    routePrefix
  });

  app.register(swaggerUi, {
    routePrefix,
    uiConfig: {
      docExpansion: "list",
      deepLinking: false
    },
    staticCSP: true
  });
}

function readSwaggerEnabled() {
  const explicit = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1" || explicit === "yes" || explicit === "on") {
    return true;
  }

  if (explicit === "false" || explicit === "0" || explicit === "no" || explicit === "off") {
    return false;
  }

  return (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").trim().toLowerCase() !== "production";
}
