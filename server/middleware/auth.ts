import type { SupabaseClient } from "@supabase/supabase-js";
import { FastifyRequest, FastifyReply } from "fastify";
import { auth, User } from "../lib/auth";
import { createSupabaseUserClient } from "../lib/supabase";
import { ApiError, Errors } from "../utils/response";

declare module "fastify" {
  interface FastifyRequest {
    user: User;
    supabase: SupabaseClient;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });

    if (!session?.user) {
      throw Errors.Unauthorized();
    }

    request.user = session.user;
    request.supabase = createSupabaseUserClient(session.session.token);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    request.log.error({ err: error }, "auth middleware unexpected error");
    throw Errors.InternalError("common:errors.internal", error);
  }
}
