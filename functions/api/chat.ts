import { Env, ChatMessage, getGeminiEndpoint, INTERVIEWER_SYSTEM_INSTRUCTION } from './_gemini';

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

    const { url } = getGeminiEndpoint(env);

    // アシスタントの質問回数を算出
    const assistantCount = messages.filter(m => m.role === 'assistant' || m.role === 'model').length;
    const currentTurn = assistantCount + 1;
    const isReadyForAnalysis = currentTurn >= 4;

    // 対話履歴をGemini形式へ変換
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: user_input }]
    });

    const guidance = isReadyForAnalysis
      ? `\n[システム指示]: 現在${currentTurn}問目の回答を受信しました。十分な対話が集まったので、共感を示した上で「これまでの会話であなたのパーソナリティ分析を行う準備が整いました！画面の『分析レポートを見る』ボタンを押してください。もちろん、さらに詳しくお話しいただいても構いません」と簡潔に伝えてください。`
      : `\n[システム指示]: 現在${currentTurn}問目です。ユーザーの回答に共感した上で、まだ聞けていないビッグファイブ因子（開放性、誠実性、外向性、協調性、情緒安定性）に関する日常シーンの質問を1つだけ投げかけてください。スマホで見やすいよう150字程度で簡潔に。`;

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: INTERVIEWER_SYSTEM_INSTRUCTION + guidance }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 350
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini API Error in chat:', errText);
      return new Response(JSON.stringify({ error: `Gemini API通信エラー (${res.status})`, details: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data: any = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'お答えいただきありがとうございます！';

    return new Response(
      JSON.stringify({
        response: replyText,
        question_count: currentTurn,
        is_ready_for_analysis: isReadyForAnalysis
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
