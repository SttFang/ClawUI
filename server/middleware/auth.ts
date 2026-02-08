import { FastifyRequest, FastifyReply } from 'fastify';
import { auth, User } from '../lib/auth';
import { createSupabaseUserClient } from '../lib/supabase';
import { Errors } from '../utils/response';
import type { SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
    supabase: SupabaseClient;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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
    throw Errors.Unauthorized();
  }
}
