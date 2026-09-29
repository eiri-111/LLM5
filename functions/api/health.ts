import { Env } from './_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const hasAnalystUrl = Boolean(env.CF_AI_GATEWAY_ANALYST_URL);
  const hasChatUrl = Boolean(env.CF_AI_GATEWAY_CHAT_URL);
  const hasToken = Boolean(env.CF_AIG_TOKEN);
  const hasAiBinding = Boolean(env.AI);

  return new Response(
    JSON.stringify({
      status: 'ok',
      architecture: 'Dual-LLM (Analyst: dynamic/llm5-analyst, Interviewer: dynamic/llm5)',
      has_analyst_route: hasAnalystUrl,
      has_chat_route: hasChatUrl,
      has_token: hasToken,
      has_workers_ai_binding: hasAiBinding,
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
