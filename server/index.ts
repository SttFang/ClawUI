import cors from "@fastify/cors";
import Fastify from "fastify";
import { authRoutes } from "./routes/auth";
import { subscriptionRoutes } from "./routes/subscription";
import { ApiError, error } from "./utils/response";

const fastify = Fastify({
  logger: true,
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
      reply.status(err.statusCode).send(error(err));
    } else {
      fastify.log.error(err);
      reply.status(500).send(error(new ApiError("InternalError", "common:errors.internal", 500)));
    }
  });

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(subscriptionRoutes);

  // Health check
  fastify.get("/health", async () => ({ status: "ok" }));

  // Start server
  const port = parseInt(process.env.PORT || "14015", 10);
  await fastify.listen({ port, host: "0.0.0.0" });

  console.log(`Server running on http://localhost:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
