import { Env } from './_gemini';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const hasGateway = Boolean(env.CF_AI_GATEWAY_URL && env.CF_AI_GATEWAY_URL.trim() !== '');

  return new Response(
    JSON.stringify({
      status: 'ok',
      has_ai_gateway: hasGateway,
      platform: 'Cloudflare Pages Functions (AI Gateway Route)',
      timestamp: new Date().toISOString()
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
};
