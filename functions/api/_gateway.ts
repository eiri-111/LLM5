export interface Env {
  CF_ACCOUNT_ID?: string;
  CF_GATEWAY_ID?: string;
  CF_AIG_TOKEN?: string;
  CF_AI_GATEWAY_URL?: string;
  DB?: D1Database;
  BUCKET?: R2Bucket;
  R2?: R2Bucket;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface AnalystStrategy {
  focus_dimension: string;
  target_question_strategy: string;
  is_ready_for_final_analysis: boolean;
  notes?: string;
}

export interface BigFiveDimension {
  score: number;
  level: string;
  title: string;
  description: string;
  traits: string[];
}

export interface AnalysisResult {
  personality_title: string;
  personality_type: string;
  summary: string;
  scores: {
    openness: BigFiveDimension;
    conscientiousness: BigFiveDimension;
    extraversion: BigFiveDimension;
    agreeableness: BigFiveDimension;
    neuroticism: BigFiveDimension;
  };
  strengths: string[];
  growth_areas: string[];
  career_recommendations: string[];
  relationship_style: string;
  stress_management: string;
  llm_analysis_rationale?: string;
  dialogue_evidence?: string[];
  demographics?: {
    age?: number | string | null;
    gender?: string | null;
  };
}

const DEFAULT_ACCOUNT_ID = 'e809b1129ec4b6f69520858ac79b2095';
const DEFAULT_GATEWAY_ID = 'llm5';

/**
 * Cloudflare AI Gateway Dynamic Routing (OpenAI互換 compat) エンドポイントURLを取得
 * 公式仕様: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat/chat/completions
 */
export function getGatewayCompatUrl(env: Env): string {
  if (env.CF_AI_GATEWAY_URL && env.CF_AI_GATEWAY_URL.trim() !== '') {
    return env.CF_AI_GATEWAY_URL.trim();
  }
  const accountId = env.CF_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const gatewayId = env.CF_GATEWAY_ID || DEFAULT_GATEWAY_ID;
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat/chat/completions`;
}

/**
 * リクエストヘッダーを生成
 */
export function getGatewayHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (env.CF_AIG_TOKEN && env.CF_AIG_TOKEN.trim() !== '') {
    const token = env.CF_AIG_TOKEN.trim();
    headers['cf-aig-authorization'] = `Bearer ${token}`;
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 推論モデル（DeepSeek, Qwen Reasoning, Gemini Thinking等）が出力する思考プロセス（<thought>や<think>）を除去
 */
export function cleanModelOutput(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*$/gi, '') // 万一終了タグが欠落している場合
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

/**
 * レスポンスからテキストを安全に抽出し、思考タグを自動除去
 */
function extractResponseText(data: any): string {
  let text = '';
  if (data?.choices?.[0]?.message?.content) {
    text = data.choices[0].message.content;
  } else if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = data.candidates[0].content.parts[0].text;
  } else if (typeof data?.response === 'string') {
    text = data.response;
  } else if (typeof data?.result?.response === 'string') {
    text = data.result.response;
  } else {
    text = JSON.stringify(data);
  }
  return cleanModelOutput(text);
}

/**
 * ステップ1: 分析官AI (Route: dynamic/llm5-analyst)
 * AI GatewayのDynamic Route設定（Clef-flash等）に委ね、未測定因子と次の質問戦略を高速策定
 */
export async function runAnalyst(env: Env, messages: ChatMessage[]): Promise<AnalystStrategy> {
  const dialogueHistory = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : '質問係'}: ${m.content}`)
    .join('\n');

  const analystSystemPrompt = `
あなたはビッグファイブ理論（主要5因子: 開放性, 誠実性, 外向性, 協調性, 情緒安定性）に基づく心理分析ストラテジストです。
あなたの役割は、ユーザーの「自己申告（私は○○な性格です等）」ではなく、過去に経験した【具体的な行動エピソード（事実）】から客観的な性格特性を判定することです。

【重要：行動面接（BEI）の原則】
- 「あなたはAタイプですか？それともBタイプですか？」のような二者択一や直接の性格確認は絶対に指示しないでください。
- ユーザーが話している主要な活動（仕事、学業、サークル、趣味等）を土台として認識し、そのフィールドの中で未測定の因子が現れる「具体的エピソード（ハプニングへの対処、他者との関わり、新しい試みなど）」を引き出すシチュエーションを質問係に指示してください。

【因子の引き出し例】
- 誠実性/情緒安定性: 「その活動の中で最近起きた想定外のハプニングや計画の狂いと、その時どう対処したか」
- 協調性/外向性: 「誰かと意見が分かれた場面や、周囲と足並みを揃えて何かを進めた際のエピソード」
- 開放性: 「最近新しく取り入れてみた工夫や、好奇心から試してみたこと」

【判定基準】
- 5因子の客観的エピソードが3〜4往復程度で十分に集まった場合のみ is_ready_for_final_analysis を true にしてください。

必ず以下のJSON形式のみを出力してください（Markdownコードブロックは含めず純粋なJSONのみ）:
{
  "focus_dimension": "狙う因子名 (例: 誠実性)",
  "target_question_strategy": "質問係への指示 (例: ユーザーの活動において、最近予定や計画が大きく狂ったハプニングと、その時どう乗り切ったかの具体例を尋ねさせる)",
  "is_ready_for_final_analysis": false
}
`;

  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'dynamic/llm5-analyst',
        messages: [
          { role: 'system', content: analystSystemPrompt },
          { role: 'user', content: `【対話履歴】\n${dialogueHistory}\n\n分析と次の質問戦略をJSONで出力してください。` }
        ],
        temperature: 0.2
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = extractResponseText(data);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } else {
      const errText = await res.text();
      console.warn(`Analyst route returned status ${res.status}:`, errText);
    }
  } catch (err) {
    console.error('Analyst Route fetch error:', err);
  }

  // フォールバック
  const userCount = messages.filter(m => m.role === 'user').length;
  const isReady = userCount >= 4;
  return {
    focus_dimension: isReady ? '全体' : '行動特性',
    target_question_strategy: isReady
      ? '十分な情報が集まったので分析完了を案内'
      : '休日の過ごし方や、プレッシャーを感じたときの対処について尋ねる',
    is_ready_for_final_analysis: isReady
  };
}

/**
 * ステップ2: 質問係AI (Route: dynamic/llm5) をSSEストリーミングで実行
 */
export async function runInterviewerStream(
  env: Env,
  messages: ChatMessage[],
  strategy: AnalystStrategy
): Promise<ReadableStream<Uint8Array>> {
  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  const isReady = strategy.is_ready_for_final_analysis;

  const interviewerInstruction = `
あなたはプロフェッショナルな性格分析インタビュアーです。
裏方の分析官から以下の指示（戦略）が届いています:
【分析官の指示】:
- 狙う因子: ${strategy.focus_dimension}
- 質問の方向性: ${strategy.target_question_strategy}

【対話・質問の絶対ルール】
1. 【直球のタイプ質問・二者択一は厳禁】:
   - 「あなたは〜なタイプですか？」「○○派ですか、それとも××派ですか？」といった性格の自己申告を求める質問や二択の選択肢提示は絶対に禁止です。
2. 【具体的な過去のエピソード（事実）を聞き出す】:
   - 分析官の指示に沿って、「最近、実際に〜だった場面やエピソードはありましたか？その時どう対応されましたか？」「これまでに特に印象に残っている〜な出来事はありますか？」のように、ユーザーが自分の体験した【1つの具体的な出来事・行動】を思い出して話したくなる形で尋ねてください。
3. 【共感と簡潔さ】:
   - ユーザーの直前の発言に対して温かく共感・受容した上で、次の問いを1つだけ投げかけてください。
   - ユーザーが年齢（年代）や性別について触れてくれた場合は優しく受け止めてください。もし最初の1〜2往復で年代や性別に全く触れられていない場合は、共感の言葉に添えて「差し支えなければご年代や性別も教えてくださいね！」とカジュアルに一言添えても良いです。
   - 1回の返答は2〜3文（120〜160文字程度）で簡潔に。スマホで読みやすくフランクな言葉遣いにしてください。
4. 【分析完了時】:
   - もし分析官が「分析完了」と判断している場合は、共感した上で「ここまでのお話であなたのパーソナリティを深く分析する準備が整いました！画面の『性格分析レポートを生成する』ボタンを押してください」と案内してください。
5. 【思考タグの禁止】:
   - 思考プロセスや内部推論（<thought>や<think>タグなど）は絶対に一切出力に含めず、ユーザーへの発話文のみを直接出力してください。
`;

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'dynamic/llm5',
      messages: [
        { role: 'system', content: interviewerInstruction },
        ...formattedMessages
      ],
      temperature: 0.7,
      stream: true
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Interviewer Stream error (${res.status}):`, errText);
    throw new Error(`AI Gateway (dynamic/llm5) エラー [${res.status}]: ${errText || '詳細なし'}`);
  }

  const upstreamBody = res.body;
  if (!upstreamBody) {
    throw new Error('AI Gateway からレスポンスボディを取得できませんでした');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // 1. 初期メタデータを送信
      const metaData = JSON.stringify({
        type: 'meta',
        strategy_focus: strategy.focus_dimension,
        is_ready_for_analysis: isReady
      });
      controller.enqueue(encoder.encode(`data: ${metaData}\n\n`));

      const reader = upstreamBody.getReader();
      let buffer = '';
      let isInsideThinking = false;
      let tagBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                // 思考タグ (<thought>, <think>) のリアルタイム除去
                let cleanChunk = '';
                for (let i = 0; i < content.length; i++) {
                  const char = content[i];
                  if (!isInsideThinking) {
                    if (char === '<') {
                      tagBuffer = '<';
                    } else if (tagBuffer.length > 0) {
                      tagBuffer += char;
                      if ('<think>'.startsWith(tagBuffer) || '<thought>'.startsWith(tagBuffer)) {
                        if (tagBuffer === '<think>' || tagBuffer === '<thought>') {
                          isInsideThinking = true;
                          tagBuffer = '';
                        }
                      } else {
                        cleanChunk += tagBuffer;
                        tagBuffer = '';
                      }
                    } else {
                      cleanChunk += char;
                    }
                  } else {
                    if (char === '<') {
                      tagBuffer = '<';
                    } else if (tagBuffer.length > 0) {
                      tagBuffer += char;
                      if ('</think>'.startsWith(tagBuffer) || '</thought>'.startsWith(tagBuffer)) {
                        if (tagBuffer === '</think>' || tagBuffer === '</thought>') {
                          isInsideThinking = false;
                          tagBuffer = '';
                        }
                      } else if (!tagBuffer.startsWith('</think>') && !tagBuffer.startsWith('</thought>')) {
                        tagBuffer = '';
                      }
                    }
                  }
                }

                if (cleanChunk) {
                  const chunkEvent = JSON.stringify({ type: 'chunk', text: cleanChunk });
                  controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
                }
              }
            } catch (e) {
              // 行パース失敗時は無視
            }
          }
        }
      } catch (err: any) {
        console.error('Stream reading error:', err);
        const errEvent = JSON.stringify({ type: 'error', error: err.message || 'Stream error' });
        controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`));
      } finally {
        if (!isInsideThinking && tagBuffer.length > 0 && !tagBuffer.startsWith('<think') && !tagBuffer.startsWith('<thought')) {
          const chunkEvent = JSON.stringify({ type: 'chunk', text: tagBuffer });
          controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
        }

        const doneEvent = JSON.stringify({
          type: 'done',
          is_ready_for_analysis: isReady,
          strategy_focus: strategy.focus_dimension
        });
        controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    }
  });
}

/**
 * ステップ2: 質問係AI (Route: dynamic/llm5) - 非ストリーミング（フォールバック用）
 * AI GatewayのRoute設定に委ね、自然で共感的な問いを生成
 */
export async function runInterviewer(
  env: Env, 
  messages: ChatMessage[], 
  strategy: AnalystStrategy
): Promise<{ reply: string; isReady: boolean }> {
  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  const isReady = strategy.is_ready_for_final_analysis;

  const interviewerInstruction = `
あなたはプロフェッショナルな性格分析インタビュアーです。
裏方の分析官から以下の指示（戦略）が届いています:
【分析官の指示】:
- 狙う因子: ${strategy.focus_dimension}
- 質問の方向性: ${strategy.target_question_strategy}

【対話・質問の絶対ルール】
1. 【直球のタイプ質問・二者択一は厳禁】:
   - 「あなたは〜なタイプですか？」「○○派ですか、それとも××派ですか？」といった性格の自己申告を求める質問や二択の選択肢提示は絶対に禁止です。
2. 【具体的な過去のエピソード（事実）を聞き出す】:
   - 分析官の指示に沿って、「最近、実際に〜だった場面やエピソードはありましたか？その時どう対応されましたか？」「これまでに特に印象に残っている〜な出来事はありますか？」のように、ユーザーが自分の体験した【1つの具体的な出来事・行動】を思い出して話したくなる形で尋ねてください。
3. 【共感と簡潔さ】:
   - ユーザーの直前の発言に対して温かく共感・受容した上で、次の問いを1つだけ投げかけてください。
   - ユーザーが年齢（年代）や性別について触れてくれた場合は優しく受け止めてください。もし最初の1〜2往復で年代や性別に全く触れられていない場合は、共感の言葉に添えて「差し支えなければご年代や性別も教えてくださいね！」とカジュアルに一言添えても良いです。
   - 1回の返答は2〜3文（120〜160文字程度）で簡潔に。スマホで読みやすくフランクな言葉遣いにしてください。
4. 【分析完了時】:
   - もし分析官が「分析完了」と判断している場合は、共感した上で「ここまでのお話であなたのパーソナリティを深く分析する準備が整いました！画面の『性格分析レポートを生成する』ボタンを押してください」と案内してください。
5. 【思考タグの禁止】:
   - 思考プロセスや内部推論（<thought>や<think>タグなど）は絶対に一切出力に含めず、ユーザーへの発話文のみを直接出力してください。

`;
  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'dynamic/llm5',
        messages: [
          { role: 'system', content: interviewerInstruction },
          ...formattedMessages
        ],
        temperature: 0.7
      })
    });

    if (res.ok) {
      const data = await res.json();
      const reply = extractResponseText(data) || 'お答えいただきありがとうございます！';
      return { reply, isReady };
    } else {
      const errText = await res.text();
      console.error(`Interviewer Route error (${res.status}):`, errText);
      throw new Error(`AI Gateway (dynamic/llm5) エラー [${res.status}]: ${errText || '詳細なし'}`);
    }
  } catch (err: any) {
    console.error('runInterviewer error:', err);
    throw err;
  }
}

/**
 * ステップ3: 最終性格分析 (Route: dynamic/llm5)
 * AI GatewayのRoute設定に委ね、詳細なプロファイルJSONを生成
 */
export async function runFinalAnalysis(env: Env, messages: ChatMessage[]): Promise<AnalysisResult> {
  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  const dialogueHistory = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : 'インタビュアー'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `
あなたは世界最高峰のパーソナリティ心理学者です。
提供された対話履歴から、主要5因子（開放性, 誠実性, 外向性, 協調性, 情緒安定性）に基づいて精密な性格プロファイリングを行ってください。
分析にあたっては、ユーザーの自己申告（「私は○○な性格」等）ではなく、対話内で語られた【具体的な過去のエピソード（行動事実・出来事・その時の対処法）】を唯一の根拠として客観的に評価してください。
各因子のスコア(score)は0〜100の範囲で客観的に推定し、なぜその結果になったのかの具体的な対話上の根拠（発言やエピソード、回答傾向）を深く分析してください。

必ず以下のJSON形式に厳密に従って出力してください（Markdown記法は含めず純粋なJSONのみ）:
{
  "personality_title": "性格を象徴するキャッチコピー (例: '知的好奇心あふれる先駆的イノベーター')",
  "personality_type": "タイプ名 (例: '創造的探究型')",
  "summary": "全体的な人物像と個性の統合的解説（250〜400文字程度）",
  "scores": {
    "openness": {
      "score": 85,
      "level": "非常に高い",
      "title": "旺盛な知的好奇心と発想力",
      "description": "新しい経験や創造的なアイデアに...",
      "traits": ["独創的", "探究心", "柔軟"],
      "analysis_reasoning": "なぜこのスコアと判定したか、対話中の発言・エピソードから読み取れる心理的根拠（100〜150文字程度）"
    },
    "conscientiousness": {
      "score": 70,
      "level": "高い",
      "title": "高い責任感と計画性",
      "description": "...",
      "traits": ["計画的", "着実", "自律"],
      "analysis_reasoning": "対話のどの言動からこの計画性・責任感を読み取ったかの具体的根拠"
    },
    "extraversion": {
      "score": 55,
      "level": "平均的",
      "title": "状況に応じた柔軟な社交性",
      "description": "...",
      "traits": ["バランス型", "聞き上手"],
      "analysis_reasoning": "対話のテンポや人との距離感の取り方から分析した社交性の根拠"
    },
    "agreeableness": {
      "score": 80,
      "level": "高い",
      "title": "深い共感と思いやり",
      "description": "...",
      "traits": ["協調性", "親身", "信頼"],
      "analysis_reasoning": "言葉の端々や相手への気遣い、対立への姿勢から分析した根拠"
    },
    "neuroticism": {
      "score": 40,
      "level": "控えめ",
      "title": "落ち着いた情緒安定性",
      "description": "...",
      "traits": ["冷静", "切り替えが早い"],
      "analysis_reasoning": "トラブルや気分への対処法から分析した感情の安定度の根拠"
    }
  },
  "demographics": {
    "age": 20,
    "gender": "男性"
  },
  "strengths": ["強み1", "強み2", "強み3"],
  "growth_areas": ["成長のヒント1", "成長のヒント2"],
  "career_recommendations": ["適した環境1", "適した環境2", "適した環境3"],
  "relationship_style": "対人関係やコミュニケーションの特徴とアドバイス",
  "stress_management": "ストレスを感じやすい要因と効果的なリフレッシュ法",
  "llm_analysis_rationale": "対話全体からAIが読み解いた深層心理・思考プロセスの総括（対話の言葉選び、トーン、質問へのリアクションからどのように人物像を特定したかの専門的解説。200〜300文字程度）",
  "dialogue_evidence": [
    "対話から読み取れた特徴的な発言・行動エピソード1",
    "対話から読み取れた特徴的な発言・行動エピソード2",
    "対話から読み取れた特徴的な発言・行動エピソード3"
  ]
}
※ユーザーが対話内で言及した年齢（数値または20代等の年代）と性別（男性/女性/その他）を抽出し、demographicsに格納してください（未言及の場合はnull）。
`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'dynamic/llm5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `【対話履歴】\n${dialogueHistory}\n\n上記対話からビッグファイブ性格プロファイルをJSONで生成してください。` }
      ],
      temperature: 0.0
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Final analysis fetch error (${res.status}):`, errText);
    throw new Error(`AI Gateway (dynamic/llm5) 分析エラー [${res.status}]: ${errText || '詳細なし'}`);
  }

  const data: any = await res.json();
  const rawText = extractResponseText(data);

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI Gatewayから有効なJSON応答が得られませんでした');
  }

  return JSON.parse(jsonMatch[0]);
}
