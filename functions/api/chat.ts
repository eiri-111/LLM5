import { Env, ChatMessage, UserProfileDemographics, runAnalyst, runInterviewerStream, runInitialGreetingStream } from './_gateway';

interface RequestBody {
  messages?: ChatMessage[];
  user_input?: string;
  user_profile?: UserProfileDemographics;
  is_init?: boolean;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: RequestBody = await request.json();
    const { messages = [], user_input, user_profile, is_init } = body;

    // 初回挨拶・質問の動的生成リクエスト
    if (is_init || (!user_input && messages.length === 0)) {
      const stream = await runInitialGreetingStream(env, user_profile);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    if (!user_input || user_input.trim() === '') {
      return new Response(JSON.stringify({ error: '入力内容が空です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: user_input }
    ];

    // ステップ1: 分析官AI (AI Gateway経由で Workers AI @cf/cloudflare/clef-flash を呼び出し)
    // 対話履歴から不足因子を特定し、ユーザー属性（年齢等）に適応した状況判断シナリオと文脈ブリッジを策定
    const strategy = await runAnalyst(env, updatedMessages, user_profile);

    // ステップ2: 質問係AI (Route: dynamic/llm5 ※AI Gateway側でQwenに設定済み)
    // SSEストリーミングでクライアントへ逐次送出
    const stream = await runInterviewerStream(env, updatedMessages, strategy, 'dynamic/llm5', user_profile);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || '内部サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
