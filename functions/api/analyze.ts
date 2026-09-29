import { 
  Env, 
  ChatMessage, 
  getAIGatewayRequest, 
  ANALYSIS_JSON_SCHEMA, 
  AnalysisResult 
} from './_gemini';

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

    const dialogueText = messages
      .map(m => `${m.role === 'user' ? 'ユーザー' : 'カウンセラー'}: ${m.content}`)
      .join('\n');

    const analysisContextPrompt = `【ユーザーとの対話履歴】\n${dialogueText}`;

    const { url, headers } = getAIGatewayRequest(env);

    const systemInstruction = 
      "あなたは世界最高峰のパーソナリティ心理学者です。" +
      "提供された対話履歴から、心理学のビッグファイブ理論（主要5因子: 開放性・誠実性・外向性・協調性・情緒安定性）に基づいて精密な性格プロファイリングを行ってください。" +
      "各因子のscoreは0〜100で客観的に推定し、スマホで読みやすいように切れ味鋭く、自己理解と行動のヒントにつながる分析結果をJSONスキーマに厳密に従って出力してください。";

    const prompt = `以下の対話履歴を分析し、ビッグファイブ性格プロファイルを作成してください。\n\n${analysisContextPrompt}`;

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_JSON_SCHEMA
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(geminiPayload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('AI Gateway Error in analyze:', errText);
      return new Response(JSON.stringify({ error: `Cloudflare AI Gateway分析エラー (${res.status})`, details: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data: any = await res.json();
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawJsonText) {
      throw new Error('AI Gatewayから空の応答が返されました');
    }

    const result: AnalysisResult = JSON.parse(rawJsonText);

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
