import { Env, ChatMessage, runAnalyst, runInterviewer } from './_gateway';

interface RequestBody {
  messages: ChatMessage[];
  user_input: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: RequestBody = await request.json();
    const { messages = [], user_input } = body;

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

    // ステップ1: 分析官AI (Route: dynamic/llm5-analyst または Workers AI Qwen)
    // 対話履歴から不足因子を特定し、次の質問戦略を高速策定
    const strategy = await runAnalyst(env, updatedMessages);

    // ステップ2: 質問係AI (Route: dynamic/llm5)
    // 分析官の戦略ディレクションをもとに、ユーザーに自然で親しみやすい次の問いを生成
    const { reply, isReady } = await runInterviewer(env, updatedMessages, strategy);

    return new Response(
      JSON.stringify({
        response: reply,
        is_ready_for_analysis: isReady,
        strategy_focus: strategy.focus_dimension
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || '内部サーバーエラー' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
