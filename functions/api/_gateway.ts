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
 * 対話履歴から各ビッグファイブ因子の言及・質問進捗を解析
 */
export function analyzeDimensionCoverage(messages: ChatMessage[]): {
  covered: Record<string, boolean>;
  uncovered: string[];
  lastAssignedDim: string | null;
} {
  const assistantTexts = messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content)
    .join('\n');
  const allTexts = messages.map(m => m.content).join('\n');

  // 各因子の特徴的なキーワード判定
  const covered: Record<string, boolean> = {
    '開放性': /(工夫|アイデア|新しい|興味|知見|試み|発想|好奇心|始めたきっかけ)/.test(allTexts),
    '誠実性': /(計画|目標|スケジュール|習慣|継続|責任|段取り|着実|ハプニング|予定の狂い)/.test(allTexts),
    '外向性': /(人|友人|仲間|チーム|周囲|社交|コミュニケーション|初対面|会話|関わる|人付き合い|自己主張)/.test(allTexts),
    '協調性': /(協力|相談|意見の相違|譲る|共感|相手の立場|対立|サポート|調和|チームワーク)/.test(allTexts),
    '情緒安定性': /(ストレス|プレッシャー|ピンチ|感情|落ち込|焦り|冷静|不安|リラックス|気分|立て直)/.test(allTexts)
  };

  const allDimensions = ['開放性', '誠実性', '外向性', '協調性', '情緒安定性'];
  const uncovered = allDimensions.filter(d => !covered[d]);

  // 直前のアシスタント発話から直前に対象としていた因子を推定
  let lastAssignedDim: string | null = null;
  const lastAssistant = messages.filter(m => m.role === 'assistant').pop()?.content || '';
  if (/(ストレス|プレッシャー|ピンチ|感情|冷静|不安|リラックス)/.test(lastAssistant)) {
    lastAssignedDim = '情緒安定性';
  } else if (/(友人|仲間|チーム|周囲|社交|コミュニケーション|初対面|人付き合い)/.test(lastAssistant)) {
    lastAssignedDim = '外向性';
  } else if (/(協力|意見の相違|譲る|調和|相手の立場)/.test(lastAssistant)) {
    lastAssignedDim = '協調性';
  } else if (/(計画|目標|スケジュール|習慣|ハプニング)/.test(lastAssistant)) {
    lastAssignedDim = '誠実性';
  } else if (/(工夫|アイデア|新しい|好奇心|試み)/.test(lastAssistant)) {
    lastAssignedDim = '開放性';
  }

  return { covered, uncovered, lastAssignedDim };
}

/**
 * Clef-flashの意思決定レスポンスを解析してAnalystStrategyを生成
 */
function parseClefFlashDecision(
  resObj: any,
  userCount: number,
  coverage?: { covered: Record<string, boolean>; uncovered: string[]; lastAssignedDim: string | null }
): AnalystStrategy | null {
  if (!resObj) return null;

  // resObjが { answers: { ... } } や { result: { ... } } の入れ子になっている場合を考慮
  const target = resObj.answers || resObj.result || resObj;
  if (!target || (target.is_ready === undefined && target.focus_dimension === undefined)) {
    return null;
  }

  const isReadyItem = target.is_ready;
  // Clef-flashの type: "noul" の場合、isReadyItem.noul に確率 (0.0〜1.0) が格納される
  const isReadyProb = typeof isReadyItem === 'number'
    ? isReadyItem
    : (typeof isReadyItem?.noul === 'number'
      ? isReadyItem.noul
      : (typeof isReadyItem?.probability === 'number'
        ? isReadyItem.probability
        : (typeof isReadyItem?.yes_probability === 'number' ? isReadyItem.yes_probability : 0)));
  const isReadyAnswer = isReadyItem === 'yes' || isReadyItem === true || isReadyItem?.answer === 'yes';
  const aiDeterminedReady = isReadyAnswer || isReadyProb >= 0.7;

  // 未測定の最重要因子（外向性・情緒安定性等）が残っている場合は、早期終了を防止
  const hasCrucialUncovered = coverage && (coverage.uncovered.includes('外向性') || coverage.uncovered.includes('情緒安定性'));
  const isReady = userCount >= MAX_USER_TURNS || (userCount >= MIN_USER_TURNS && aiDeterminedReady && !hasCrucialUncovered);

  let rawFocusDim = target.focus_dimension?.chosen
    || target.focus_dimension?.answer
    || target.focus_dimension?.choice
    || (typeof target.focus_dimension === 'string' ? target.focus_dimension : null)
    || '外向性';

  // 【重要: 因子固執防止 & 5因子均等カバレッジのスマートバランサー】
  // Clef-flashが直前と同じ因子を連続して選んだり、未測定の最重要因子がある場合はダイナミックに誘導
  let focusDim = rawFocusDim;
  if (coverage && coverage.uncovered.length > 0) {
    if (focusDim === coverage.lastAssignedDim || !coverage.uncovered.includes(focusDim)) {
      // 外向性と情緒安定性が未測定なら最優先でアサイン
      if (coverage.uncovered.includes('外向性')) {
        focusDim = '外向性';
      } else if (coverage.uncovered.includes('情緒安定性')) {
        focusDim = '情緒安定性';
      } else {
        focusDim = coverage.uncovered[0];
      }
    }
  }

  const strategyRaw = target.strategy_type?.chosen
    || target.strategy_type?.answer
    || target.strategy_type?.choice
    || (typeof target.strategy_type === 'string' ? target.strategy_type : null)
    || '対人関係のスタンス';

  const strategyMap: Record<string, string> = {
    'ハプニングへの対処': '想定外のハプニングや予定の狂いへの対処エピソード',
    '他者との協力や意見の相違': '周囲と意見が分かれた場面や協力して進めたエピソード',
    '新しい工夫や試み': '新しく試みた工夫や好奇心・関心から始めた行動',
    '対人関係のスタンス': '初対面や大人数の場、日常での対人関係のスタンス',
    '感情のコントロール': 'プレッシャーや感情の浮き沈みへのセルフコントロール'
  };

  // 因子に適合した戦略のデフォルトマッピング（不一致を補正）
  const dimensionDefaultStrategies: Record<string, string> = {
    '開放性': '新しく試みた工夫や好奇心・関心から始めた行動',
    '誠実性': '想定外のハプニングや予定の狂いへの対処エピソード',
    '外向性': '初対面や大人数の場、日常での対人関係のスタンス',
    '協調性': '周囲と意見が分かれた場面や協力して進めたエピソード',
    '情緒安定性': 'プレッシャーや感情の浮き沈みへのセルフコントロール'
  };

  const strategyChoice = (focusDim !== rawFocusDim && dimensionDefaultStrategies[focusDim])
    ? dimensionDefaultStrategies[focusDim]
    : (strategyMap[strategyRaw] || dimensionDefaultStrategies[focusDim] || strategyRaw);

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

  // 5因子のカバレッジを事前解析
  const coverage = analyzeDimensionCoverage(messages);

  // Clef-flash が要求する意思決定スキーマ (System One / Jev 互換)
  const coverageStatusText = [
    `【各因子の測定状況】`,
    `- 開放性: ${coverage.covered['開放性'] ? '測定済み（エピソードあり）' : '【未測定】'}`,
    `- 誠実性: ${coverage.covered['誠実性'] ? '測定済み（エピソードあり）' : '【未測定】'}`,
    `- 外向性: ${coverage.covered['外向性'] ? '測定済み（エピソードあり）' : '【未測定・重要】(人との関わりや日常の社交スタンス)'}`,
    `- 協調性: ${coverage.covered['協調性'] ? '測定済み（エピソードあり）' : '【未測定】'}`,
    `- 情緒安定性: ${coverage.covered['情緒安定性'] ? '測定済み（エピソードあり）' : '【未測定・重要】(トラブルやプレッシャー、感情コントロール)'}`
  ].join('\n');

  const clefState = `【対話履歴】\n${dialogueHistory}\n\nユーザー発話回数: ${userCount}回\n\n${coverageStatusText}`;
  const clefQuestions: Record<string, any> = {
    is_ready: {
      type: "noul",
      instructions: "これまでの対話から、ビッグファイブ性格診断（開放性・誠実性・外向性・協調性・情緒安定性）を客観的・精密に評価するのに必要な、ユーザーの具体的な行動エピソード（困難やハプニングへの対処、他者との関わり、新しい試みなど）が複数十分に集まりましたか？特に外向性や情緒安定性などの重要エピソードも含めて十分に語られている場合にのみyesとしてください。"
    },
    focus_dimension: {
      type: "choice",
      instructions: "次の質問で深掘りすべき、情報が最も不足しているビッグファイブ性格因子はどれですか？【重要】すでに過去の質問で取り上げた因子に固執せず、まだ具体的なエピソードが得られていない未測定の因子（特に『外向性』や『情緒安定性』）を最優先で選択してください。",
      criteria: {
        "外向性": "人との関わり、社交性、活力、チームでのスタンス、自己主張",
        "情緒安定性": "プレッシャーへの対処、ストレス耐性、冷静さ、感情のコントロール",
        "協調性": "他者への共感、思いやり、協力、意見の相違への対処",
        "開放性": "知的好奇心、新しい体験への興味、独自の工夫",
        "誠実性": "計画性、責任感、ハプニングへの着実な対処"
      }
    },
    strategy_type: {
      type: "choice",
      instructions: "その因子を測定するために尋ねるべき、最も適切な行動エピソードのシチュエーションはどれですか？",
      criteria: {
        "対人関係のスタンス": "初対面や大人数の場、チームでの役割や日常での対人関係のスタンス",
        "感情のコントロール": "プレッシャーや感情の浮き沈み、トラブルへのセルフコントロール",
        "他者との協力や意見の相違": "周囲と意見が分かれた場面や協力して進めたエピソード",
        "ハプニングへの対処": "想定外のハプニングや予定の狂いへの対処エピソード",
        "新しい工夫や試み": "新しく試みた工夫や好奇心・関心から始めた行動"
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
      const parsed = parseClefFlashDecision(aiRes, userCount, coverage);
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
      const parsed = parseClefFlashDecision(data, userCount, coverage);
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
            const hasCrucialUncovered = coverage.uncovered.includes('外向性') || coverage.uncovered.includes('情緒安定性');
            const isReady = userCount >= MAX_USER_TURNS || (userCount >= MIN_USER_TURNS && aiReady && !hasCrucialUncovered);
            let focusDim = String(jsonParsed.focus_dimension);
            if (focusDim === coverage.lastAssignedDim && coverage.uncovered.length > 0) {
              focusDim = coverage.uncovered.includes('外向性') ? '外向性' : (coverage.uncovered.includes('情緒安定性') ? '情緒安定性' : coverage.uncovered[0]);
            }
            return {
              focus_dimension: focusDim,
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

  // 3. ルールベースのフォールバック戦略（万一のAI障害時でも、全5因子をバランスよく順次質問）
  // ローテーション順: 開放性 ➔ 誠実性 ➔ 外向性 ➔ 情緒安定性 ➔ 協調性
  const orderedDimensions = ['開放性', '誠実性', '外向性', '情緒安定性', '協調性'];
  const hasCrucialUncovered = coverage.uncovered.includes('外向性') || coverage.uncovered.includes('情緒安定性');
  const isReady = userCount >= MAX_USER_TURNS || (userCount >= MIN_USER_TURNS && !hasCrucialUncovered);

  let focusDim = '外向性';
  if (coverage.uncovered.length > 0) {
    focusDim = coverage.uncovered.includes('外向性')
      ? '外向性'
      : (coverage.uncovered.includes('情緒安定性') ? '情緒安定性' : coverage.uncovered[0]);
  } else {
    focusDim = orderedDimensions[userCount % orderedDimensions.length];
  }

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
1. 【同じ話題や類似質問の蒸し返しは絶対禁止】:
   - 直前や過去にすでに質問した内容（似たような工夫や試みを再度深掘りすること）は厳禁です。同じような質問を繰り返すとユーザーが退屈してしまいます。
   - ユーザーの直前の発言に対して温かく共感・要約（1〜2文）した上で、分析官から指示された【新しい角度のシチュエーション】へとスムーズに話題を展開してください。
   - 展開の例（自然なブリッジ）:
     - 外向性へ展開: 「〜という工夫、とても興味深いです！そうした活動を進める中で、周囲の仲間やチームの人たちと関わる時は、普段どのようなスタンスでコミュニケーションを取られることが多いですか？」
     - 情緒安定性へ展開: 「そこまで情熱を持って取り組まれているのですね！ちなみに、予期せぬトラブルやプレッシャーを感じた時は、普段どのように気持ちを整えたり対処されたりしていますか？」
     - 協調性へ展開: 「なるほど！周りの方と意見が分かれたり、方針の違いがあった場面では、どのように対応された経験がありますか？」
2. 【直球のタイプ質問・二者択一は厳禁】:
   - 「あなたは〜なタイプですか？」「○○派ですか、それとも××派ですか？」といった性格の自己申告を求める質問や二択の選択肢提示は絶対に禁止です。
3. 【具体的な過去のエピソード（事実）を1つだけ聞き出す】:
   - 分析官の指示に沿って、「最近、実際に〜だった具体的な場面やエピソードはありましたか？その時どう対応されましたか？」のように、ユーザーが自分の体験した【1つの具体的な出来事・行動事実】を思い出して話したくなる形で尋ねてください。
4. 【共感と簡潔さ】:
   - 年齢や性別は開始時に入力済みのため、対話内で年齢や性別を尋ねる必要はありません。日常の活動や具体的なエピソードに集中して対話を深めてください。
   - 1回の返答は2〜3文（120〜160文字程度）で簡潔に。スマホで読みやすくフランクな言葉遣いにしてください。
5. 【分析完了時】:
   - もし分析官が「分析完了」と判断している場合は、これまでの対話に深く共感・感謝した上で「ここまでのお話であなたのパーソナリティを深く分析する準備が整いました！画面の『性格分析レポートを生成する』ボタンを押してください」と案内してください。
6. 【思考タグの出力禁止】:
   - 内部推論タグ（<thought>や<think>など）は一切出力に含めず、ユーザーへの発話文のみを直接出力してください。
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
1. 【同じ話題や類似質問の蒸し返しは絶対禁止】:
   - 直前や過去にすでに質問した内容（似たような工夫や試みを再度深掘りすること）は厳禁です。同じような質問を繰り返すとユーザーが退屈してしまいます。
   - ユーザーの直前の発言に対して温かく共感・要約（1〜2文）した上で、分析官から指示された【新しい角度のシチュエーション】へとスムーズに話題を展開してください。
   - 展開の例（自然なブリッジ）:
     - 外向性へ展開: 「〜という工夫、とても興味深いです！そうした活動を進める中で、周囲の仲間やチームの人たちと関わる時は、普段どのようなスタンスでコミュニケーションを取られることが多いですか？」
     - 情緒安定性へ展開: 「そこまで情熱を持って取り組まれているのですね！ちなみに、予期せぬトラブルやプレッシャーを感じた時は、普段どのように気持ちを整えたり対処されたりしていますか？」
     - 協調性へ展開: 「なるほど！周りの方と意見が分かれたり、方針の違いがあった場面では、どのように対応された経験がありますか？」
2. 【直球のタイプ質問・二者択一は厳禁】:
   - 「あなたは〜なタイプですか？」「○○派ですか、それとも××派ですか？」といった性格の自己申告を求める質問や二択の選択肢提示は絶対に禁止です。
3. 【具体的な過去のエピソード（事実）を1つだけ聞き出す】:
   - 分析官の指示に沿って、「最近、実際に〜だった具体的な場面やエピソードはありましたか？その時どう対応されましたか？」のように、ユーザーが自分の体験した【1つの具体的な出来事・行動事実】を思い出して話したくなる形で尋ねてください。
4. 【共感と簡潔さ】:
   - 年齢や性別は開始時に入力済みのため、対話内で年齢や性別を尋ねる必要はありません。日常の活動や具体的なエピソードに集中して対話を深めてください。
   - 1回の返答は2〜3文（120〜160文字程度）で簡潔に。スマホで読みやすくフランクな言葉遣いにしてください。
5. 【分析完了時】:
   - もし分析官が「分析完了」と判断している場合は、これまでの対話に深く共感・感謝した上で「ここまでのお話であなたのパーソナリティを深く分析する準備が整いました！画面の『性格分析レポートを生成する』ボタンを押してください」と案内してください。
6. 【思考タグの禁止】:
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
  const preferredModel = modelName || 'dynamic/llm5-analyst';
  const fallbackModel = 'dynamic/llm5';

  const dialogueHistory = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : 'インタビュアー'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `
あなたは世界最高峰のパーソナリティ心理測定（Psychometrics）専門家です。
提供された対話履歴から、ビッグファイブ主要5因子（開放性, 誠実性, 外向性, 協調性, 情緒安定性）に基づいて、心理尺度（BFI-2等）と高度に整合する精密な性格プロファイリングを行ってください。

【評価の絶対原則】
1. ユーザーの自己申告（「私は○○な性格です」等）ではなく、対話内で語られた【具体的な過去のエピソード（行動事実・出来事・周囲との関わり方・ピンチへの対処・発言のトーンや言葉数）】を唯一の根拠として客観的に評価してください。
2. 各因子のスコア(score)は0〜100（一般人口の平均50、標準偏差約15）の標準化スケールで厳密に採点してください。中庸に逃げず、対話内の具体的行動事実に基づいて大胆かつ精確にスコアリングしてください。

【各因子の客観的判定基準（BFI-2準拠）】
- openness (開放性):
  - 75〜100: 独自の強い知的好奇心、型破りな工夫、新奇な体験や未知の領域への自発的挑戦のエピソードがある。
  - 45〜74: 興味を持ったことには取り組むが、突飛なアイデアより現実的・着実な工夫を好む。
  - 0〜44: 新しいことへの挑戦を好まず、実績のある確実な手法や慣習を重視する。
- conscientiousness (誠実性):
  - 75〜100: 高い自律性、計画的な進行、ハプニングへの冷静かつ着実なリカバリーのエピソードがある。
  - 45〜74: やるべきことは着実にこなすが、状況に応じた臨機応変さや柔軟さを重視する。
  - 0〜44: 計画に縛られるのを嫌い、直感や気分で動くことが多い、衝動的。
- extraversion (外向性):
  - 75〜100: 人を巻き込むのが好き、初対面でも積極的に話しかける、他者との交流でエネルギーを得る、積極的で自己主張が明確。
  - 45〜74: 状況に応じて人と関わるが、1人の時間も同等に大切にする、聞き役に回ることも多い。
  - 0〜44: 少人数の深い関係や単独での活動を好み、大人数や過度な社交はエネルギーを消耗する、控えめで無口な傾向。
- agreeableness (協調性):
  - 75〜100: 周囲の意見に深く耳を傾ける、対立を避けて調和を最優先にする、他者への自然な配慮と支援。
  - 45〜74: 礼儀正しく協力するが、必要な時は自分の意見やこだわりを譲らない。
  - 0〜44: 調和よりも論理や成果を優先し、他者の感情に忖度しない、競争的。
- neuroticism (情緒安定性 / Emotional Stability):
  ※当アプリでは「高いほど情緒が安定・冷静でストレスに強い」という正の指標として0〜100で評価します。
  - 75〜100: トラブルや想定外の事態でもパニックにならず冷静、プレッシャーに強い、気持ちの切り替えが早く安定している。
  - 45〜74: 一時的な焦りや不安は感じるが、自分で気持ちを立て直すことができる。
  - 0〜44: プレッシャーやハプニングに強い不安・動揺・ストレスを感じやすい、気分の浮き沈みや悩みが多い。

【厳格な禁止事項】
- 「強み1」「強み2」「...」「要約テキスト」のようなプレースホルダー文字列は絶対に出力しないでください。
- すべての項目に対話履歴から読み取った具体的で固有の心理的分析・エピソードを記載してください。

必ず以下のJSON形式に厳密に従って出力してください（Markdown記法は含めず純粋なJSONのみ）:
{
  "personality_title": "対話の個性をもっとも象徴する独自のキャッチコピー",
  "personality_type": "性格タイプ名（例: 探究的イノベーター型、協調的ファシリテーター型など）",
  "summary": "対話全体から分析された全体的な人物像と個性の統合的解説（250〜400文字程度）",
  "scores": {
    "openness": {
      "score": 85,
      "level": "高い",
      "title": "知的好奇心と新しい視点",
      "description": "知的好奇心、新しいアイデアや変化に対する受容度の特徴",
      "traits": ["独創的", "探究心", "柔軟"],
      "analysis_reasoning": "対話中のどのエピソードや発言からこの開放性スコアと判定したかの具体的な心理的根拠（100〜150文字程度）"
    },
    "conscientiousness": {
      "score": 70,
      "level": "高い",
      "title": "計画性と責任感",
      "description": "目標達成に向けた自律性、計画性、細部への配慮の特徴",
      "traits": ["計画的", "着実", "自律"],
      "analysis_reasoning": "対話中のどのエピソードや対処法からこの誠実性を読み取ったかの具体的根拠（100〜150文字程度）"
    },
    "extraversion": {
      "score": 55,
      "level": "中庸",
      "title": "対人エネルギーと社交性",
      "description": "他者との関わり方、刺激への反応、エネルギーの充電方法の特徴",
      "traits": ["バランス型", "聞き上手", "自然体"],
      "analysis_reasoning": "対話のテンポや人との距離感の取り方から分析した社交性の根拠（100〜150文字程度）"
    },
    "agreeableness": {
      "score": 80,
      "level": "高い",
      "title": "共感性と調和の姿勢",
      "description": "他者への思いやり、信頼、チームや周囲との協調姿勢の特徴",
      "traits": ["協調性", "親身", "信頼"],
      "analysis_reasoning": "言葉の端々や相手への配慮、対立への姿勢から分析した根拠（100〜150文字程度）"
    },
    "neuroticism": {
      "score": 75,
      "level": "高い",
      "title": "感情のコントロールと安定性",
      "description": "ストレス耐性、困難や想定外の出来事に対する心のしなやかさの特徴",
      "traits": ["冷静", "切り替えの早さ", "安定"],
      "analysis_reasoning": "トラブルや気分への対処法から分析した感情の安定度の根拠（100〜150文字程度）"
    }
  },
  "demographics": {
    "age": null,
    "gender": null
  },
  "strengths": [
    "対話から見出された最大の強み1（具体的な行動様式を明記）",
    "対話から見出された最大の強み2（対人関係や判断の特徴を明記）",
    "対話から見出された最大の強み3（状況対応の長所を明記）"
  ],
  "growth_areas": [
    "さらなる向上のためのアドバイス1",
    "ストレスや過負荷を避けるための注意点2"
  ],
  "career_recommendations": [
    "強みが最大限発揮される環境・職務スタイル1",
    "強みが最大限発揮される環境・職務スタイル2",
    "望ましい組織文化や役割3"
  ],
  "relationship_style": "対人関係やコミュニケーションにおける固有の特徴とアドバイス（150文字程度）",
  "stress_management": "ストレスを感じやすいシチュエーションと、この人に最適なリフレッシュ法（150文字程度）",
  "llm_analysis_rationale": "対話全体からAIが読み解いた深層心理・思考プロセスの総括（対話の言葉選び、トーン、質問へのリアクションからどのように人物像を特定したかの専門的解説。200〜300文字程度）",
  "dialogue_evidence": [
    "ユーザーが対話内で語った特徴的な具体的エピソードや発言の抜粋1（該当因子と関連づけて記述）",
    "ユーザーが対話内で語った特徴的な具体的エピソードや発言の抜粋2（該当因子と関連づけて記述）",
    "ユーザーが対話内で語った特徴的な具体的エピソードや発言の抜粋3（該当因子と関連づけて記述）"
  ]
}
※ユーザーが対話内で言及した年齢（数値または年代）と性別を抽出し、demographicsに格納してください（未言及の場合はnull）。
`;

  // モデル呼び出し実行（第一候補が失敗した場合はチャット稼働モデルへ自動フォールバック）
  const tryGenerateAnalysis = async (model: string): Promise<string> => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `【対話履歴】\n${dialogueHistory}\n\n上記対話からビッグファイブ性格プロファイルをJSONで生成してください。` }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI Gateway (${model}) 分析エラー [${res.status}]: ${errText || '詳細なし'}`);
    }

    const data: any = await res.json();
    return extractResponseText(data);
  };

  let rawText = '';
  try {
    rawText = await tryGenerateAnalysis(preferredModel);
  } catch (preferredErr: any) {
    console.warn(`[runFinalAnalysis] Preferred model (${preferredModel}) failed:`, preferredErr.message);
    if (preferredModel !== fallbackModel) {
      console.log(`[runFinalAnalysis] Retrying with fallback model (${fallbackModel})...`);
      rawText = await tryGenerateAnalysis(fallbackModel);
    } else {
      throw preferredErr;
    }
  }

  // Markdownコードブロック除去とJSON抽出
  let cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.error('Invalid raw output for final analysis:', rawText);
    throw new Error('AI Gatewayから有効なJSON応答が得られませんでした');
  }

  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (parseErr: any) {
    console.error('JSON parse error in runFinalAnalysis:', parseErr, jsonStr);
    throw new Error(`分析結果JSONの構文解析に失敗しました: ${parseErr.message}`);
  }
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
