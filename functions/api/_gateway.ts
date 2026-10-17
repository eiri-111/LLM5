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
  analysis_reasoning?: string;
}

export interface ClefScoringBreakdown {
  /** 案1（メイン採用）: BFI-2-S 3ファセット平均による5因子スコア (0-100) */
  facet_mean_scores: Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number>;
  /** 案2（比較検証用）: 5因子直接質問によるスコア (0-100) */
  direct_scores: Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number>;
  /** BFI-2-S 15ファセット個別のスコア (0-100) */
  facets: {
    openness: { intellectual: number; aesthetic: number; creative: number };
    conscientiousness: { organization: number; productiveness: number; responsibility: number };
    extraversion: { sociability: number; assertiveness: number; activity: number };
    agreeableness: { compassion: number; respect: number; trust: number };
    neuroticism: { anxiety: number; depression: number; volatility: number };
  };
  source: string;
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
  clef_scoring_data?: ClefScoringBreakdown;
}

const DEFAULT_ACCOUNT_ID = 'e809b1129ec4b6f69520858ac79b2095';
const DEFAULT_GATEWAY_ID = 'llm5';

/** 対話ターン数（ユーザー発話回数）の制御基準（上限ターン制限なし・分析官AIの完了判定に委ねる） */
export const MIN_USER_TURNS = 6; // 最低ターン数（導入1ターン＋ビッグファイブ5因子＝最低6ターン）

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
 * アシスタントの質問文から、そのターンで尋ねたビッグファイブ因子を特定
 * （前半の共感文のキーワード誤爆を防ぐため、後半の疑問文・質問パートを優先判定）
 */
function detectQuestionDimension(
  assistantText: string,
  alreadyCovered?: Record<string, boolean>
): string | null {
  if (!assistantText) return null;

  // 句点や改行で分割し、疑問符（？/?）を含む文または最後の文を「質問本体」として抽出
  const sentences = assistantText
    .split(/(?<=[。！？!?\n])/)
    .map(s => s.trim())
    .filter(Boolean);
  const questionSentences = sentences.filter(s => /[？?]/.test(s));
  const primaryQuestionText = questionSentences.length > 0
    ? questionSentences.join(' ')
    : (sentences[sentences.length - 1] || assistantText);

  const dimPatterns: Array<{ dim: string; regex: RegExp }> = [
    { dim: '情緒安定性', regex: /(ストレス|プレッシャー|ピンチ|感情|落ち込|焦り|冷静|不安|リラックス|気分|立て直|悩み|浮き沈み|緊張|動じ|トラブル.*気持ち|気持ち.*切り替え|気持ち.*整)/ },
    { dim: '外向性', regex: /(友人|仲間|チーム|周囲の人|社交|コミュニケーション|初対面|会話|関わる|人付き合い|自己主張|リード|引っ張|活発|エネルギー|大人数|スタンスで.*関わ)/ },
    { dim: '協調性', regex: /(協力|相談|意見の相違|意見が分かれ|方針の違い|譲る|共感|相手の立場|対立|サポート|調和|チームワーク|思いやり|気配り|敬意|礼儀|信頼|任せる)/ },
    { dim: '誠実性', regex: /(計画|目標|スケジュール|習慣|継続|責任|段取り|着実|整理|やり通|やり抜|効率|コツコツ|準備)/ },
    { dim: '開放性', regex: /(工夫|アイデア|新しい|興味|知見|試み|発想|好奇心|創作|芸術|音楽|美術|文学|深く考|探究|独自)/ }
  ];

  // 1. まず「質問本体」の文からマッチする因子を探す（未カバー因子を優先）
  const primaryMatches = dimPatterns.filter(p => p.regex.test(primaryQuestionText)).map(p => p.dim);
  if (primaryMatches.length > 0) {
    if (alreadyCovered) {
      const uncoveredMatch = primaryMatches.find(d => !alreadyCovered[d]);
      if (uncoveredMatch) return uncoveredMatch;
    }
    return primaryMatches[0];
  }

  // 2. 質問本体でヒットしない場合は全文から探す（未カバー因子を優先）
  const fullMatches = dimPatterns.filter(p => p.regex.test(assistantText)).map(p => p.dim);
  if (fullMatches.length > 0) {
    if (alreadyCovered) {
      const uncoveredMatch = fullMatches.find(d => !alreadyCovered[d]);
      if (uncoveredMatch) return uncoveredMatch;
    }
    return fullMatches[0];
  }

  return null;
}

/**
 * 対話履歴から各ビッグファイブ因子の質問・回答進捗を解析
 * 導入挨拶（messages[0]）を除き、インタビュアーが実際に質問してユーザーが回答した因子のみを「測定済み」と判定
 */
export function analyzeDimensionCoverage(messages: ChatMessage[]): {
  covered: Record<string, boolean>;
  uncovered: string[];
  lastAssignedDim: string | null;
} {
  const allDimensions = ['開放性', '誠実性', '外向性', '協調性', '情緒安定性'];
  const covered: Record<string, boolean> = {
    '開放性': false,
    '誠実性': false,
    '外向性': false,
    '協調性': false,
    '情緒安定性': false
  };

  let lastAssignedDim: string | null = null;

  // messages[0] は最初の「素や性格がよく出る場所や場面」の挨拶なのでスキップし、
  // それ以降のインタビュアーの質問（かつその後にユーザーの回答が存在するもの）を順番に判定
  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      const hasUserReplyAfter = messages.slice(i + 1).some(m => m.role === 'user');
      const detected = detectQuestionDimension(msg.content, covered);
      if (detected) {
        lastAssignedDim = detected;
        if (hasUserReplyAfter) {
          covered[detected] = true;
        }
      }
    }
  }

  const uncovered = allDimensions.filter(d => !covered[d]);

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

  // 上限ターンによる強制終了は行わず、全5因子が測定済み（uncovered が 0）かつ最低ターン数以上で、
  // 分析官AI（Clef-flash）が「情報収集が十分」と判定した場合のみ完了とする
  const hasAnyUncovered = coverage ? coverage.uncovered.length > 0 : false;
  const isReady = userCount >= MIN_USER_TURNS && !hasAnyUncovered && aiDeterminedReady;

  let rawFocusDim = target.focus_dimension?.chosen
    || target.focus_dimension?.answer
    || target.focus_dimension?.choice
    || (typeof target.focus_dimension === 'string' ? target.focus_dimension : null)
    || '外向性';

  // 【重要: 因子固執防止 & 5因子均等カバレッジのスマートバランサー】
  // Clef-flashが直前と同じ因子を連続して選んだり、未測定の因子がある場合は確実に未測定因子へ誘導
  let focusDim = rawFocusDim;
  if (coverage && coverage.uncovered.length > 0) {
    if (focusDim === coverage.lastAssignedDim || !coverage.uncovered.includes(focusDim)) {
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
    || '社交性・主張性・活動性';

  const strategyMap: Record<string, string> = {
    '知的好奇心・美的好奇心・創造力': '新しいアイデアや工夫（創造力）、物事を深く考えることや知的探求（知的好奇心）、芸術・音楽・創作などへの関心（美的好奇心）',
    '組織化・生産性・責任感': '計画や段取り・整理整頓のスタイル（組織化）、面倒なことも最後までやり通す姿勢（生産性）、自分の役割を効率的・着実に果たす行動（責任感）',
    '社交性・主張性・活動性': '周囲との会話や関わり方（社交性）、チーム内で意見を出したりリードする場面（主張性）、日々の活動のエネルギー量や積極性（活動性）',
    '思いやり・敬意・信頼': '他者への気配りやサポート（思いやり）、意見の相違がある場面でも敬意を払い対立を避ける姿勢（敬意）、周囲の人を信じて任せるスタンス（信頼）',
    '不安・抑うつ・感情の変動': 'プレッシャーや悩みへのストレス対処（不安）、落ち込んだ時の気分の切り替え（抑うつ）、想定外のトラブルでも動じず冷静に対応する様子（感情の変動）'
  };

  // 因子に適合したBFI-2-Sファセット戦略のデフォルトマッピング（不一致を補正）
  const dimensionDefaultStrategies: Record<string, string> = {
    '開放性': strategyMap['知的好奇心・美的好奇心・創造力'],
    '誠実性': strategyMap['組織化・生産性・責任感'],
    '外向性': strategyMap['社交性・主張性・活動性'],
    '協調性': strategyMap['思いやり・敬意・信頼'],
    '情緒安定性': strategyMap['不安・抑うつ・感情の変動']
  };

  const strategyChoice = (focusDim !== rawFocusDim && dimensionDefaultStrategies[focusDim])
    ? dimensionDefaultStrategies[focusDim]
    : (strategyMap[strategyRaw] || dimensionDefaultStrategies[focusDim] || strategyRaw);

  const targetStrategy = isReady
    ? 'すべての質問が完了しました。新たな質問は一切行わず、直前の回答に温かく共感・感謝した上で、次の質問紙（BFI-2-S）へ進むよう案内してください。'
    : `${focusDim}（BFI-2-Sファセット）の特性を客観的に測定するため、対話で挙がった場面や日常の経験の中から「${strategyChoice}」についての具体的な過去の体験・エピソードを尋ねてください。`;

  return {
    focus_dimension: isReady ? '完了' : focusDim,
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

  // Clef-flash が要求する意思決定スキーマ (BFI-2-S 5因子×3ファセット準拠)
  const coverageStatusText = [
    `【BFI-2-S 各因子の測定状況】`,
    `- 開放性 (知的好奇心・美的好奇心・創造力): ${coverage.covered['開放性'] ? '測定済み（エピソードあり）' : '【未測定】'}`,
    `- 誠実性 (組織化・生産性・責任感): ${coverage.covered['誠実性'] ? '測定済み（エピソードあり）' : '【未測定】'}`,
    `- 外向性 (社交性・主張性・活動性): ${coverage.covered['外向性'] ? '測定済み（エピソードあり）' : '【未測定・重要】'}`,
    `- 協調性 (思いやり・敬意・信頼): ${coverage.covered['協調性'] ? '測定済み（エピソードあり）' : '【未測定】'}`,
    `- 情緒安定性 (不安・抑うつ・感情の変動): ${coverage.covered['情緒安定性'] ? '測定済み（エピソードあり）' : '【未測定・重要】'}`
  ].join('\n');

  const clefState = `【対話履歴】\n${dialogueHistory}\n\nユーザー発話回数: ${userCount}回\n\n${coverageStatusText}`;
  const clefQuestions: Record<string, any> = {
    is_ready: {
      type: "noul",
      instructions: "これまでの対話から、BFI-2-S準拠のビッグファイブ全5因子（開放性・誠実性・外向性・協調性・情緒安定性）すべてについて測定が完了し、各因子を精密に採点できるだけの具体的な行動エピソードが十分に集まりましたか？未測定の因子が1つでも残っている場合や、回答が短く掘り下げが不十分な因子がある場合は必ずnoとしてください。"
    },
    focus_dimension: {
      type: "choice",
      instructions: "次の質問で深掘りすべき、情報が最も不足しているBFI-2-S性格因子はどれですか？【重要】【未測定】の因子がある場合は必ず【未測定】の因子の中から選択し、全因子が測定済みの場合はまだ具体的なエピソードが浅い因子を選択してください。",
      criteria: {
        "外向性": "社交性（積極的・社交的⇔無口）、主張性（自己主張・他人をリード）、活動性（エネルギッシュ⇔控えめ・大人しい）",
        "情緒安定性": "不安（ストレス対処・リラックス⇔悩みが多い）、抑うつ（気分の安定⇔落ち込み・浮き沈み）、感情の変動（動じにくさ・冷静⇔緊張しやすい）",
        "協調性": "思いやり（優しさ・親身⇔冷淡）、敬意（礼儀正しさ・対立回避）、信頼（他者を信じる・好意的関心⇔疑いやすい）",
        "開放性": "知的好奇心（深く考える・抽象的思考）、美的好奇心（芸術・音楽・文学への関心）、創造力（独創的・新しいアイデア）",
        "誠実性": "組織化（計画的・整理整頓⇔行き当たりばったり）、生産性（怠けず最後までやり通す）、責任感（頼りになる・効率的にこなす）"
      }
    },
    strategy_type: {
      type: "choice",
      instructions: "その因子のBFI-2-Sファセットを測定するために尋ねるべき、最も適切な行動エピソードの切り口はどれですか？",
      criteria: {
        "社交性・主張性・活動性": "周囲との会話や関わり方（社交性）、チーム内で意見を出したりリードする場面（主張性）、日々の活動のエネルギー量や積極性（活動性）",
        "不安・抑うつ・感情の変動": "プレッシャーや悩みへのストレス対処（不安）、落ち込んだ時の気分の切り替え（抑うつ）、想定外のトラブルでも動じず冷静に対応する様子（感情の変動）",
        "思いやり・敬意・信頼": "他者への気配りやサポート（思いやり）、意見の相違がある場面でも敬意を払い対立を避ける姿勢（敬意）、周囲の人を信じて任せるスタンス（信頼）",
        "組織化・生産性・責任感": "計画や段取り・整理整頓のスタイル（組織化）、面倒なことも最後までやり通す姿勢（生産性）、自分の役割を効率的・着実に果たす行動（責任感）",
        "知的好奇心・美的好奇心・創造力": "新しいアイデアや工夫（創造力）、物事を深く考えることや知的探求（知的好奇心）、芸術・音楽・創作などへの関心（美的好奇心）"
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

  // 2. HTTP fetch (AI Gateway Workers AI エンドポイント経由で @cf/cloudflare/clef-flash を直接呼び出し)
  try {
    const endpoint = getGatewayWorkersAiUrl(env, '@cf/cloudflare/clef-flash');
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
    } else {
      const errText = await res.text();
      console.warn(`Clef-flash HTTP route returned status ${res.status}:`, errText);
    }
  } catch (err) {
    console.error('Clef-flash HTTP fetch error:', err);
  }

  // 3. ルールベースのフォールバック戦略（万一のClef-flash通信障害時は強制終了せず、未測定・ローテーション因子を質問継続）
  const orderedDimensions = ['開放性', '誠実性', '外向性', '情緒安定性', '協調性'];
  const isReady = false;

  let focusDim = '外向性';
  if (coverage.uncovered.length > 0) {
    focusDim = coverage.uncovered.includes('外向性')
      ? '外向性'
      : (coverage.uncovered.includes('情緒安定性') ? '情緒安定性' : coverage.uncovered[0]);
  } else {
    focusDim = orderedDimensions[userCount % orderedDimensions.length];
  }

  const strategyDetails: Record<string, string> = {
    '開放性': '新しいアイデアや工夫（創造力）、物事を深く考えることや知的探求（知的好奇心）、芸術・音楽・創作などへの関心（美的好奇心）',
    '誠実性': '計画や段取り・整理整頓のスタイル（組織化）、面倒なことも最後までやり通す姿勢（生産性）、自分の役割を効率的・着実に果たす行動（責任感）',
    '外向性': '周囲との会話や関わり方（社交性）、チーム内で意見を出したりリードする場面（主張性）、日々の活動のエネルギー量や積極性（活動性）',
    '協調性': '他者への気配りやサポート（思いやり）、意見の相違がある場面でも敬意を払い対立を避ける姿勢（敬意）、周囲の人を信じて任せるスタンス（信頼）',
    '情緒安定性': 'プレッシャーや悩みへのストレス対処（不安）、落ち込んだ時の気分の切り替え（抑うつ）、想定外のトラブルでも動じず冷静に対応する様子（感情の変動）'
  };
  const detail = strategyDetails[focusDim] || '具体的な行動エピソード';

  return {
    focus_dimension: focusDim,
    target_question_strategy: `${focusDim}（BFI-2-Sファセット）の特性を客観的に測定するため、対話で挙がった場面や日常の経験の中から「${detail}」についての具体的な過去の体験・エピソードを尋ねてください。`,
    is_ready_for_final_analysis: isReady,
    notes: 'Rule-based fallback strategy (continue questioning)'
  };
}

/**
 * インタビュアーAI用のシステムプロンプトを生成
 * 対話継続中（isReady === false）と対話完了時（isReady === true）で指示を完全に分離し、
 * 「質問の途中で質問紙に誘導される」「完了案内しながらさらに質問してしまう」矛盾を防止する
 */
function buildInterviewerInstruction(strategy: AnalystStrategy): string {
  const isReady = strategy.is_ready_for_final_analysis;
  const focusDimension = strategy.focus_dimension || '行動特性';
  const targetStrategy = strategy.target_question_strategy || 'これまでの活動や具体的な行動エピソードについて尋ねる';

  if (isReady) {
    return `
あなたはプロフェッショナルな性格分析インタビュアーです。
これまでの対話で、ビッグファイブ全5因子のエピソード収集がすべて完了しました。

【あなたのタスク（対話完了の締めくくり）】
1. ユーザーの直前の発言に対して、温かく具体的に共感・要約（1〜2文）してください。
2. 【重要・追加質問の絶対禁止】: これ以上、新しい質問や問いかけ（「〜ですか？」「〜ありましたか？」など）は絶対にしないでください。疑問符（？）も使わないでください。
3. 最後に、「ここまでたくさんの素敵なお話を聞かせていただき、ありがとうございました！対話セッションはこれで完了です。画面下のボタンから、次のステップ『質問紙（BFI-2-S）』へお進みください。」と案内して締めくくってください。
4. 思考プロセスや内部推論（<thought>や<think>タグなど）は一切出力に含めず、ユーザーへの発話文のみを直接出力してください。
`;
  }

  return `
裏方の分析官から以下の指示（戦略）が届いています:
【分析官の指示】:
- 狙う因子: ${focusDimension}
- 質問の方向性: ${targetStrategy}

【対話・質問の絶対ルール】
1. 必ず敬語を使用してください
`;
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
  const interviewerInstruction = buildInterviewerInstruction(strategy);

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
      // 1. 初期メタデータを送信（ストリーミング途中で完了ボタンが出ないよう is_ready_for_analysis は done イベントのみで確定）
      const metaData = JSON.stringify({
        type: 'meta',
        strategy_focus: strategy.focus_dimension,
        is_ready_for_analysis: false
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
  const interviewerInstruction = buildInterviewerInstruction(strategy);

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
 * Clef-flashの type: "noul" 出力から 0〜100 の整数スコアを抽出
 */
function extractClefNoulScore(item: any): number | null {
  if (item === undefined || item === null) return null;
  const prob = typeof item === 'number'
    ? item
    : (typeof item?.noul === 'number'
      ? item.noul
      : (typeof item?.probability === 'number'
        ? item.probability
        : (typeof item?.yes_probability === 'number' ? item.yes_probability : null)));
  if (prob === null || isNaN(prob)) return null;
  const scaled = prob <= 1.0 ? prob * 100 : prob;
  return Math.min(100, Math.max(0, Math.round(scaled)));
}

function scoreToLevelLabel(score: number): string {
  if (score >= 70) return '高い';
  if (score >= 45) return '中庸';
  return '控えめ';
}

function parseClefScoringResponse(rawObj: any, sourceLabel: string): ClefScoringBreakdown | null {
  if (!rawObj) return null;
  const target = rawObj.answers || rawObj.result || rawObj;
  if (!target || typeof target !== 'object') return null;

  // 案1: 15ファセット (5因子 × 3ファセット)
  const o_int = extractClefNoulScore(target.facet_openness_intellectual);
  const o_aes = extractClefNoulScore(target.facet_openness_aesthetic);
  const o_cre = extractClefNoulScore(target.facet_openness_creative);

  const c_org = extractClefNoulScore(target.facet_conscientiousness_organization);
  const c_prd = extractClefNoulScore(target.facet_conscientiousness_productiveness);
  const c_res = extractClefNoulScore(target.facet_conscientiousness_responsibility);

  const e_soc = extractClefNoulScore(target.facet_extraversion_sociability);
  const e_ass = extractClefNoulScore(target.facet_extraversion_assertiveness);
  const e_act = extractClefNoulScore(target.facet_extraversion_activity);

  const a_com = extractClefNoulScore(target.facet_agreeableness_compassion);
  const a_rsp = extractClefNoulScore(target.facet_agreeableness_respect);
  const a_trs = extractClefNoulScore(target.facet_agreeableness_trust);

  const n_anx = extractClefNoulScore(target.facet_neuroticism_anxiety);
  const n_dep = extractClefNoulScore(target.facet_neuroticism_depression);
  const n_vol = extractClefNoulScore(target.facet_neuroticism_volatility);

  // 案2: 5因子直接採点
  const d_o = extractClefNoulScore(target.direct_openness);
  const d_c = extractClefNoulScore(target.direct_conscientiousness);
  const d_e = extractClefNoulScore(target.direct_extraversion);
  const d_a = extractClefNoulScore(target.direct_agreeableness);
  const d_n = extractClefNoulScore(target.direct_neuroticism);

  // 少なくとも主要ファセットまたは直接スコアが取得できているか検証
  if (o_int === null && d_o === null) {
    return null;
  }

  const avg3 = (v1: number | null, v2: number | null, v3: number | null, fallback: number): number => {
    const valid = [v1, v2, v3].filter((v): v is number => v !== null);
    if (valid.length === 0) return fallback;
    return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
  };

  const facetMeanScores = {
    openness: avg3(o_int, o_aes, o_cre, d_o ?? 50),
    conscientiousness: avg3(c_org, c_prd, c_res, d_c ?? 50),
    extraversion: avg3(e_soc, e_ass, e_act, d_e ?? 50),
    agreeableness: avg3(a_com, a_rsp, a_trs, d_a ?? 50),
    neuroticism: avg3(n_anx, n_dep, n_vol, d_n ?? 50)
  };

  const directScores = {
    openness: d_o ?? facetMeanScores.openness,
    conscientiousness: d_c ?? facetMeanScores.conscientiousness,
    extraversion: d_e ?? facetMeanScores.extraversion,
    agreeableness: d_a ?? facetMeanScores.agreeableness,
    neuroticism: d_n ?? facetMeanScores.neuroticism
  };

  return {
    facet_mean_scores: facetMeanScores,
    direct_scores: directScores,
    facets: {
      openness: {
        intellectual: o_int ?? facetMeanScores.openness,
        aesthetic: o_aes ?? facetMeanScores.openness,
        creative: o_cre ?? facetMeanScores.openness
      },
      conscientiousness: {
        organization: c_org ?? facetMeanScores.conscientiousness,
        productiveness: c_prd ?? facetMeanScores.conscientiousness,
        responsibility: c_res ?? facetMeanScores.conscientiousness
      },
      extraversion: {
        sociability: e_soc ?? facetMeanScores.extraversion,
        assertiveness: e_ass ?? facetMeanScores.extraversion,
        activity: e_act ?? facetMeanScores.extraversion
      },
      agreeableness: {
        compassion: a_com ?? facetMeanScores.agreeableness,
        respect: a_rsp ?? facetMeanScores.agreeableness,
        trust: a_trs ?? facetMeanScores.agreeableness
      },
      neuroticism: {
        anxiety: n_anx ?? facetMeanScores.neuroticism,
        depression: n_dep ?? facetMeanScores.neuroticism,
        volatility: n_vol ?? facetMeanScores.neuroticism
      }
    },
    source: sourceLabel
  };
}

/**
 * ステップ3-A: Clef-flash (@cf/cloudflare/clef-flash) による20問同時スコアリング
 * 1回のAPIリクエストで「案1: BFI-2-Sの15ファセット（15問）」と「案2: 5因子直接質問（5問）」の計20問を同時数値化する。
 * - メイン採用スコア: 案1（各因子3ファセットの平均×100）
 * - バックグラウンド検証用記録: 案2（5因子直接採点×100）および15ファセット個別得点
 */
export async function runClefScoring(
  env: Env,
  dialogueHistory: string
): Promise<ClefScoringBreakdown | null> {
  const scoringState = `【対話履歴】\n${dialogueHistory}\n\n上記の対話履歴におけるユーザーの具体的な行動事実・エピソード・発言スタイルから、BFI-2-S（ビッグファイブ尺度）の各下位ファセットおよび5因子を客観的に評価してください。`;

  const scoringQuestions: Record<string, { type: 'noul'; instructions: string }> = {
    // === 案1: BFI-2-S 15ファセット（5因子 × 3ファセット = 15問） ===
    // 1. 開放性 (Openness)
    facet_openness_intellectual: {
      type: 'noul',
      instructions: '【開放性 - 知的好奇心】対話から、このユーザーは抽象的な知識や概念に関心があり、物事を複雑かつ深く考える（知的好奇心が高い）人物だと評価できますか？'
    },
    facet_openness_aesthetic: {
      type: 'noul',
      instructions: '【開放性 - 美的好奇心】対話から、このユーザーは芸術や音楽、文学、デザイン、美的・文化的な体験に強い魅力や関心を感じる（美的好奇心が高い）人物だと評価できますか？'
    },
    facet_openness_creative: {
      type: 'noul',
      instructions: '【開放性 - 創造力】対話から、このユーザーは独創的で、新しいアイデアや独自の工夫を思いついて実践する（創造力が高い）人物だと評価できますか？'
    },

    // 2. 誠実性 (Conscientiousness)
    facet_conscientiousness_organization: {
      type: 'noul',
      instructions: '【誠実性 - 組織化】対話から、このユーザーは行き当たりばったりではなく、物事をきちんと整理整頓し計画的・段取りよく進める（組織化が高い）人物だと評価できますか？'
    },
    facet_conscientiousness_productiveness: {
      type: 'noul',
      instructions: '【誠実性 - 生産性】対話から、このユーザーは怠けたり途中で投げ出したりせず、やるべき物事を最後までやり通す（生産性・継続力が高い）人物だと評価できますか？'
    },
    facet_conscientiousness_responsibility: {
      type: 'noul',
      instructions: '【誠実性 - 責任感】対話から、このユーザーは周囲から信頼されて頼りになり、自分の役割や課題を効率的かつ着実にこなす（責任感が高い）人物だと評価できますか？'
    },

    // 3. 外向性 (Extraversion)
    facet_extraversion_sociability: {
      type: 'noul',
      instructions: '【外向性 - 社交性】対話から、このユーザーは無口で引っ込み思案ではなく、人と関わったり会話したりすることに積極的で社交的な（社交性が高い）人物だと評価できますか？'
    },
    facet_extraversion_assertiveness: {
      type: 'noul',
      instructions: '【外向性 - 主張性】対話から、このユーザーは堂々としていて自己主張ができ、集団やチームの中で他人をリードするのが得意な（主張性が高い）人物だと評価できますか？'
    },
    facet_extraversion_activity: {
      type: 'noul',
      instructions: '【外向性 - 活動性】対話から、このユーザーは控えめで大人しいタイプではなく、いつもエネルギーに満ちて活発に行動している（活動性が高い）人物だと評価できますか？'
    },

    // 4. 協調性 (Agreeableness)
    facet_agreeableness_compassion: {
      type: 'noul',
      instructions: '【協調性 - 思いやり】対話から、このユーザーは冷淡ではなく、他人への思いやりがあり親身で優しい（思いやりが高い）人物だと評価できますか？'
    },
    facet_agreeableness_respect: {
      type: 'noul',
      instructions: '【協調性 - 敬意】対話から、このユーザーは他人と対立や揉め事を起こさず、誰に対しても礼儀正しく敬意を払って穏やかに接する（敬意が高い）人物だと評価できますか？'
    },
    facet_agreeableness_trust: {
      type: 'noul',
      instructions: '【協調性 - 信頼】対話から、このユーザーは他人を疑ったり冷たく無関心になったりせず、周囲の人を信頼して好意的に関わる（信頼が高い）人物だと評価できますか？'
    },

    // 5. 情緒安定性 (Emotional Stability / 逆転済みのNeuroticism)
    facet_neuroticism_anxiety: {
      type: 'noul',
      instructions: '【情緒安定性 - 不安の低さ・ストレス対処】対話から、このユーザーは多くの悩みごとを抱え込まず、リラックスしていてストレスやプレッシャーにうまく対処できている人物だと評価できますか？'
    },
    facet_neuroticism_depression: {
      type: 'noul',
      instructions: '【情緒安定性 - 抑うつの低さ・気分の安定】対話から、このユーザーは落ち込んだり憂鬱になったりしにくく、気分の浮き沈みが少なく安定している人物だと評価できますか？'
    },
    facet_neuroticism_volatility: {
      type: 'noul',
      instructions: '【情緒安定性 - 感情変動の低さ・冷静さ】対話から、このユーザーは過度な不安や緊張を感じにくく、トラブル時でも情緒が安定していて動じにくい冷静な人物だと評価できますか？'
    },

    // === 案2: 5因子直接採点（比較検証用 = 5問） ===
    direct_openness: {
      type: 'noul',
      instructions: '【5因子直接評価 - 開放性】対話全体から、このユーザーの『開放性（知的好奇心・美的好奇心・創造力）』は総合的に見て高いと評価できますか？'
    },
    direct_conscientiousness: {
      type: 'noul',
      instructions: '【5因子直接評価 - 誠実性】対話全体から、このユーザーの『誠実性（組織化・生産性・責任感）』は総合的に見て高いと評価できますか？'
    },
    direct_extraversion: {
      type: 'noul',
      instructions: '【5因子直接評価 - 外向性】対話全体から、このユーザーの『外向性（社交性・主張性・活動性）』は総合的に見て高いと評価できますか？'
    },
    direct_agreeableness: {
      type: 'noul',
      instructions: '【5因子直接評価 - 協調性】対話全体から、このユーザーの『協調性（思いやり・敬意・信頼）』は総合的に見て高いと評価できますか？'
    },
    direct_neuroticism: {
      type: 'noul',
      instructions: '【5因子直接評価 - 情緒安定性】対話全体から、このユーザーの『情緒安定性（ストレス耐性・気分の安定・動じにくさ）』は総合的に見て高いと評価できますか？'
    }
  };

  // 1. Workers AI バインディング (env.AI) を優先使用
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const aiRes: any = await env.AI.run(
        '@cf/cloudflare/clef-flash',
        {
          state: scoringState,
          questions: scoringQuestions
        },
        {
          gateway: {
            id: env.CF_GATEWAY_ID || DEFAULT_GATEWAY_ID,
            skipCache: false
          }
        }
      );
      const parsed = parseClefScoringResponse(aiRes, 'clef-flash [env.AI binding]');
      if (parsed) return parsed;
    } catch (aiErr: any) {
      console.warn('[runClefScoring] env.AI.run warning, falling back to HTTP fetch:', aiErr?.message || aiErr);
    }
  }

  // 2. HTTP Gateway 経由で @cf/cloudflare/clef-flash を呼び出し
  try {
    const endpoint = getGatewayWorkersAiUrl(env, '@cf/cloudflare/clef-flash');
    const headers = getGatewayHeaders(env);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        state: scoringState,
        questions: scoringQuestions
      })
    });

    if (res.ok) {
      const data: any = await res.json();
      const parsed = parseClefScoringResponse(data, 'clef-flash [HTTP Gateway]');
      if (parsed) return parsed;
    } else {
      const errText = await res.text();
      console.warn(`[runClefScoring] HTTP route returned status ${res.status}:`, errText);
    }
  } catch (err) {
    console.error('[runClefScoring] HTTP fetch error:', err);
  }

  return null;
}

/**
 * ステップ3-B: 最終性格分析レポート生成 (Route: dynamic/llm5-analyst ※Gemini)
 * Clef-flashで算出した確定スコア（案1: 15ファセット平均）と対話履歴を渡し、解説文章JSONを生成する
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

  // 1. まず Clef-flash で20問（案1: 15ファセット + 案2: 5因子直接）を同時数値化
  const clefScores = await runClefScoring(env, dialogueHistory);

  const confirmedScoresBlock = clefScores
    ? `
【Clef-flash により算出・確定済みのBFI-2-Sスコア（変更厳禁）】
以下の5因子スコア（各3ファセットの平均×100）が確定値です。JSON出力の score には必ずこの数値をそのまま設定してください：
- openness (開放性): 確定スコア ${clefScores.facet_mean_scores.openness}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.openness)}")
  [内訳: 知的好奇心=${clefScores.facets.openness.intellectual}, 美的好奇心=${clefScores.facets.openness.aesthetic}, 創造力=${clefScores.facets.openness.creative}]
- conscientiousness (誠実性): 確定スコア ${clefScores.facet_mean_scores.conscientiousness}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.conscientiousness)}")
  [内訳: 組織化=${clefScores.facets.conscientiousness.organization}, 生産性=${clefScores.facets.conscientiousness.productiveness}, 責任感=${clefScores.facets.conscientiousness.responsibility}]
- extraversion (外向性): 確定スコア ${clefScores.facet_mean_scores.extraversion}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.extraversion)}")
  [内訳: 社交性=${clefScores.facets.extraversion.sociability}, 主張性=${clefScores.facets.extraversion.assertiveness}, 活動性=${clefScores.facets.extraversion.activity}]
- agreeableness (協調性): 確定スコア ${clefScores.facet_mean_scores.agreeableness}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.agreeableness)}")
  [内訳: 思いやり=${clefScores.facets.agreeableness.compassion}, 敬意=${clefScores.facets.agreeableness.respect}, 信頼=${clefScores.facets.agreeableness.trust}]
- neuroticism (情緒安定性): 確定スコア ${clefScores.facet_mean_scores.neuroticism}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.neuroticism)}")
  [内訳: 不安の低さ(ストレス対処)=${clefScores.facets.neuroticism.anxiety}, 抑うつの低さ(気分の安定)=${clefScores.facets.neuroticism.depression}, 感情変動の低さ(動じにくさ)=${clefScores.facets.neuroticism.volatility}]
`
    : `
※万一事前スコアが存在しない場合は、BFI-2-Sの5因子×3ファセット基準に基づき0〜100で採点してください。
`;

  const systemPrompt = `
あなたは世界最高峰のパーソナリティ心理測定（Psychometrics）専門家です。
すでに専用の意思決定・心理測定モデル（Clef-flash）によって、対話履歴からBFI-2-S（ビッグファイブ尺度）の15ファセットおよび主要5因子（開放性, 誠実性, 外向性, 協調性, 情緒安定性）の数値スコアが算出・確定されています。

あなたの役割は、新たに点数を採点し直すことではなく、【確定した数値スコア（およびファセット内訳）】と【対話履歴で語られた具体的なエピソード・行動事実】を結びつけて、説得力のある詳細なパーソナリティ分析レポート（文章）をJSON形式で執筆することです。
${confirmedScoresBlock}

【執筆の絶対原則】
1. 確定スコア（0〜100点）と内訳の高低に合わせて、対話内で語られた具体的なエピソード（行動事実・出来事・周囲との関わり方・発言のトーン）を根拠として引用しながら解説文を作成してください。
2. neuroticism（情緒安定性 / Emotional Stability）は、「高いほど情緒が安定・冷静でストレスに強い」という正の指標（0〜100）として解説してください。
3. 「強み1」「強み2」「...」「要約テキスト」のようなプレースホルダー文字列は絶対に出力せず、すべて対話履歴に即した固有の分析文を記述してください。

必ず以下のJSON形式に厳密に従って出力してください（Markdown記法は含めず純粋なJSONのみ）:
{
  "personality_title": "対話の個性とスコア分布をもっとも象徴する独自のキャッチコピー",
  "personality_type": "性格タイプ名（例: 探究的イノベーター型、協調的ファシリテーター型など）",
  "summary": "確定スコアと対話全体から分析された全体的な人物像と個性の統合的解説（250〜400文字程度）",
  "scores": {
    "openness": {
      "score": ${clefScores ? clefScores.facet_mean_scores.openness : 75},
      "level": "${clefScores ? scoreToLevelLabel(clefScores.facet_mean_scores.openness) : '高い'}",
      "title": "知的好奇心・美的好奇心・創造力",
      "description": "知的好奇心、美的関心、新しいアイデアや工夫に対する特徴",
      "traits": ["特徴語1", "特徴語2", "特徴語3"],
      "analysis_reasoning": "対話中のどのエピソードや発言からこの開放性スコアとなったかの具体的な心理的根拠（100〜150文字程度）"
    },
    "conscientiousness": {
      "score": ${clefScores ? clefScores.facet_mean_scores.conscientiousness : 70},
      "level": "${clefScores ? scoreToLevelLabel(clefScores.facet_mean_scores.conscientiousness) : '高い'}",
      "title": "組織化・生産性・責任感",
      "description": "計画的な整理、最後までやり通す生産性、役割を果たす責任感の特徴",
      "traits": ["特徴語1", "特徴語2", "特徴語3"],
      "analysis_reasoning": "対話中のどのエピソードや行動からこの誠実性スコアとなったかの具体的根拠（100〜150文字程度）"
    },
    "extraversion": {
      "score": ${clefScores ? clefScores.facet_mean_scores.extraversion : 60},
      "level": "${clefScores ? scoreToLevelLabel(clefScores.facet_mean_scores.extraversion) : '中庸'}",
      "title": "社交性・主張性・活動性",
      "description": "他者との社交スタンス、自己主張やリーダーシップ、日々の活動エネルギーの特徴",
      "traits": ["特徴語1", "特徴語2", "特徴語3"],
      "analysis_reasoning": "対話のエピソードや人との関わり方からこの外向性スコアとなった具体的根拠（100〜150文字程度）"
    },
    "agreeableness": {
      "score": ${clefScores ? clefScores.facet_mean_scores.agreeableness : 75},
      "level": "${clefScores ? scoreToLevelLabel(clefScores.facet_mean_scores.agreeableness) : '高い'}",
      "title": "思いやり・敬意・信頼",
      "description": "他者への思いやり、礼儀正しさと対立回避、周囲への信頼姿勢の特徴",
      "traits": ["特徴語1", "特徴語2", "特徴語3"],
      "analysis_reasoning": "対話内の相手への配慮や協力姿勢からこの協調性スコアとなった具体的根拠（100〜150文字程度）"
    },
    "neuroticism": {
      "score": ${clefScores ? clefScores.facet_mean_scores.neuroticism : 70},
      "level": "${clefScores ? scoreToLevelLabel(clefScores.facet_mean_scores.neuroticism) : '高い'}",
      "title": "ストレス耐性・気分の安定・冷静さ",
      "description": "不安やストレスへの対処、気分の安定性、トラブル時の動じにくさの特徴",
      "traits": ["特徴語1", "特徴語2", "特徴語3"],
      "analysis_reasoning": "プレッシャーや気分への対処エピソードからこの情緒安定性スコアとなった具体的根拠（100〜150文字程度）"
    }
  },
  "demographics": {
    "age": null,
    "gender": null
  },
  "strengths": [
    "対話とスコアから見出された最大の強み1（具体的な行動様式を明記）",
    "対話とスコアから見出された最大の強み2（対人関係や判断の特徴を明記）",
    "対話とスコアから見出された最大の強み3（状況対応の長所を明記）"
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
  "llm_analysis_rationale": "対話全体とBFI-2-Sファセットスコアから読み解いた深層心理・思考プロセスの総括（200〜300文字程度）",
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
          { role: 'user', content: `【対話履歴】\n${dialogueHistory}\n\n${confirmedScoresBlock}\n上記の確定スコアと対話履歴に基づき、性格分析レポートをJSONで生成してください。` }
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
    const parsedResult: AnalysisResult = JSON.parse(jsonStr);

    // Clef-flashの確定スコア（案1：3ファセット平均）をプログラム側で厳密に保証し、
    // 比較検証用データ（案1の15ファセット＆平均スコア＋案2の5因子直接スコア）を同梱する
    if (clefScores && parsedResult.scores) {
      const dims: Array<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism'> = [
        'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'
      ];
      for (const dim of dims) {
        if (parsedResult.scores[dim]) {
          const confirmedScore = clefScores.facet_mean_scores[dim];
          parsedResult.scores[dim].score = confirmedScore;
          parsedResult.scores[dim].level = scoreToLevelLabel(confirmedScore);
        }
      }
      parsedResult.clef_scoring_data = clefScores;
    }

    return parsedResult;
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
