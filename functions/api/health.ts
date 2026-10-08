import { Env, getGatewayCompatUrl } from './_gateway';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const endpoint = getGatewayCompatUrl(env);
  const accountId = env.CF_ACCOUNT_ID || 'e809b1129ec4b6f69520858ac79b2095';
  const gatewayId = env.CF_GATEWAY_ID || 'llm5';
  const hasToken = Boolean(env.CF_AIG_TOKEN && env.CF_AIG_TOKEN.trim() !== '');

  return new Response(
    JSON.stringify({
      status: 'ok',
      architecture: 'Cloudflare AI Gateway Dynamic Routes (/compat/chat/completions)',
      gateway_endpoint: endpoint,
      account_id: accountId,
      gateway_id: gatewayId,
      has_token: hasToken,
      routes: {
        analyst_and_report: 'dynamic/llm5-analyst',
        interviewer: 'dynamic/llm5'
      },
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
