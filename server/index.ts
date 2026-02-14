import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./lib/env";
import { authRoutes } from "./routes/auth";
import { subscriptionRoutes } from "./routes/subscription";
import { ApiError, error } from "./utils/response";

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
  },
});

async function main() {
  // Register CORS
  await fastify.register(cors, {
    origin: ["http://localhost:5173", /^app:\/\/.*/],
    credentials: true,
  });

  // Error handler
  fastify.setErrorHandler((err, request, reply) => {
    if (err instanceof ApiError) {
      if (err.statusCode >= 500) {
        request.log.error({ err, code: err.code }, err.messageKey);
      }
      reply.status(err.statusCode).send(error(err));
    } else {
      request.log.error({ err, url: request.url, method: request.method }, "unhandled error");
      reply.status(500).send(error(new ApiError("InternalError", "common:errors.internal", 500)));
    }
  });

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(subscriptionRoutes);

  // Health check
  fastify.get("/health", async () => ({ status: "ok" }));

  // Start server
  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  fastify.log.info(`Server running on http://localhost:${env.PORT}`);
}

main().catch((err) => {
  fastify.log.fatal({ err }, "server failed to start");
  process.exit(1);
});
