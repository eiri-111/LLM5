import { Env, ChatMessage, runFinalAnalysis } from './_gateway';

interface AnalyzeRequestBody {
  mode: 'chat';
  messages: ChatMessage[];
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: AnalyzeRequestBody = await request.json();
    const { messages } = body;

    if (!messages || messages.length < 2) {
      return new Response(JSON.stringify({ error: '対話履歴が不足しています。最低2往復以上の対話が必要です。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ステップ3: 最終性格分析 (Route: dynamic/llm5-analyst ※Gemini)
    const result = await runFinalAnalysis(env, messages);

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error('Analyze endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || '内部サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
