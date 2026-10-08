import { Env, ChatMessage, runAnalyst, runInterviewerStream } from './_gateway';

interface RequestBody {
  messages: ChatMessage[];
  user_input: string;
  model?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: RequestBody = await request.json();
    const { messages = [], user_input, model } = body;

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

    // ステップ1: 分析官AI (Route: dynamic/llm5-analyst)
    // 対話履歴から不足因子を特定し、次の質問戦略を高速策定
    const strategy = await runAnalyst(env, updatedMessages);

    // ステップ2: 質問係AI (Route: dynamic/llm5 または dynamic/llm-qwen)
    // SSEストリーミングでクライアントへ逐次送出
    const interviewerModel = model === 'dynamic/llm-qwen' ? 'dynamic/llm-qwen' : 'dynamic/llm5';
    const stream = await runInterviewerStream(env, updatedMessages, strategy, interviewerModel);

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
