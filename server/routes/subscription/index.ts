import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth';
import { success, Errors } from '../../utils/response';

export async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  // Get current subscription
  fastify.get(
    '/api/subscription',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { data, error } = await request.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', request.user.id)
        .single();

      if (error || !data) {
        // Return free tier if no subscription
        return success({
          planId: 'free',
          status: 'active',
          tokensUsed: 0,
          tokensLimit: 100000,
        });
      }

      return success(data);
    }
  );

  // Get usage stats
  fastify.get(
    '/api/subscription/usage',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { data, error } = await request.supabase
        .from('subscriptions')
        .select('tokens_used, tokens_limit')
        .eq('user_id', request.user.id)
        .single();

      if (error || !data) {
        return success({
          tokensUsed: 0,
          tokensLimit: 100000,
          percentage: 0,
        });
      }

      return success({
        tokensUsed: data.tokens_used,
        tokensLimit: data.tokens_limit,
        percentage: Math.round((data.tokens_used / data.tokens_limit) * 100),
      });
    }
  );
}
