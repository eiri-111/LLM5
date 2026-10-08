export interface Env {
  CF_ACCOUNT_ID?: string;
  CF_GATEWAY_ID?: string;
  CF_AIG_TOKEN?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CF_API_TOKEN?: string;
  CF_AI_GATEWAY_URL?: string;
  CF_AI_GATEWAY_ANALYST_URL?: string;
  ADMIN_PASSWORD?: string;
  AI?: any; // Cloudflare Workers AI バインディング (トークン不要・Gateway自動連携)
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

/** 対話ターン数（ユーザー発話回数）の制御基準 */
export const MIN_USER_TURNS = 5; // 最低ターン数（早すぎる分析完了を防止）
export const MAX_USER_TURNS = 8; // 安全上限ターン数（ユーザー離脱・コスト肥大化を防止）

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
 * Cloudflare AI Gateway Workers AI ネイティブ呼び出しエンドポイントURLを取得
 * 公式仕様: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/{model_name}
 */
export function getGatewayWorkersAiUrl(env: Env, model: string = '@cf/cloudflare/clef-flash'): string {
  const accountId = env.CF_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const gatewayId = env.CF_GATEWAY_ID || DEFAULT_GATEWAY_ID;
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/${model}`;
}

/**
 * リクエストヘッダーを生成 (CF_AIG_TOKEN, CLOUDFLARE_API_TOKEN, CF_API_TOKEN に対応)
 */
export function getGatewayHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = (env.CF_AIG_TOKEN || env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN || '').trim();
  if (token) {
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
 * Clef-flashの意思決定レスポンスを解析してAnalystStrategyを生成
 */
function parseClefFlashDecision(resObj: any, userCount: number): AnalystStrategy | null {
  if (!resObj) return null;

  // resObjが { answers: { ... } } や { result: { ... } } の入れ子になっている場合を考慮
  const target = resObj.answers || resObj.result || resObj;
  if (!target || (target.is_ready === undefined && target.focus_dimension === undefined)) {
    return null;
  }

  const isReadyItem = target.is_ready;
  const isReadyProb = typeof isReadyItem === 'number'
    ? isReadyItem
    : (typeof isReadyItem?.probability === 'number'
      ? isReadyItem.probability
      : (typeof isReadyItem?.yes_probability === 'number' ? isReadyItem.yes_probability : 0));
  const isReadyAnswer = isReadyItem === 'yes' || isReadyItem === true || isReadyItem?.answer === 'yes';
  const aiDeterminedReady = isReadyAnswer || isReadyProb >= 0.7;
  // 最低ターン数（5往復）に達しており、かつAIが十分なエピソードが集まったと判定した場合、または安全上限ターン数（8往復）に達した場合に準備完了
  const isReady = userCount >= MAX_USER_TURNS || (userCount >= MIN_USER_TURNS && aiDeterminedReady);

  const focusDim = target.focus_dimension?.chosen
    || target.focus_dimension?.answer
    || target.focus_dimension?.choice
    || (typeof target.focus_dimension === 'string' ? target.focus_dimension : null)
    || '誠実性';

  const strategyRaw = target.strategy_type?.chosen
    || target.strategy_type?.answer
    || target.strategy_type?.choice
    || (typeof target.strategy_type === 'string' ? target.strategy_type : null)
    || 'ハプニングへの対処';

  const strategyMap: Record<string, string> = {
    'ハプニングへの対処': '想定外のハプニングや予定の狂いへの対処エピソード',
    '他者との協力や意見の相違': '周囲と意見が分かれた場面や協力して進めたエピソード',
    '新しい工夫や試み': '新しく試みた工夫や好奇心・関心から始めた行動',
    '対人関係のスタンス': '初対面や大人数の場、日常での対人関係のスタンス',
    '感情のコントロール': 'プレッシャーや感情の浮き沈みへのセルフコントロール'
  };
  const strategyChoice = strategyMap[strategyRaw] || strategyRaw;

  const targetStrategy = isReady
    ? '十分な情報が集まったので、これまでの対話に共感しつつ性格分析レポートの生成を案内してください。'
    : `${focusDim}の特性を客観的に測定するため、ユーザーの主要な活動の中で「${strategyChoice}」についての具体的な過去の体験・エピソードを尋ねてください。`;

  return {
    focus_dimension: focusDim,
    target_question_strategy: targetStrategy,
    is_ready_for_final_analysis: isReady,
    notes: `Clef-flash (dim: ${focusDim}, isReady: ${isReady}, prob: ${isReadyProb.toFixed(2)})`
  };
}

/**
 * ステップ1: 分析官AI (Workers AI @cf/cloudflare/clef-flash を呼び出し)
 * 1. Cloudflare Workers AI 内部バインディング (env.AI) を優先使用（トークン不要・401エラー防止）
 * 2. HTTP Gateway (CF_AIG_TOKEN / CLOUDFLARE_API_TOKEN 付き) をフォールバック使用
 * 3. 万一の障害時は堅牢なルールベース判定へ移行
 */
export async function runAnalyst(env: Env, messages: ChatMessage[]): Promise<AnalystStrategy> {
  const dialogueHistory = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : '質問係'}: ${m.content}`)
    .join('\n');
  const userCount = messages.filter(m => m.role === 'user').length;

  // Clef-flash が要求する意思決定スキーマ (System One / Jev 互換)
  const clefState = `【対話履歴】\n${dialogueHistory}\n\nユーザー発話回数: ${userCount}回`;
  const clefQuestions: Record<string, any> = {
    is_ready: {
      type: "noul",
      instructions: "これまでの対話から、ビッグファイブ性格診断（開放性・誠実性・外向性・協調性・情緒安定性）を客観的・精密に評価するのに必要な、ユーザーの具体的な行動エピソード（困難やハプニングへの対処、他者との関わり、新しい試みなど）が複数十分に集まりましたか？単なる短い返答や挨拶ではなく、事実に基づく具体的な行動が十分に語られている場合にのみyesとしてください。"
    },
    focus_dimension: {
      type: "choice",
      instructions: "次の質問で深掘りすべき、情報が最も不足しているビッグファイブ性格因子はどれですか？",
      criteria: {
        "開放性": "知的好奇心、新しい体験への興味、独創性",
        "誠実性": "責任感、計画性、ハプニングへの対処、着実さ",
        "外向性": "社交性、活力、自己主張、人との関わり",
        "協調性": "他者への共感、思いやり、協力、調和",
        "情緒安定性": "ストレス耐性、冷静さ、セルフコントロール"
      }
    },
    strategy_type: {
      type: "choice",
      instructions: "その因子を測定するために尋ねるべき、最も適切な行動エピソードのシチュエーションはどれですか？",
      criteria: {
        "ハプニングへの対処": "想定外のハプニングや予定の狂いへの対処エピソード",
        "他者との協力や意見の相違": "周囲と意見が分かれた場面や協力して進めたエピソード",
        "新しい工夫や試み": "新しく試みた工夫や好奇心・関心から始めた行動",
        "対人関係のスタンス": "初対面や大人数の場、日常での対人関係のスタンス",
        "感情のコントロール": "プレッシャーや感情の浮き沈みへのセルフコントロール"
      }
    }
  };

  // 1. Cloudflare Workers AI バインディング (env.AI) が存在する場合は最優先で直接実行
  // ※ 内部バインディングのため API トークン認証エラー (HTTP 401) が原理的に発生せず、AI Gateway にも自動連携
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const aiRes: any = await env.AI.run(
        '@cf/cloudflare/clef-flash',
        {
          state: clefState,
          questions: clefQuestions
        },
        {
          gateway: {
            id: env.CF_GATEWAY_ID || DEFAULT_GATEWAY_ID,
            skipCache: false
          }
        }
      );
      const parsed = parseClefFlashDecision(aiRes, userCount);
      if (parsed) {
        parsed.notes = `${parsed.notes} [via env.AI binding]`;
        return parsed;
      }
    } catch (aiErr: any) {
      console.warn('env.AI.run Clef-flash warning, attempting HTTP fetch fallback:', aiErr?.message || aiErr);
    }
  }

  // 2. HTTP fetch (AI Gateway または Workers AI Direct REST) による呼び出し
  try {
    const endpoint = env.CF_AI_GATEWAY_ANALYST_URL && env.CF_AI_GATEWAY_ANALYST_URL.trim() !== ''
      ? env.CF_AI_GATEWAY_ANALYST_URL.trim()
      : getGatewayWorkersAiUrl(env, '@cf/cloudflare/clef-flash');
    const headers = getGatewayHeaders(env);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        state: clefState,
        questions: clefQuestions
      })
    });

    if (res.ok) {
      const data: any = await res.json();
      const parsed = parseClefFlashDecision(data, userCount);
      if (parsed) {
        parsed.notes = `${parsed.notes} [via HTTP Gateway]`;
        return parsed;
      }

      // 通常のチャットLLM形式（JSON出力）への互換フォールバック対応
      const rawText = extractResponseText(data);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonParsed = JSON.parse(jsonMatch[0]);
          if (jsonParsed && typeof jsonParsed === 'object' && jsonParsed.focus_dimension && jsonParsed.target_question_strategy) {
            const aiReady = !!jsonParsed.is_ready_for_final_analysis;
            const isReady = userCount >= MAX_USER_TURNS || (userCount >= MIN_USER_TURNS && aiReady);
            return {
              focus_dimension: String(jsonParsed.focus_dimension),
              target_question_strategy: String(jsonParsed.target_question_strategy),
              is_ready_for_final_analysis: isReady,
              notes: 'Parsed from JSON fallback'
            };
          }
        } catch (_) {}
      }
    } else {
      const errText = await res.text();
      console.warn(`Analyst route returned status ${res.status}:`, errText);
    }
  } catch (err) {
    console.error('Analyst Route fetch error:', err);
  }

  // 3. ルールベースのフォールバック戦略（万一のAI障害・401エラー時でもユーザーの対話を絶対に止めない安全設計）
  const isReady = userCount >= MAX_USER_TURNS;
  const fallbackDimensions = ['開放性', '誠実性', '外向性', '協調性', '情緒安定性'];
  const focusDim = isReady ? '全体' : fallbackDimensions[userCount % fallbackDimensions.length];
  const strategyDetails: Record<string, string> = {
    '開放性': '新しく試みた工夫や好奇心・関心から始めた行動',
    '誠実性': '想定外のハプニングや予定の狂いへの対処エピソード',
    '外向性': '初対面や大人数の場、日常での対人関係のスタンス',
    '協調性': '周囲と意見が分かれた場面や協力して進めたエピソード',
    '情緒安定性': 'プレッシャーや感情の浮き沈みへのセルフコントロール'
  };
  const detail = strategyDetails[focusDim] || '具体的な行動エピソード';

  return {
    focus_dimension: focusDim,
    target_question_strategy: isReady
      ? '十分な情報が集まったので、これまでの対話に共感しつつ性格分析レポートの生成を案内してください。'
      : `${focusDim}の特性を客観的に測定するため、ユーザーの主要な活動の中で「${detail}」についての具体的な過去の体験・エピソードを尋ねてください。`,
    is_ready_for_final_analysis: isReady,
    notes: 'Rule-based fallback strategy'
  };
}

/**
 * ステップ2: 質問係AI (Route: dynamic/llm5) をSSEストリーミングで実行
 */
export async function runInterviewerStream(
  env: Env,
  messages: ChatMessage[],
  strategy: AnalystStrategy,
  modelName: string = 'dynamic/llm5'
): Promise<ReadableStream<Uint8Array>> {
  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  const isReady = strategy.is_ready_for_final_analysis;
  const targetModel = modelName || 'dynamic/llm5';

  const focusDimension = strategy.focus_dimension || '行動特性';
  const targetStrategy = strategy.target_question_strategy || 'これまでの活動や具体的な行動エピソードについて尋ねる';

  const interviewerInstruction = `
裏方の分析官から以下の指示（戦略）が届いています:
【分析官の指示】:
- 狙う因子: ${focusDimension}
- 質問の方向性: ${targetStrategy}

【対話・質問の絶対ルール】
1. 【直球のタイプ質問・二者択一は厳禁】:
   - 「あなたは〜なタイプですか？」「○○派ですか、それとも××派ですか？」といった性格の自己申告を求める質問や二択の選択肢提示は絶対に禁止です。
2. 【具体的な過去のエピソード（事実）を聞き出す】:
   - 分析官の指示に沿って、「最近、実際に〜だった場面やエピソードはありましたか？その時どう対応されましたか？」「これまでに特に印象に残っている〜な出来事はありますか？」のように、ユーザーが自分の体験した【1つの具体的な出来事・行動】を思い出して話したくなる形で尋ねてください。
3. 【共感と簡潔さ】:
   - ユーザーの直前の発言に対して温かく共感・受容した上で、次の問いを1つだけ投げかけてください。
   - 年齢や性別は開始時に入力済みのため、対話内で年齢や性別を尋ねる必要はありません。日常の活動や具体的なエピソードに集中して対話を深めてください。
   - 1回の返答は2〜3文（120〜160文字程度）で簡潔に。スマホで読みやすくフランクな言葉遣いにしてください。
4. 【分析完了時】:
   - もし分析官が「分析完了」と判断している場合は、共感した上で「ここまでのお話であなたのパーソナリティを深く分析する準備が整いました。画面の『性格分析レポートを生成する』ボタンを押してください」と案内してください。
`;

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: targetModel,
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
    throw new Error(`AI Gateway (${targetModel}) エラー [${res.status}]: ${errText || '詳細なし'}`);
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
  strategy: AnalystStrategy,
  modelName: string = 'dynamic/llm5'
): Promise<{ reply: string; isReady: boolean }> {
  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  const isReady = strategy.is_ready_for_final_analysis;
  const targetModel = modelName || 'dynamic/llm5';

  const focusDimension = strategy.focus_dimension || '行動特性';
  const targetStrategy = strategy.target_question_strategy || 'これまでの活動や具体的な行動エピソードについて尋ねる';

  const interviewerInstruction = `
あなたはプロフェッショナルな性格分析インタビュアーです。
裏方の分析官から以下の指示（戦略）が届いています:
【分析官の指示】:
- 狙う因子: ${focusDimension}
- 質問の方向性: ${targetStrategy}

【対話・質問の絶対ルール】
1. 【直球のタイプ質問・二者択一は厳禁】:
   - 「あなたは〜なタイプですか？」「○○派ですか、それとも××派ですか？」といった性格の自己申告を求める質問や二択の選択肢提示は絶対に禁止です。
2. 【具体的な過去のエピソード（事実）を聞き出す】:
   - 分析官の指示に沿って、「最近、実際に〜だった場面やエピソードはありましたか？その時どう対応されましたか？」「これまでに特に印象に残っている〜な出来事はありますか？」のように、ユーザーが自分の体験した【1つの具体的な出来事・行動】を思い出して話したくなる形で尋ねてください。
3. 【共感と簡潔さ】:
   - ユーザーの直前の発言に対して温かく共感・受容した上で、次の問いを1つだけ投げかけてください。
   - 年齢や性別は開始時に入力済みのため、対話内で年齢や性別を尋ねる必要はありません。日常の活動や具体的なエピソードに集中して対話を深めてください。
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
        model: targetModel,
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
      throw new Error(`AI Gateway (${targetModel}) エラー [${res.status}]: ${errText || '詳細なし'}`);
    }
  } catch (err: any) {
    console.error('runInterviewer error:', err);
    throw err;
  }
}

/**
 * ステップ3: 最終性格分析 (Route: dynamic/llm5-analyst ※Gemini)
 * AI GatewayのRoute設定に委ね、詳細なプロファイルJSONを生成
 */
export async function runFinalAnalysis(
  env: Env,
  messages: ChatMessage[],
  modelName: string = 'dynamic/llm5-analyst'
): Promise<AnalysisResult> {
  const endpoint = env.CF_AI_GATEWAY_ANALYST_URL && env.CF_AI_GATEWAY_ANALYST_URL.trim() !== ''
    ? env.CF_AI_GATEWAY_ANALYST_URL.trim()
    : getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);
  const targetModel = modelName || 'dynamic/llm5-analyst';

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
      model: targetModel,
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
    throw new Error(`AI Gateway (${targetModel}) 分析エラー [${res.status}]: ${errText || '詳細なし'}`);
  }

  const data: any = await res.json();
  const rawText = extractResponseText(data);

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI Gatewayから有効なJSON応答が得られませんでした');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * 管理者認証ヘルパー関数
 * 環境変数 ADMIN_PASSWORD またはデフォルトパスワード 'llm5admin' で照合
 */
export function verifyAdminPassword(request: Request, env: Env): boolean {
  const expectedPassword = env.ADMIN_PASSWORD || 'llm5admin';

  // 1. x-admin-password ヘッダー
  const headerKey = request.headers.get('x-admin-password');
  if (headerKey && headerKey.trim() === expectedPassword) {
    return true;
  }

  // 2. Authorization: Bearer <password>
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken === expectedPassword) {
      return true;
    }
  }

  // 3. URLクエリパラメータ (?key=... or ?password=...)
  try {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('key') || url.searchParams.get('password') || url.searchParams.get('token');
    if (queryKey && queryKey.trim() === expectedPassword) {
      return true;
    }
  } catch (_) { }

  return false;
}
