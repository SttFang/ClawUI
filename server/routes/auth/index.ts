import { FastifyInstance } from "fastify";
import { auth } from "../../lib/auth";

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // better-auth handles these routes automatically
  // This catches all auth-related requests
  fastify.all("/api/auth/*", async (request, reply) => {
    const response = await auth.handler(
      new Request(`http://localhost${request.url}`, {
        method: request.method,
        headers: new Headers(request.headers as Record<string, string>),
        body:
          request.method !== "GET" && request.method !== "HEAD"
            ? JSON.stringify(request.body)
            : undefined,
      }),
    );

    // Forward response headers
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });

    reply.status(response.status);

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  });
}
