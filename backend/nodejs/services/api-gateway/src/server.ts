import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({
    host: "0.0.0.0",
    port: app.config.port
  });

  app.serviceLogger?.info("api gateway started", {
    port: app.config.port
  });
} catch (error) {
  app.serviceLogger?.error("api gateway failed to start", error);
  process.exit(1);
}
