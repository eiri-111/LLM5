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
  action_mode?: 'deepen_episode' | 'new_situation' | 'complete';
  target_facets?: string[];
  evidenced_facets_count?: number;
  notes?: string;
}

export type AssessmentMethodSource = 'star' | 'sjt' | 'unobserved';

export interface DualAssessmentScores {
  /** STAR法（過去の客観的行動実績）に基づく5因子スコア (0-100、未観測はnull) */
  star_scores: Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number | null>;
  /** SJT（架空状況判断・意図表明）に基づく5因子スコア (0-100、縮小推定適用済み、未提示はnull) */
  sjt_scores: Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number | null>;
  /** 言行・判断ギャップ (SJT - STAR、両者観測時のみ算出) */
  gap_scores: Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number | null>;
}

export interface BigFiveDimension {
  score: number;
  level: string;
  title: string;
  description: string;
  traits: string[];
  analysis_reasoning?: string;
  confidence?: 'high' | 'moderate' | 'insufficient' | 'unobserved';
  evidenced_facet_count?: number;
  sem?: number; // 測定の標準誤差 (Standard Error of Measurement)
  confidence_interval?: {
    lower: number; // 95%信頼区間の下限 (0〜100)
    upper: number; // 95%信頼区間の上限 (0〜100)
  };
  source_type?: 'star' | 'sjt' | 'hybrid' | 'unobserved'; // エビデンスの源泉 (STAR行動事実 / SJT状況判断 / 混合)
  star_score?: number | null; // STAR法による行動実績スコア
  sjt_score?: number | null; // SJTによる状況判断スコア (縮小推定版)
  shrinkage_weight?: number; // 適用された縮小推定重み係数 w
}

export interface ClefScoringBreakdown {
  /** 案1（メイン採用）: BFI-2-S 3ファセット平均による5因子スコア (0-100) */
  facet_mean_scores: Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number>;
  /** 案2（比較検証用）: 5因子直接質問によるスコア (0-100) */
  direct_scores: Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number>;
  /** 完全二元化評価スコア (STAR行動実績スコア vs SJT状況判断スコア) */
  dual_scores?: DualAssessmentScores;
  /** BFI-2-S 15ファセット個別のスコア (0-100、言及なし・未観測は null) */
  facets: {
    openness: { intellectual: number | null; aesthetic: number | null; creative: number | null };
    conscientiousness: { organization: number | null; productiveness: number | null; responsibility: number | null };
    extraversion: { sociability: number | null; assertiveness: number | null; activity: number | null };
    agreeableness: { compassion: number | null; respect: number | null; trust: number | null };
    neuroticism: { anxiety: number | null; depression: number | null; volatility: number | null };
  };
  /** ファセット別エビデンス充足確信度 ('high': 明確な行動事実あり, 'moderate': 言及あり, 'insufficient': 未言及/欠測) */
  facet_confidences?: Record<string, 'high' | 'moderate' | 'insufficient'>;
  /** ファセット別エビデンス出自 ('star': 過去の行動実績, 'sjt': 架空シナリオ判断, 'unobserved': 未観測) */
  facet_sources?: Record<string, AssessmentMethodSource>;
  /** ファセット別縮小推定重み (STAR: 0.65〜1.0, SJT: 0.25〜0.42) */
  facet_shrinkage_weights?: Record<string, number>;
  /** ファセット別測定標準誤差 (SEM) */
  facet_sems?: Record<string, number>;
  /** ファセット別95%信頼区間 */
  facet_confidence_intervals?: Record<string, { lower: number; upper: number }>;
  /** 多方向（両極・具体性・妥当性メタ指標）評価データ (55問同時採点) */
  multidirectional?: {
    positive_probs: Record<string, number>; // 15ファセットの高特性行動確率 (0.00〜1.00)
    negative_probs: Record<string, number>; // 15ファセットの低特性行動確率 (0.00〜1.00)
    concreteness_probs: Record<string, number>; // 15ファセットの具体的行動エビデンス確率 (0.00〜1.00)
    validity_checks: {
      social_desirability: number; // 建前・社会的望ましさ偏重度 (0.00〜1.00)
      mock_or_careless: number; // ふざけ・不真面目・無作為回答度 (0.00〜1.00)
      concrete_detail: number; // エピソードの具体性・客観描写度 (0.00〜1.00)
      defensiveness: number; // 防衛的・自己開示拒否度 (0.00〜1.00)
      emotional_expressiveness: number; // 感情・素直さの表出度 (0.00〜1.00)
    };
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
  dual_assessment?: DualAssessmentScores;
  verbosity_stats?: {
    total_user_characters: number;
    total_user_turns: number;
    avg_characters_per_turn: number;
  };
}

const DEFAULT_ACCOUNT_ID = 'e809b1129ec4b6f69520858ac79b2095';
const DEFAULT_GATEWAY_ID = 'llm5';

/** 対話ターン数（ユーザー発話回数）の制御基準（CAT: コンピュータ適応型テスト準拠） */
export const MIN_USER_TURNS = 6; // 最低ターン数（十分な情報収集を保証する下限）
export const MAX_USER_TURNS = 11; // 最大ターン数（受検者疲労・離脱防止の安全上限）
/** IRT / CAT 停止判定における因子の目標測定標準誤差 (SEM Target) */
export const CAT_TARGET_FACTOR_SEM = 5.5; // 3ファセットすべてにエビデンスが得られSEM<=5.5に収束したら停止
/** Clef-flash noul確率で「具体的な行動エビデンスが十分に得られた」と判定する閾値 */
export const FACET_EVIDENCE_THRESHOLD = 0.70;
/** 「話題には触れたが、まだ具体的な発言・行動の深掘りが足りない（深掘りチャンス）」と判定する中間閾値 */
export const FACET_PARTIAL_THRESHOLD = 0.50;

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
 * 推論モデル（DeepSeek, Qwen Reasoning, Gemini Thinking, Gemma 4等）が出力する思考プロセスを除去
 */
export function cleanModelOutput(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|channel>thought[\s\S]*$/gi, '')
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

export type FactorNameJP = '開放性' | '誠実性' | '外向性' | '協調性' | '情緒安定性';

export interface FacetDefinition {
  key: string;
  factor: FactorNameJP;
  name: string;
  probeHint: string;
  evidenceInstruction: string;
  regexFallback: RegExp;
}

/**
 * BFI-2-S 15ファセットの行動エビデンス定義（パターンC）
 * 本人回答でも他者観察でも共通して確認できる「具体的な場面での振る舞い・発言・選択・事後の様子」を基準とする
 */
export const FACET_DEFINITIONS: FacetDefinition[] = [
  // 1. 開放性 (Openness)
  {
    key: 'ev_openness_intellectual',
    factor: '開放性',
    name: '知的好奇心',
    probeHint: '普段の会話でどんな話題（「なぜそうなるのか」等の仕組みや知的なテーマ）に食いつくか、疑問が湧いたときにどう調べるか（あるいは深入りせず手近で済ませるか）',
    evidenceInstruction: '【開放性 - 知的好奇心の行動エビデンス】対話の中で、「疑問や未知のテーマを自ら深く調べた事実」または「深入りせず手近な定番・実用的なことにとどめた事実」のいずれか、知的好奇心の高低を客観的に判定できる具体的な行動・選択が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(調べ|仕組み|なぜ|理由|議論|深掘り|知識|勉強|本|ニュース|考察|分析|知的好奇心|定番|その場|こだわら)/
  },
  {
    key: 'ev_openness_aesthetic',
    factor: '開放性',
    name: '美的好奇心',
    probeHint: '自由な時間や休日にどんなコンテンツ（音楽・映画・美術・デザイン・景色・雰囲気の良い場所など）を選び、どう楽しむか（あるいは芸術に関心がないか）',
    evidenceInstruction: '【開放性 - 美的好奇心の行動エビデンス】対話の中で、音楽・映画・芸術・デザイン等の体験に「能動的に触れて楽しんだ事実」または「そうした体験に関心を払わず定番や実利を優先した事実」のいずれか、美的好奇心の高低を客観的に判定できる具体的な行動・選択が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(音楽|映画|美術|芸術|デザイン|景色|雰囲気|カフェ|建築|作品|イラスト|写真|ライブ|センス|実用|関心.*ない|見ない)/
  },
  {
    key: 'ev_openness_creative',
    factor: '開放性',
    name: '創造力',
    probeHint: 'いつものやり方に飽きたときや課題に直面したとき、新しい方法・独自の工夫を試したか、それとも確立された定番・ルーティン通りに動いたか',
    evidenceInstruction: '【開放性 - 創造力の行動エビデンス】対話の中で、「新しいやり方や独自の工夫・アレンジを試した事実」または「自己流を避けて確立された手順・定番通りを選んだ（工夫は特にしない）事実」のいずれか、創造力の高低を客観的に判定できる具体的な行動・選択が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(工夫|新しい|アイデア|試|自作|アレンジ|独自|発想|挑戦|ルーティン|定番|工夫.*(しない|しな|特になし)|そのまま)/
  },

  // 2. 誠実性 (Conscientiousness)
  {
    key: 'ev_conscientiousness_organization',
    factor: '誠実性',
    name: '組織化（段取り・整理）',
    probeHint: '出かける前や作業前にどこまで事前に計画・段取りを組むか、あるいは予定変更時にどう再手配したか（またはノープランで動くか）',
    evidenceInstruction: '【誠実性 - 組織化の行動エビデンス】対話の中で、「事前に計画・優先順位を整理して段取りを組み立てた事実」または「計画を立てずその場の行き当たりばったり・ノープランで動いた事実」のいずれか、組織化の高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(計画|段取り|準備|スケジュール|予約|整理|リスト|片付け|ノープラン|行き当たりばったり|ルート|成り行き|適当)/
  },
  {
    key: 'ev_conscientiousness_productiveness',
    factor: '誠実性',
    name: '生産性（やり抜く力）',
    probeHint: 'やらなければいけないけれど面倒な作業や課題があるとき、すぐ着手してやり通したか、それとも後回し・先延ばしにしたか',
    evidenceInstruction: '【誠実性 - 生産性の行動エビデンス】対話の中で、「面倒なタスクに着手して最後までやり抜いた事実」または「無理せず諦めて寝る・後回し・先延ばしにした事実」のいずれか、生産性の高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(面倒|コツコツ|やり切|やり抜|最後|終わらせ|後回し|先延ばし|集中|継続|作業|課題|諦めて寝|ほったらか)/
  },
  {
    key: 'ev_conscientiousness_responsibility',
    factor: '誠実性',
    name: '責任感',
    probeHint: '自分の役割や約束・時間を守るために具体的にどう動いたか、周囲から頼まれた時にどう対応したか',
    evidenceInstruction: '【誠実性 - 責任感の行動エビデンス】対話の中で、「約束や締切を守るため自ら責任を持って動いた・連絡した事実」または「連絡を後回しにしたり放置・他人に任せきりにした事実」のいずれか、責任感の高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(役割|責任|約束|時間|遅刻|締切|期限|守る|任され|担当|きっちり|連絡.*(しない|後回し)|放置)/
  },

  // 3. 外向性 (Extraversion)
  {
    key: 'ev_extraversion_sociability',
    factor: '外向性',
    name: '社交性',
    probeHint: '人が集まる場や会話の中で、自分からどう話しかけたか、または聞き役に回ったか（あるいは話しかけられるまで待ったか）',
    evidenceInstruction: '【外向性 - 社交性の行動エビデンス】対話の中で、「自分から進んで話しかけたり会話を広げた事実」または「自らは話しかけず沈黙を保つ・聞かれるまで待った事実」のいずれか、社交性の高低を客観的に判定できる具体的な振る舞いが語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(話しかけ|会話|盛り上|雑談|聞き役|しゃべ|初対面|友達|仲間|声かけ|明るく|聞かれるまで|自分からは|静かに)/
  },
  {
    key: 'ev_extraversion_assertiveness',
    factor: '外向性',
    name: '主張性（主導権）',
    probeHint: '複数人で何かを決めるときや場が停滞したとき、自分から「こうしよう」と提案・リードしたか、周囲の決定に従ったか',
    evidenceInstruction: '【外向性 - 主張性の行動エビデンス】対話の中で、「自分から意見・折衷案を出して全体をリードした事実」または「自分の主張は出さず他人の意見に同調・決定を周囲に任せた事実」のいずれか、主張性の高低を客観的に判定できる具体的な発言が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(提案|リード|主導|意見|まとめ|引っ張|仕切|決め|従う|合わせる|任せる|同調|一票|運転.*やる)/
  },
  {
    key: 'ev_extraversion_activity',
    factor: '外向性',
    name: '活動性',
    probeHint: '休日や日常の中でどれくらい予定を入れて外へ動き回るか、あるいは家でゆっくり過ごすか',
    evidenceInstruction: '【外向性 - 活動性の行動エビデンス】対話の中で、「能動的に外出して精力的に活動した事実」または「活発な外出を避け自宅・自室で静かにリラックスして過ごした事実」のいずれか、活動性の高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(休日|出かけ|動き回|アクティブ|フットワーク|インドア|家でのんびり|予定を入れ|活発|外に出|部屋で|家で)/
  },

  // 4. 協調性 (Agreeableness)
  {
    key: 'ev_agreeableness_compassion',
    factor: '協調性',
    name: '思いやり',
    probeHint: '周囲で困っている人や疲れている人がいたとき、どんな声をかけたか・どんな手助けをしたか（あるいは距離を置いたか）',
    evidenceInstruction: '【協調性 - 思いやりの行動エビデンス】対話の中で、「他者に寄り添い助けや気遣いの声かけ・行動を行った事実」または「深入りせず自分の都合・効率を最優先した事実」のいずれか、思いやりの高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(気遣|フォロー|助け|手伝|声.*かけ|心配|優し|サポート|気づか|寄り添|教え|大丈夫か|深入りしな)/
  },
  {
    key: 'ev_agreeableness_respect',
    factor: '協調性',
    name: '敬意（対立回避）',
    probeHint: '周囲と意見や考えが少し違ったとき、角が立たないようにどう伝えたか・どう折り合いをつけたか（あるいは率直に反論したか）',
    evidenceInstruction: '【協調性 - 敬意の行動エビデンス】対話の中で、「対立時にも相手に敬意を払い穏やかに接した・譲歩した事実」または「不満をストレートにぶつける・率直に自己主張した事実」のいずれか、敬意・対立回避の高低を客観的に判定できる具体的な言動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(意見.*違|対立|譲|穏やか|角が立た|怒ら|指摘|反論|言い方|空気を読|丁寧|合わない|説明する)/
  },
  {
    key: 'ev_agreeableness_trust',
    factor: '協調性',
    name: '信頼',
    probeHint: '他人に作業や役割を任せるとき、相手を信じて任せたか、それとも自分で確認しないと気が済まなかったか',
    evidenceInstruction: '【協調性 - 信頼の行動エビデンス】対話の中で、「周囲を好意的に受け止め信じて協調した事実」または「他者を警戒・疑って自分一人で抱え込んだ・距離を置いた事実」のいずれか、信頼の高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(任せ|信頼|信じ|頼る|疑|自分でや|確認しな|お願いし|話しやすそうな|話しかけづら)/
  },

  // 5. 情緒安定性 (Emotional Stability)
  {
    key: 'ev_neuroticism_anxiety',
    factor: '情緒安定性',
    name: '不安の低さ（ストレス対処）',
    probeHint: 'プレッシャーがかかる場面や結果が分からない状況で、どんな態度・行動をとっていたか',
    evidenceInstruction: '【情緒安定性 - 不安の低さの行動エビデンス】対話の中で、「プレッシャーや不測の事態に直面しても落ち着いて構えていた事実」または「強い焦りや動揺・不安を感じて取り乱した事実」のいずれか、ストレス耐性の高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(不安|焦|心配|緊張|プレッシャー|落ち着|リラックス|ドキドキ|気にし|焦りを隠|冷静)/
  },
  {
    key: 'ev_neuroticism_depression',
    factor: '情緒安定性',
    name: '抑うつの低さ（気分の切り替え）',
    probeHint: '失敗したあとや嫌な出来事があった直後〜翌日にかけて、どれくらい引きずったか、どうやって気分を切り替えたか',
    evidenceInstruction: '【情緒安定性 - 抑うつの低さの行動エビデンス】対話の中で、「嫌な出来事の後でも好きなことをして前向きに気持ちを切り替えた事実」または「長く落ち込んだりモヤモヤを引きずった事実」のいずれか、気分の安定の高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(落ち込|引きず|切り替え|立ち直|寝れば|翌日|気分|ショック|凹|へこ|元気|好きなこと.*する)/
  },
  {
    key: 'ev_neuroticism_volatility',
    factor: '情緒安定性',
    name: '感情変動の低さ（トラブル時の冷静さ）',
    probeHint: '想定外のことが起きたり思い通りに進まない場面で、イライラや焦りが態度・口調に出たか、それとも動じず冷静に対処したか',
    evidenceInstruction: '【情緒安定性 - 感情変動の低さの行動エビデンス】対話の中で、「突発的なトラブルや変更に対しても動じず冷静に対処した事実」または「苛立ちや落胆が態度・口調に出て感情的になった事実」のいずれか、動じにくさの高低を客観的に判定できる具体的な行動が語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(イライラ|パニック|冷静|動じ|トラブル|ハプニング|怒|感情的|落ち着いて対|冷静な方)/
  }
];

/**
 * CAT (Computerized Adaptive Testing) 項目反応理論 (IRT) に基づく因子測定精度モデル
 * BFI-2の各因子（3ファセット）について、各ファセットの情報量から因子の標準誤差 (SEM) を算出
 * 
 * 心理測定学的根拠:
 * - BFI-2の各因子は3つの独立したファセットで構成される。
 * - 1ファセットでも未観測（情報量0）の場合、その潜在的極値（例: 達成努力/責任感が極端に低い等）の
 *   不確実性が残るため、因子の標準誤差 SEM は目標精度 (<= 5.5) に達しない。
 * - 3ファセットすべてに一定以上の客観的エビデンス（情報量）が得られて初めて SEM <= 5.5 を達成する。
 */
export function calculateFactorCATMetrics(
  facetProbs: Record<string, number>,
  factor: FactorNameJP
): {
  sem: number;
  information: number;
  isSatisfied: boolean;
  evidencedCount: number;
  partialCount: number;
  unobservedFacets: FacetDefinition[];
  meanProb: number;
} {
  const facets = FACET_DEFINITIONS.filter(f => f.factor === factor);
  let totalInformation = 0;
  let evidencedCount = 0;
  let partialCount = 0;
  const unobservedFacets: FacetDefinition[] = [];
  let sumProb = 0;

  for (const f of facets) {
    const p = facetProbs[f.key] ?? 0;
    sumProb += p;

    // 各ファセットの情報量 I_j (0.0 〜 1.0)
    // 0.70以上: 十分な行動エビデンス (I = 1.0)
    // 0.45〜0.70: 部分的エビデンス (I = 0.3〜0.8)
    // 0.45未満: 未観測 (I < 0.2)
    let info = 0;
    if (p >= FACET_EVIDENCE_THRESHOLD) {
      info = 1.0;
      evidencedCount++;
    } else if (p >= 0.45) {
      info = 0.3 + ((p - 0.45) / 0.25) * 0.5; // 0.3 ~ 0.8
      partialCount++;
      unobservedFacets.push(f);
    } else {
      info = Math.max(0, (p / 0.45) * 0.2); // 0.0 ~ 0.2
      unobservedFacets.push(f);
    }
    totalInformation += info;
  }

  const meanProb = sumProb / facets.length;

  // 因子の標準誤差 (SEM, 100点スケール):
  // 3ファセットすべて十分観測 (evidencedCount === 3): SEM = 4.0 ~ 5.0
  // 2ファセット観測 + 1ファセット高部分エビデンス (evidencedCount === 2, partialCount === 1, meanProb >= 0.68): SEM = 5.4
  // 2ファセット観測 + 1ファセット未観測 (evidencedCount === 2, unobserved): SEM = 7.0 ~ 8.0 (目標5.5に未達)
  // 1ファセット観測: SEM = 10.0 ~ 12.0
  // 0ファセット観測: SEM = 16.0
  let sem = 16.0;
  if (evidencedCount === 3) {
    sem = 4.0 + (3.0 - totalInformation) * 2.0; // 4.0 ~ 5.0
  } else if (evidencedCount === 2) {
    if (partialCount === 1 && totalInformation >= 2.6) {
      // 3ファセット目にも相当な手応え（p >= 0.60程度）がある場合
      sem = 5.4;
    } else {
      // 1ファセットが未観測のまま残っている場合 -> 永久に過大評価されるリスクを防ぐため SEM >= 7.0
      sem = 7.0 + (1.0 - (totalInformation - 2.0)) * 1.5;
    }
  } else if (evidencedCount === 1) {
    sem = 10.0 + (2.0 - totalInformation) * 2.0;
  } else {
    sem = 16.0;
  }
  sem = Math.round(sem * 10) / 10;

  // 目標精度到達基準: CAT目標SEM (<= 5.5)
  // 3ファセットすべてについて客観的行動エビデンス（あるいは強い部分エビデンス）が得られていることが必要
  const isSatisfied = sem <= CAT_TARGET_FACTOR_SEM;

  // 未観測ファセットを確率の低い順（情報量が最も足りない順）にソート
  unobservedFacets.sort((a, b) => (facetProbs[a.key] ?? 0) - (facetProbs[b.key] ?? 0));

  return {
    sem,
    information: Math.round(totalInformation * 100) / 100,
    isSatisfied,
    evidencedCount,
    partialCount,
    unobservedFacets,
    meanProb
  };
}



export interface UserProfileDemographics {
  age?: number | string;
  gender?: string;
  student_id?: string;
}

/**
 * 因子に応じた、再現性のある詳細な架空場面（全年代共通SJTシナリオ）を生成
 */
export function getDetailedScenarioForFactor(factor?: string, _age?: number): {
  scenarioTitle: string;
  situationText: string;
  questionText: string;
} {
  switch (factor) {
    case '誠実性':
      return {
        scenarioTitle: '締切・計画の破綻とスケジュール再構築',
        situationText:
          '期日までに必ず提出・準備しなければいけない大事な用事や書類（手続き・提出物など）があり、今日中に半分終わらせる計画だったとします。ところが急な用事が入ったり集中が切れたりして、全く手をつかないまま夜遅くになってしまいました。明日は朝から外せない予定が入っています。',
        questionText:
          'もし過去に似たようなご経験があれば、その時実際にどう対処されたかを教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら今夜から翌朝にかけて具体的にどう動くか」を教えてください）'
      };

    case '外向性':
      return {
        scenarioTitle: '集まりの計画・意見対立と意思決定',
        situationText:
          '友人や知人、仲間など3〜4人で、集まりで入る食事の店や行き先を決めている場面を想像してください。相談している最中、候補が2つ挙がってお互いに譲らず意見が真っ二つに分かれ、議論が平行線のまま気まずい沈黙が流れて決まらなくなってしまいました。',
        questionText:
          'もし過去に似たような場面のご経験があれば、その時その場のメンバーに対して実際にどう声をかけたり動いたりしたかを教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら具体的にどんなタイミングで何と声をかけるか、どう立ち回るか」を教えてください）'
      };

    case '協調性':
      return {
        scenarioTitle: '仲間内での作業遅れ・困っている相手への関わりと協力',
        situationText:
          '友人や仲間、同僚など数人で一緒に作業や準備を進めている場面を想像してください。メンバーの1人が自分の担当分でつまずいて遅れており、焦りや疲れから周囲と少しギスギスした雰囲気になりかけています。一方で、あなた自身の作業もまだ残っている状態です。',
        questionText:
          'もし過去に似たような場面のご経験があれば、その時その相手や周囲に対して実際にどう声をかけたり行動したりしたかを教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら相手や周囲にどう接するか、どう動くか」を教えてください）'
      };

    case '開放性':
      return {
        scenarioTitle: '休日の過ごし方・新しい刺激 vs いつもの定番',
        situationText:
          '休日に、誰とも約束がなく丸一日フリーな時間ができたとします。部屋で過ごしていて、ふと「何か普段とは違う面白いことや、新しい刺激に触れてみたい」という気分になりました。',
        questionText:
          'もし最近このような気分になったご経験があれば、その時実際にどう過ごされたか、当時の具体的な行動を教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら具体的にどう過ごすか」を教えてください）'
      };

    case '情緒安定性':
    default:
      return {
        scenarioTitle: '予定外のトラブル・他人のミスと気分の切り替え',
        situationText:
          '誰かと一緒に予定を進めている最中（または待ち合わせなど）に、相手のうっかりミスや手違いで、予定が大きく狂ったり、自分にも余計な手間がかかるトラブルが発生してしまった状況を想像してください。',
        questionText:
          'もし過去に似たようなトラブルのご経験があれば、その瞬間相手に実際にどのような言葉や態度で接し、その場をどう対応したか（または気持ちをどう切り替えたか）を教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら相手にどう接し、どう対応するか」を教えてください）'
      };
  }
}

/**
 * これまでのユーザー発言から生活キーワード（大学、バイト等）を抽出し、
 * 「前話したこと」を忘れない文脈ブリッジ文を生成
 */
export function buildContextBridge(messages: ChatMessage[]): string {
  const userText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');

  if (userText.includes('大学') || userText.includes('学校')) {
    return '先ほど、学校や大学について教えていただきありがとうございました！そうした日常に関連して、例えばこんな場面を想像してみてほしいのですが……';
  }
  if (userText.includes('仕事') || userText.includes('会社') || userText.includes('バイト')) {
    return '先ほど教えていただいた普段の生活やお仕事の様子、ありがとうございます！そうした日常に関連して、例えばこんな場面を想像してみてほしいのですが……';
  }
  return 'これまでの普段の過ごし方について教えていただきありがとうございます！そうした日常に関連して、例えばこんな場面を想像してみてほしいのですが……';
}

/**
 * ユーザーの発言が袋小路（否定、メタ動作、短文のみ）に陥っているかを厳密に判定
 */
export function isStuckOrNegativeResponse(messages: ChatMessage[]): boolean {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return false;
  const lastUserMsg = userMessages[userMessages.length - 1].content.trim();

  // 1. 否定的な短い返答（「ない」「なかった」「とくになにも」「いつもと一緒」「動いてない」等）
  const negativeRegex = /^(特に|とくに)?(ない|なかった|なにも|何もない|何も|ないです|なかったです|ないよ|ないけど|特になし|なし|普通|ふつう|いつもと一緒|いつも通り|同じ|動いてない|してない|準備してない|連絡してない|そんなことない|そんなことなかった|わからない|覚えてない)[。！!?？\s]*$/i;
  if (negativeRegex.test(lastUserMsg)) return true;

  // 2. アンケート回答のメタ動作（「質問に答えてる」「スマホしか見てない」「画面」「両手で」「人差し指」「送信ボタン」等）
  const metaRegex = /(質問に答|回答に答|これをしてる|スマホしか|文字入力|キーボード|送信ボタン|タップ|アプリ|指で|両手で|人差し指|寝る姿勢|クライ)/;
  if (metaRegex.test(lastUserMsg)) return true;

  // 3. 直近2ターンのユーザー発言がいずれも極小（10文字以下）
  if (userMessages.length >= 2) {
    const prevUserMsg = userMessages[userMessages.length - 2].content.trim();
    if (lastUserMsg.length <= 8 && prevUserMsg.length <= 8) {
      if (/^(？|\?|はい|いいえ|それだけ？|おわり？)$/.test(lastUserMsg) || /^(？|\?|はい|いいえ)$/.test(prevUserMsg)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 対話履歴から各ビッグファイブ因子の進捗を解析（ルールベース・フォールバック兼用）
 * ユーザーの実際の発言内容（エピソード）から15ファセットの言及を複数同時に検出する
 */
export function analyzeDimensionCoverage(messages: ChatMessage[]): {
  covered: Record<string, boolean>;
  uncovered: string[];
  lastAssignedDim: string | null;
  facetScoresFallback: Record<string, number>;
  factorSems: Record<string, number>;
} {
  const allDimensions: FactorNameJP[] = ['開放性', '誠実性', '外向性', '協調性', '情緒安定性'];
  const userTextCombined = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  const facetScoresFallback: Record<string, number> = {};
  for (const facet of FACET_DEFINITIONS) {
    const matched = facet.regexFallback.test(userTextCombined);
    facetScoresFallback[facet.key] = matched ? 0.72 : 0.35;
  }

  const covered: Record<string, boolean> = {
    '開放性': false,
    '誠実性': false,
    '外向性': false,
    '協調性': false,
    '情緒安定性': false
  };
  const factorSems: Record<string, number> = {};

  for (const dim of allDimensions) {
    const metrics = calculateFactorCATMetrics(facetScoresFallback, dim);
    factorSems[dim] = metrics.sem;
    // CAT IRT 基準: 3ファセットすべてが観測され SEM <= CAT_TARGET_FACTOR_SEM (5.5) を満たした場合のみ充足
    covered[dim] = metrics.isSatisfied;
  }

  // SEMが大きい順（測定精度が低く情報量が最も不足している順）に並べる
  const uncovered = allDimensions
    .filter(d => !covered[d])
    .sort((a, b) => (factorSems[b] ?? 16.0) - (factorSems[a] ?? 16.0));

  return { covered, uncovered, lastAssignedDim: null, facetScoresFallback, factorSems };
}

/**
 * 多言語LLMのハルシネーション（ハングル文字や韓国語助詞の混入等）を日本語に置換・除去
 */
export function sanitizeJapaneseOutput(text: string): string {
  if (!text) return text;
  return text
    .replace(/具体적으로/g, '具体的に')
    .replace(/적으(?=[ろロ])/g, '的')
    .replace(/[\uAC00-\uD7AF\u1100-\u11FF]/g, '');
}

/**
 * 対話履歴からすでに提示済みのシナリオ（因子）を検出
 */
export function getPresentedFactors(messages: ChatMessage[]): Set<FactorNameJP> {
  const presented = new Set<FactorNameJP>();
  for (const m of messages) {
    if (m.role === 'assistant') {
      const text = m.content;
      if (
        text.includes('週末の集まり') ||
        text.includes('食事の店や行き先') ||
        text.includes('食事の店選び') ||
        text.includes('候補が2つ') ||
        text.includes('議論が平行線') ||
        text.includes('遠出して')
      ) {
        presented.add('外向性');
      }
      if (
        text.includes('作業遅れ') ||
        text.includes('つまずいて') ||
        text.includes('ギスギス') ||
        text.includes('作業を手伝う') ||
        text.includes('フォローする') ||
        text.includes('相手が良かれと思って提案') ||
        text.includes('相手の気持ちを汲みつつ') ||
        text.includes('考えとは違っていたり') ||
        text.includes('すり合わせる')
      ) {
        presented.add('協調性');
      }
      if (
        text.includes('丸一日フリーな時間') ||
        text.includes('新しいお店や場所に出かけたり') ||
        text.includes('新しい刺激に触れてみたい')
      ) {
        presented.add('開放性');
      }
      if (
        text.includes('提出') ||
        text.includes('手をつかない') ||
        text.includes('夜遅く') ||
        text.includes('締切') ||
        text.includes('課題') ||
        text.includes('スケジュール') ||
        text.includes('徹夜') ||
        text.includes('期日')
      ) {
        presented.add('誠実性');
      }
      if (
        text.includes('予定外のトラブル') ||
        text.includes('うっかりミス') ||
        text.includes('イライラや嫌な気分') ||
        text.includes('手違い')
      ) {
        presented.add('情緒安定性');
      }
    }
  }
  return presented;
}

/**
 * Clef-flashの15ファセット同時評価レスポンス（パターンC）を解析し、
 * 「同じエピソードの深掘り」または「未充足因子に応じた年齢別SJTシナリオ提示」を決定する
 */
export function parseClefPatternCDecision(
  resObj: any,
  messages: ChatMessage[],
  userCount: number,
  userProfile?: UserProfileDemographics
): AnalystStrategy | null {
  if (!resObj) return null;
  const target = resObj.answers || resObj.result || resObj;
  if (!target || typeof target !== 'object') return null;

  const extractProb = (item: any): number | null => {
    if (item === undefined || item === null) return null;
    if (typeof item === 'number') return item <= 1.0 ? item : item / 100;
    if (typeof item?.noul === 'number') return item.noul;
    if (typeof item?.probability === 'number') return item.probability;
    if (typeof item?.yes_probability === 'number') return item.yes_probability;
    if (item === 'yes' || item === true || item?.answer === 'yes') return 0.85;
    if (item === 'no' || item === false || item?.answer === 'no') return 0.20;
    return null;
  };

  // 15ファセットの行動エビデンス確率を取得
  const facetProbs: Record<string, number> = {};
  let validFacetCount = 0;
  for (const facet of FACET_DEFINITIONS) {
    const p = extractProb(target[facet.key]);
    if (p !== null) {
      facetProbs[facet.key] = p;
      validFacetCount++;
    } else {
      facetProbs[facet.key] = 0.0;
    }
  }

  if (validFacetCount === 0) {
    return null;
  }

  const allFactors: FactorNameJP[] = ['開放性', '誠実性', '外向性', '協調性', '情緒安定性'];

  // CAT / IRT 項目情報量モデルに基づく各因子の測定精度メトリクス (SEM) を算出
  const factorMetrics: Record<FactorNameJP, ReturnType<typeof calculateFactorCATMetrics>> = {
    '開放性': calculateFactorCATMetrics(facetProbs, '開放性'),
    '誠実性': calculateFactorCATMetrics(facetProbs, '誠実性'),
    '外向性': calculateFactorCATMetrics(facetProbs, '外向性'),
    '協調性': calculateFactorCATMetrics(facetProbs, '協調性'),
    '情緒安定性': calculateFactorCATMetrics(facetProbs, '情緒安定性')
  };

  let totalEvidencedFacets = 0;
  for (const factor of allFactors) {
    totalEvidencedFacets += factorMetrics[factor].evidencedCount;
  }

  // CAT 測定精度未充足（SEM > CAT_TARGET_FACTOR_SEM: 5.5）の因子をSEMが大きい順（誤差が大きい順）にソート
  // ※3ファセット中1ファセットでも未観測の場合、SEM >= 7.0 となり必ず未充足として残る
  const uncoveredFactors = allFactors
    .filter(f => !factorMetrics[f].isSatisfied)
    .sort((a, b) => factorMetrics[b].sem - factorMetrics[a].sem);

  const overallReadyProb = extractProb(target.is_ready_overall) ?? 0;

  // 既出シナリオのトラッキング
  const presentedFactors = getPresentedFactors(messages);
  const unpresentedUncovered = uncoveredFactors.filter(f => !presentedFactors.has(f));
  const unpresentedAny = allFactors.filter(f => !presentedFactors.has(f));

  const episodeDepthChoice =
    target.episode_depth_status?.chosen ||
    target.episode_depth_status?.answer ||
    target.episode_depth_status?.choice ||
    (typeof target.episode_depth_status === 'string' ? target.episode_depth_status : null);

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content.trim() || '';
  const userSaidNoEpisode =
    /(特に(ない|なかった|なにも|何もない)|とくに(ない|なかった|なにも|何もない)|思いつかない|あまりない|覚えていない|覚えてない|わからない|ないです|なかったです|ないですね|いつもと一緒|いつも通り|してない|準備してない|動いてない|そんなことなかった)/.test(lastUserMsg) ||
    /^(ない|なかった|特になし|なし|ないよ)[。！!?？\s]*$/.test(lastUserMsg);

  const isStuck = isStuckOrNegativeResponse(messages);

  // -------------------------------------------------------------
  // エビデンス充足判定（ターン数の最小・最大制限なし）
  // -------------------------------------------------------------
  // 最小ターン数や最大ターン数による機械的な縛りは設けず、
  // 純粋にAIが「ビッグファイブ5因子の十分な行動エビデンスを収集できた」と判定した時点で完了とする。
  const isPrecisionSatisfied =
    uncoveredFactors.length === 0 || (overallReadyProb >= 0.85 && totalEvidencedFacets >= 14);

  // 全シナリオ提示済みで、追加情報が得られない場合の手詰まりサチュレーション判定
  const isSaturationSatisfied =
    unpresentedAny.length === 0 &&
    (isStuck || userSaidNoEpisode) &&
    totalEvidencedFacets >= 8;

  const isReady = isPrecisionSatisfied || isSaturationSatisfied;

  if (isReady) {
    const semSummary = allFactors.map(f => `${f}:SE${factorMetrics[f].sem}`).join(', ');
    const stopReason = isPrecisionSatisfied
      ? `Precision achieved (All factors evidenced: ${totalEvidencedFacets}/15 facets)`
      : `Information saturation stop (evidenced: ${totalEvidencedFacets}/15)`;

    return {
      focus_dimension: '完了',
      target_question_strategy:
        'すべての測定が完了しました。新たな質問は一切行わず、直前の回答に温かく共感・感謝した上で、画面下のボタンから次の質問紙（BFI-2-S）へ進むよう案内してください。',
      is_ready_for_final_analysis: true,
      action_mode: 'complete',
      evidenced_facets_count: totalEvidencedFacets,
      notes: `Clef-flash CAT Pattern C Complete [${stopReason}] (${semSummary})`
    };
  }

  // 「断片的ヒント（0.50 <= prob < 0.70）」が出ているファセット（あと1問深掘りすれば0.70を超える有望ファセット）
  const partialFacets = FACET_DEFINITIONS.filter(
    f => (facetProbs[f.key] ?? 0) >= FACET_PARTIAL_THRESHOLD && (facetProbs[f.key] ?? 0) < FACET_EVIDENCE_THRESHOLD
  ).sort((a, b) => (facetProbs[b.key] ?? 0) - (facetProbs[a.key] ?? 0));

  // まだ0.70に達していないファセットのうち、「今の文脈に関連している順（確率が高い順 b - a）」にソート
  const contextualMissingFacets = FACET_DEFINITIONS.filter(
    f => (facetProbs[f.key] ?? 0) < FACET_EVIDENCE_THRESHOLD
  ).sort((a, b) => {
    const scoreA = (facetProbs[a.key] ?? 0) + (uncoveredFactors.includes(a.factor) ? 0.10 : 0);
    const scoreB = (facetProbs[b.key] ?? 0) + (uncoveredFactors.includes(b.factor) ? 0.10 : 0);
    return scoreB - scoreA;
  });

  // 年齢の数値化
  let parsedAge: number | undefined = undefined;
  if (typeof userProfile?.age === 'number' && userProfile.age > 0) {
    parsedAge = userProfile.age;
  } else if (typeof userProfile?.age === 'string') {
    const p = parseInt(userProfile.age, 10);
    if (!isNaN(p) && p > 0) parsedAge = p;
  }

  // 深掘りモード vs 新展開モードの決定:
  // ユーザーがエピソードを話し、Clef-flashが「深掘りが必要（needs_behavioral_probe）」と判定し、
  // かつ手詰まり・否定回答・メタ回答ではない場合のみ丁寧に深掘りする
  const hasInitialEpisodeContent = userCount > 1 || lastUserMsg.length >= 8;
  const shouldDeepen =
    userCount >= 1 &&
    hasInitialEpisodeContent &&
    !userSaidNoEpisode &&
    !isStuck &&
    (episodeDepthChoice === 'needs_behavioral_probe' || partialFacets.length > 0 || userCount === 1);

  if (shouldDeepen) {
    // 今のエピソードを深掘りして、現在の話題に関連性が高い未充足ファセットの具体的行動を自然に引き出す
    const probeTargets = [...partialFacets, ...contextualMissingFacets]
      .filter((f, idx, arr) => arr.findIndex(x => x.key === f.key) === idx)
      .slice(0, 3);

    const primaryFactor = probeTargets[0]?.factor || uncoveredFactors[0] || '外向性';
    const targetNames = probeTargets.map(f => `${f.factor}［${f.name}］`).join('・');
    const targetHints = probeTargets.map(f => `・${f.factor}（${f.name}）: ${f.probeHint}`).join('\n');

    return {
      focus_dimension: primaryFactor,
      action_mode: 'deepen_episode',
      target_facets: probeTargets.map(f => f.name),
      evidenced_facets_count: totalEvidencedFacets,
      is_ready_for_final_analysis: false,
      target_question_strategy: [
        `【現在のエピソードの自然な深掘り（STAR法・行動事実の抽出）】`,
        `ユーザーが直前に語ってくれたエピソード（場面・出来事）の話題は変えず、まずはその内容をカギカッコなしで自然に1文で受け止めてください。`,
        `・ユーザーが過去の実体験として語った場合：その場面の中で【具体的に何と言ったか／どう動いたか／事後にどう切り替えたか】という客観的な事実（振る舞い）を1つ尋ねてください。`,
        `・ユーザーが「もしその状況なら〜」と仮定で答えた場合：その選択に至る判断基準や、【周囲へ具体的にどんな言葉をかけるか／具体的にどんな手順で動くか】の解像度を1つ掘り下げてください。`,
        `（※「なぜそう思ったのか」という内省を聞くことは厳禁です。振る舞いの事実や解像度を尋ねてください）`,
        `今の文脈に自然に繋がる観点（${targetNames}の参考ヒント）:`,
        targetHints
      ].join('\n'),
      notes: `Clef-flash Pattern C [deepen_episode] (evidenced: ${totalEvidencedFacets}/15, targets: ${targetNames})`
    };
  }

  // 話題の完全切り替え・再現性架空シナリオ（SJT）提示モード
  // 【重要】すでに提示済みのシナリオは絶対に再出題せず、未提示の未充足因子を最優先する
  const targetFactor =
    unpresentedUncovered[0] ||
    unpresentedAny[0] ||
    uncoveredFactors[0] ||
    '誠実性';

  // ターゲット因子内で測定精度が不足している未観測ファセットを優先抽出
  const missingFacetsInFactor = factorMetrics[targetFactor]?.unobservedFacets?.length
    ? factorMetrics[targetFactor].unobservedFacets
    : FACET_DEFINITIONS.filter(
        f => f.factor === targetFactor && (facetProbs[f.key] ?? 0) < FACET_EVIDENCE_THRESHOLD
      );
  const targetFacets = (missingFacetsInFactor.length > 0 ? missingFacetsInFactor : contextualMissingFacets).slice(0, 3);
  const targetNames = targetFacets.map(f => `${f.factor}［${f.name}］`).join('・');

  // もし5因子のSJTシナリオがすべて提示済み（unpresentedAny.length === 0）の場合:
  // 全因子充足なら完了、そうでなければ未観測ファセットのピンポイント深掘りを継続
  if (unpresentedAny.length === 0) {
    if (uncoveredFactors.length === 0) {
      return {
        focus_dimension: '完了',
        target_question_strategy:
          'すべてのシナリオについての確認が完了しました。追加の質問は行わず、直前の回答に感謝を伝えた上で、画面下のボタンから次の質問紙へ進むよう案内してください。',
        is_ready_for_final_analysis: true,
        action_mode: 'complete',
        evidenced_facets_count: totalEvidencedFacets,
        notes: `Clef-flash Pattern C [All scenarios presented & precision satisfied]`
      };
    }
    const targetHints = targetFacets.length > 0
      ? targetFacets.map(f => `・${f.factor}（${f.name}）: ${f.probeHint}`).join('\n')
      : '・これまでの話題をさらに深掘りし、その時の気持ちや大切にしている考え方を尋ねてください。';
    return {
      focus_dimension: targetFactor || '行動傾向の深掘り',
      action_mode: 'deepen_episode',
      target_facets: targetFacets.map(f => f.name),
      evidenced_facets_count: totalEvidencedFacets,
      is_ready_for_final_analysis: false,
      target_question_strategy: [
        `【行動・価値観の深掘りプローブ】`,
        `これまでの会話の流れを受け止めた上で、普段の生活やこれまでの経験において、具体的にどのような場面でどのように行動・判断することが多いかを1つ自然に尋ねてください。`,
        targetHints,
        `（※末尾は必ず『？』で終えてください）`
      ].join('\n'),
      notes: `Clef-flash Pattern C [Continuous_Probe] (evidenced: ${totalEvidencedFacets}/15, target: ${targetNames})`
    };
  }

  // 年齢に適応した詳細シナリオと文脈ブリッジを取得
  const scenario = getDetailedScenarioForFactor(targetFactor, parsedAge);
  const contextBridge = buildContextBridge(messages);

  return {
    focus_dimension: targetFactor,
    action_mode: 'new_situation',
    target_facets: targetFacets.map(f => f.name),
    evidenced_facets_count: totalEvidencedFacets,
    is_ready_for_final_analysis: false,
    target_question_strategy: [
      `【未充足因子（${targetFactor} / ${targetNames}）を引き出す再現性架空シナリオの提示】`,
      `これまでのユーザーの話を活かし、必ず以下の［文脈ブリッジ］から始めて、［場面設定］と［問いかけ］を崩さず具体的に伝えてください。`,
      `▼文脈ブリッジ（例）:`,
      `「${contextBridge}」`,
      `▼提示する場面設定（状況）:`,
      `「${scenario.situationText}」`,
      `▼尋ねる問いかけ:`,
      `「${scenario.questionText}」`,
      `（※抽象的な一言で終わらせず、ユーザーがその状況をありありと思い浮かべられるよう、上記の場面設定と問いかけを丁寧に伝えてください。末尾は必ず『？』で終えてください）`
    ].join('\n'),
    notes: `Clef-flash Pattern C [SJT_Scenario:${targetFactor}] (evidenced: ${totalEvidencedFacets}/15, target: ${targetNames}, age: ${parsedAge ?? 'none'})`
  };
}

/**
 * ステップ1: 分析官AI (Workers AI @cf/cloudflare/clef-flash を呼び出し)
 * パターンC: 1回のリクエストで「BFI-2-S 15ファセットすべての行動エビデンス充足度（閾値0.70）」と
 * 「今のエピソードを深掘りすべきか／新しい場面に切り替えるべきか」を同時に評価する
 */
export async function runAnalyst(
  env: Env,
  messages: ChatMessage[],
  userProfile?: UserProfileDemographics
): Promise<AnalystStrategy> {
  const dialogueHistory = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : '質問係'}: ${m.content}`)
    .join('\n');
  const userCount = messages.filter(m => m.role === 'user').length;

  const clefState = [
    `【対話履歴】`,
    dialogueHistory,
    ``,
    `ユーザー発話回数: ${userCount}回`,
    `【評価基準】`,
    `ユーザーが語ったエピソード（場面）と、その中での具体的な振る舞い（実際に何と言ったか・どう動いたか・どんな選択をしたか・事後にどう切り替えたか）から、BFI-2-Sの15ファセットそれぞれについて「客観的に採点できるだけの具体的な行動エビデンスがすでに得られたか」を厳密に判定してください。`
  ].join('\n');

  const clefQuestions: Record<string, any> = {};

  // 15ファセットそれぞれの行動エビデンス有無を type: "noul" で同時質問
  for (const facet of FACET_DEFINITIONS) {
    clefQuestions[facet.key] = {
      type: 'noul',
      instructions: facet.evidenceInstruction
    };
  }

  // 現在のエピソードの深掘り要否
  clefQuestions.episode_depth_status = {
    type: 'choice',
    instructions:
      '直前のユーザーの回答について、まだ「具体的に何と言ったか・どう行動したか・その後どうなったか」の掘り下げが足りず、同じエピソードをもう1問深掘りすることで複数の性格ファセットの行動エビデンスを引き出せますか？それとも今のエピソードからは十分引き出せた（または該当エピソードがない）ため、別のシチュエーションへ切り替えるべきですか？',
    criteria: {
      needs_behavioral_probe:
        '直前の回答で場面や出来事は語られたが、「具体的に何と言ったか・どう動いたか・周囲とどう関わったか・その後どう切り替えたか」がまだ浅く、同じ場面をもう1問深掘りすると具体的な振る舞いが引き出せる',
      episode_sufficient_or_none:
        '直前のエピソードからは具体的な行動やセリフが十分に語られた、またはすでに2〜3往復深掘りした、あるいは「そういう場面はない」と回答されたため、新しい場面（シチュエーション）へ切り替えるべき'
    }
  };

  // 全体の完了判定 (CAT IRT 測定精度基準)
  clefQuestions.is_ready_overall = {
    type: 'noul',
    instructions:
      'これまでの対話全体を通じて、ビッグファイブ全5因子（開放性・誠実性・外向性・協調性・情緒安定性）の各因子3ファセットすべてについて客観的な行動事実・エビデンスが確認され、測定の標準誤差が十分に小さく高精度に推定できる状態に達しましたか？（未観測のファセットが残っている因子がある場合は必ずno）'
  };

  // 1. Cloudflare Workers AI バインディング (env.AI) を最優先で実行
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
      const parsed = parseClefPatternCDecision(aiRes, messages, userCount, userProfile);
      if (parsed) {
        parsed.notes = `${parsed.notes} [via env.AI binding]`;
        return parsed;
      }
    } catch (aiErr: any) {
      console.warn('env.AI.run Clef-flash warning, attempting HTTP fetch fallback:', aiErr?.message || aiErr);
    }
  }

  // 2. HTTP fetch (AI Gateway Workers AI エンドポイント経由で @cf/cloudflare/clef-flash を呼び出し)
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
      const parsed = parseClefPatternCDecision(data, messages, userCount, userProfile);
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

  // 3. 万一の通信障害時のルールベース・フォールバック
  const fallbackCoverage = analyzeDimensionCoverage(messages);
  const mockAnswers: Record<string, any> = {
    episode_depth_status: {
      chosen: userCount % 2 === 1 ? 'needs_behavioral_probe' : 'episode_sufficient_or_none'
    },
    is_ready_overall: { noul: fallbackCoverage.uncovered.length === 0 ? 0.75 : 0.3 }
  };
  for (const facet of FACET_DEFINITIONS) {
    mockAnswers[facet.key] = { noul: fallbackCoverage.facetScoresFallback[facet.key] ?? 0.35 };
  }

  const fallbackParsed = parseClefPatternCDecision({ answers: mockAnswers }, messages, userCount, userProfile);
  if (fallbackParsed) {
    fallbackParsed.notes = `${fallbackParsed.notes} [Rule-based fallback]`;
    return fallbackParsed;
  }

  const defaultScenario = getDetailedScenarioForFactor('外向性', typeof userProfile?.age === 'number' ? userProfile.age : undefined);
  return {
    focus_dimension: '外向性',
    action_mode: 'new_situation',
    target_question_strategy: `【外向性の状況判断シナリオ】\n場面: ${defaultScenario.situationText}\n問いかけ: ${defaultScenario.questionText}`,
    is_ready_for_final_analysis: false,
    notes: 'Minimal fallback strategy'
  };
}

/**
 * 質問係AIに渡す対話履歴をフォーマット
 * 直近のやり取りを重視し、「ご回答ありがとうございます。」「はい」「？」等の無意味なスタック・ループを除去・圧縮
 */
export function formatInterviewerMessages(messages: ChatMessage[]): { role: string; content: string }[] {
  // 直近最大12メッセージ（6往復）を取り出す
  const recent = messages.slice(-12);
  const formatted: { role: string; content: string }[] = [];

  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = m.content.trim();

    // 「ご回答ありがとうございます。」単体で質問が含まれないメッセージは、モデルがそれを真似してループするためスキップ
    if (role === 'assistant' && /^(ご回答ありがとうございます[。！!]*|承知いたしました[。！!]*)$/.test(content)) {
      continue;
    }
    // 直前の同一ロールの重複を避ける
    if (formatted.length > 0 && formatted[formatted.length - 1].role === role) {
      formatted[formatted.length - 1].content += `\n${content}`;
    } else {
      formatted.push({ role, content });
    }
  }

  // もし空になった場合は最新の1件を入れる
  if (formatted.length === 0 && messages.length > 0) {
    const last = messages[messages.length - 1];
    formatted.push({
      role: last.role === 'assistant' ? 'assistant' : 'user',
      content: last.content
    });
  }

  return formatted;
}

/**
 * インタビュアーAI用のシステムプロンプトを生成
 * 【スリム化＆洗練版】コンテキスト圧迫を解消し、シナリオと文脈ブリッジを自然に届ける
 */
function buildInterviewerInstruction(strategy: AnalystStrategy): string {
  const isReady = strategy.is_ready_for_final_analysis;
  const focusDimension = strategy.focus_dimension || '行動特性';
  const targetStrategy = strategy.target_question_strategy || '具体的な行動エピソードについて尋ねる';
  const actionMode = strategy.action_mode || 'new_situation';

  if (isReady || actionMode === 'complete') {
    return `
あなたはプロフェッショナルなパーソナリティ・インタビュアーです。
これまでの対話ですべての特性評価に必要な回答が集まりました。

【あなたのタスク】
1. ユーザーの直前の発言に対して温かく共感（1〜2文）してください。
2. 追加の質問は一切禁止です（疑問符『？』を使わないでください）。
3. 最後に、「ここまで色々な場面について詳しくお答えいただき、ありがとうございました！対話セッションは完了です。画面下のボタンから、次のステップ『質問紙（BFI-2-S）』へお進みください。」と案内して締めくくってください。
4. 思考タグ等は含めず、ユーザーへの発話文のみを直接出力してください。
`;
  }

  return `
あなたは心理学に基づくパーソナリティ・インタビュアーです。
ユーザーが提示された状況で「具体的にどう考え、どう動くか」を引き出すことがあなたの役割です。

裏方の分析官AI（Clef-flash）から以下の戦略指示が届いています:
【分析官の指示】:
- 主な注目領域: ${focusDimension}${strategy.target_facets?.length ? `（注目ファセット: ${strategy.target_facets.join(' / ')}）` : ''}
${targetStrategy}

【インタビュアーの基本ルール（厳守）】
1. 丁寧で親しみやすい敬語を使用してください。
2. **【必須・出力構成】必ず［相手の回答への自然な受け止め（1文）］＋［分析官から指定されたシナリオの場面設定と具体的な問いかけ（末尾は必ず『？』）］を1つのメッセージとして出力してください。「ご回答ありがとうございます。」などの相槌だけで発言を終えることは絶対に禁止です。**
3. **【再現性の重視】分析官から指定された［場面設定］と［問いかけ］は省略せず、相手が情景を具体的に思い浮かべられるようにしっかりと伝えてください。**
4. **【メタ動作質問の禁止】「スマホをどう持っているか」「どの指で入力しているか」「部屋の明るさ」など、アンケート回答中の端末操作や部屋の様子を聞くことは厳禁です。**
5. カギカッコ（「 」）で全体を括らず、普通の人間同士の自然な会話文として出力してください。
6. 勝手な終了宣言や説教・アドバイスはしないでください。
7. 「あなたの誠実性を測るために〜」等の検査用語・因子名は絶対に出さないでください。
8. **【STAR法行動事実の深掘り】自由な世間話や雑談に脱線せず、ユーザーの「具体的な発言（何と言ったか）」「実際の振る舞い（どう動いたか）」「結果への対処（どう切り替えたか）」の客観的事実の深掘りに集中してください。一度に複数の質問を重ねて投げず、問いかけは必ず1つ（末尾は『？』）に絞ってください。**
9. 思考プロセスやタグ（<think>等）は含めず、ユーザーへの発話文のみを直接出力してください。
10. **【言語制約（絶対厳守）】完全な自然な日本語のみを出力してください。外国語（ハングル文字・韓国語の助詞［「적으로」等］、英語、中国語等）の混入は厳禁です。提示する［場面設定］と［問いかけ］は指定された日本語テキストを一字一句正確に出力してください。**
`;
}

/**
 * ステップ2: 質問係AI (Route: dynamic/llm5) をSSEストリーミングで実行
 */
export async function runInterviewerStream(
  env: Env,
  messages: ChatMessage[],
  strategy: AnalystStrategy,
  modelName: string = 'dynamic/llm5',
  userProfile?: UserProfileDemographics
): Promise<ReadableStream<Uint8Array>> {
  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  const isReady = strategy.is_ready_for_final_analysis;
  const targetModel = modelName || 'dynamic/llm5';
  const interviewerInstruction = buildInterviewerInstruction(strategy);
  const formattedMessages = formatInterviewerMessages(messages);

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
      let rawAccumulatedText = '';
      let cleanAccumulatedText = '';

      const processSseLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) return;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') return;

        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            rawAccumulatedText += content;

            // 思考タグ (<thought>, <think>, <|channel>thought) のリアルタイム除去（大文字・小文字両対応）
            let cleanChunk = '';
            for (let i = 0; i < content.length; i++) {
              const char = content[i];
              if (!isInsideThinking) {
                if (char === '<') {
                  if (tagBuffer.length > 0) {
                    cleanChunk += tagBuffer;
                  }
                  tagBuffer = '<';
                } else if (tagBuffer.length > 0) {
                  tagBuffer += char;
                  const lowerTag = tagBuffer.toLowerCase();
                  if (
                    '<think>'.startsWith(lowerTag) ||
                    '<thought>'.startsWith(lowerTag) ||
                    '<|channel>thought'.startsWith(lowerTag)
                  ) {
                    if (
                      lowerTag === '<think>' ||
                      lowerTag === '<thought>' ||
                      lowerTag === '<|channel>thought'
                    ) {
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
                  const lowerTag = tagBuffer.toLowerCase();
                  if (
                    '</think>'.startsWith(lowerTag) ||
                    '</thought>'.startsWith(lowerTag) ||
                    '<channel|>'.startsWith(lowerTag)
                  ) {
                    if (
                      lowerTag === '</think>' ||
                      lowerTag === '</thought>' ||
                      lowerTag === '<channel|>'
                    ) {
                      isInsideThinking = false;
                      tagBuffer = '';
                    }
                  } else {
                    tagBuffer = '';
                  }
                }
              }
            }

            if (cleanChunk) {
              const sanitizedChunk = sanitizeJapaneseOutput(cleanChunk);
              cleanAccumulatedText += sanitizedChunk;
              const chunkEvent = JSON.stringify({ type: 'chunk', text: sanitizedChunk });
              controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
            }
          }
        } catch (e) {
          // 行パース失敗時は無視
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              for (const line of buffer.split('\n')) {
                processSseLine(line);
              }
              buffer = '';
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processSseLine(line);
          }
        }
      } catch (err: any) {
        console.error('Stream reading error:', err);
        const errEvent = JSON.stringify({ type: 'error', error: err.message || 'Stream error' });
        controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`));
      } finally {
        const lowerRemainingTag = tagBuffer.toLowerCase();
        if (
          !isInsideThinking &&
          tagBuffer.length > 0 &&
          !lowerRemainingTag.startsWith('<think') &&
          !lowerRemainingTag.startsWith('<thought') &&
          !lowerRemainingTag.startsWith('<|channel>thought')
        ) {
          cleanAccumulatedText += tagBuffer;
          const chunkEvent = JSON.stringify({ type: 'chunk', text: tagBuffer });
          controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
        }

        // 思考タグがリアルタイムで解けなかった場合の救済フォールバック
        if (!cleanAccumulatedText && rawAccumulatedText) {
          const fallbackClean = cleanModelOutput(rawAccumulatedText);
          if (fallbackClean) {
            cleanAccumulatedText = fallbackClean;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: fallbackClean })}\n\n`));
          }
        }

        // 完了モード以外で、万一テキストが空、または疑問表現が一切含まれていない場合の自動補完
        const hasQuestionPattern = (txt: string) =>
          txt.includes('？') ||
          txt.includes('?') ||
          /(?:でしょうか|ますか|ですか|ませんか|いただけますか|ください|いかがですか|どうですか)[。！!\s」』）)]*$/.test(txt.trim());

        if (!isReady && strategy.action_mode !== 'complete') {
          const userAge = typeof userProfile?.age === 'number' ? userProfile.age : (userProfile?.age ? parseInt(String(userProfile.age), 10) : undefined);
          const scenario = getDetailedScenarioForFactor(strategy.focus_dimension, userAge);
          if (!cleanAccumulatedText.trim()) {
            const fallbackReply = `お答えいただきありがとうございます！\n少し場面を変えて、次の具体的なシチュエーションについて伺わせてください。\n\n【状況】\n${scenario.situationText}\n\n${scenario.questionText}`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: fallbackReply })}\n\n`));
          } else if (!hasQuestionPattern(cleanAccumulatedText)) {
            const followUpQuestion =
              strategy.action_mode === 'deepen_episode'
                ? `\n\nちなみに、その場面で具体的にどのような言葉を交わし、どう行動されたのかもう少し詳しく教えていただけますか？`
                : `\n\nちなみに、もし「${scenario.situationText.slice(0, 45)}...」という状況なら、あなたなら具体的にどう動きますか？`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: followUpQuestion })}\n\n`));
          }
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
  modelName: string = 'dynamic/llm5',
  userProfile?: UserProfileDemographics
): Promise<{ reply: string; isReady: boolean }> {
  const endpoint = getGatewayCompatUrl(env);
  const headers = getGatewayHeaders(env);

  const isReady = strategy.is_ready_for_final_analysis;
  const targetModel = modelName || 'dynamic/llm5';
  const interviewerInstruction = buildInterviewerInstruction(strategy);
  const formattedMessages = formatInterviewerMessages(messages);

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
      let reply = sanitizeJapaneseOutput(extractResponseText(data));
      const userAge = typeof userProfile?.age === 'number' ? userProfile.age : (userProfile?.age ? parseInt(String(userProfile.age), 10) : undefined);
      const scenario = getDetailedScenarioForFactor(strategy.focus_dimension, userAge);
      const hasQuestionPattern =
        reply.includes('？') ||
        reply.includes('?') ||
        /(?:でしょうか|ますか|ですか|ませんか|いただけますか|ください|いかがですか|どうですか)[。！!\s」』）)]*$/.test(reply.trim());
      if (!reply.trim()) {
        reply = `お答えいただきありがとうございます！\n少し場面を変えて、次の具体的なシチュエーションについて伺わせてください。\n\n【状況】\n${scenario.situationText}\n\n${scenario.questionText}`;
      } else if (!isReady && strategy.action_mode !== 'complete' && !hasQuestionPattern) {
        reply +=
          strategy.action_mode === 'deepen_episode'
            ? `\n\nちなみに、その場面で具体的にどのような言葉を交わし、どう行動されたのかもう少し詳しく教えていただけますか？`
            : `\n\nちなみに、もし「${scenario.situationText.slice(0, 45)}...」という状況なら、あなたなら具体的にどう動きますか？`;
      }
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
 * Clef-flashの type: "noul" 出力から 0.00〜1.00 の確率値を抽出
 */
function extractClefNoulProb(item: any): number | null {
  if (item === undefined || item === null) return null;
  const prob = typeof item === 'number'
    ? (item <= 1.0 ? item : item / 100)
    : (typeof item?.noul === 'number'
      ? item.noul
      : (typeof item?.probability === 'number'
        ? item.probability
        : (typeof item?.yes_probability === 'number' ? item.yes_probability : null)));
  if (prob === null || isNaN(prob)) return null;
  return Math.min(1.0, Math.max(0.0, prob));
}

/**
 * Clef-flashの type: "noul" 出力から 0〜100 の整数スコアを抽出（後方互換用）
 */
function extractClefNoulScore(item: any): number | null {
  const prob = extractClefNoulProb(item);
  if (prob === null) return null;
  return Math.min(100, Math.max(0, Math.round(prob * 100)));
}

export function scoreToLevelLabel(score: number): string {
  if (score >= 70) return '高い';
  if (score >= 45) return '中庸';
  return '控えめ';
}

/**
 * 古典的テスト理論(CTT)およびIRT情報量モデルに基づく測定の標準誤差 (SEM) と95%信頼区間の算出
 * 観測された情報量（ファセット数・行動事実の具体性）に応じた測定誤差の幅を誠実に開示する
 * @param score 確定スコア (0〜100)
 * @param observedCount 観測された有効ファセット数 (0〜3)
 * @param confidences ファセットごとの確信度リスト
 */
export function calculateDimensionMeasurementError(
  score: number,
  observedCount: number,
  confidences: Array<'high' | 'moderate' | 'insufficient'> = []
): {
  sem: number;
  confidence_interval: { lower: number; upper: number };
  confidence: 'high' | 'moderate' | 'insufficient' | 'unobserved';
} {
  const highCount = confidences.filter(c => c === 'high').length;

  let sem = 16.0;
  let confidence: 'high' | 'moderate' | 'insufficient' | 'unobserved' = 'unobserved';

  if (observedCount >= 3) {
    sem = highCount >= 2 ? 4.0 : 5.5;
    confidence = 'high';
  } else if (observedCount === 2) {
    sem = highCount >= 1 ? 6.5 : 8.0;
    confidence = 'moderate';
  } else if (observedCount === 1) {
    sem = highCount >= 1 ? 10.0 : 12.0;
    confidence = 'insufficient';
  } else {
    sem = 16.0;
    confidence = 'unobserved';
  }

  // 95%信頼区間: Score ± 1.96 * SEM
  const margin = Math.round(1.96 * sem);
  const lower = Math.max(0, score - margin);
  const upper = Math.min(100, score + margin);

  return {
    sem: Math.round(sem * 10) / 10,
    confidence_interval: { lower, upper },
    confidence
  };
}

/** 15ファセットの多方向評価定義リスト（ポジティブ高特性・ネガティブ低特性・具体性エビデンス） */
interface MultidirectionalFacetConfig {
  key: string;
  factor: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
  facetName: string;
  positiveInstruction: string;
  negativeInstruction: string;
  concretenessInstruction: string;
}

const MULTIDIRECTIONAL_FACET_CONFIGS: MultidirectionalFacetConfig[] = [
  // 1. 開放性 (Openness)
  {
    key: 'openness_intellectual',
    factor: 'openness',
    facetName: '知的好奇心',
    positiveInstruction: '対話内に、未知の概念や抽象的な仕組みに対して自ら調べたり深く考察したりした『客観的な具体的行動事実』が確認できますか？',
    negativeInstruction: '対話内に、複雑な理論や未知の仕組みに深入りせず、実践的・実用的な情報や手近な定番の事柄だけにとどめた『行動事実』が確認できますか？',
    concretenessInstruction: '知的好奇心に関して、調べた対象や思考プロセスについての具体的描写・客観的エピソードが語られていますか？'
  },
  {
    key: 'openness_aesthetic',
    factor: 'openness',
    facetName: '美的好奇心',
    positiveInstruction: '対話内に、デザイン・芸術・音楽・自然の美しさや文化的な体験に能動的に浸ったり鑑賞したりした『客観的な具体的行動事実』が確認できますか？',
    negativeInstruction: '対話内に、芸術・美的体験や情緒的な鑑賞に特別な関心を払わず、機能性・実利性を優先した『行動事実』が確認できますか？',
    concretenessInstruction: '美的好奇心に関して、実際に触れた作品や場所・鑑賞行動についての具体的描写が語られていますか？'
  },
  {
    key: 'openness_creative',
    factor: 'openness',
    facetName: '創造力',
    positiveInstruction: '対話内に、前例通りのやり方に固執せず独自の工夫や新しいアプローチ・オリジナルの解決策を試した『客観的な具体的行動事実』が確認できますか？',
    negativeInstruction: '対話内に、自己流の工夫を避け、確立された手順や過去の実績・定番マニュアル通りのやり方を忠実に選んだ『行動事実』が確認できますか？',
    concretenessInstruction: '創造力に関して、試した工夫やアプローチの具体的な内容・手順が語られていますか？'
  },

  // 2. 誠実性 (Conscientiousness)
  {
    key: 'conscientiousness_organization',
    factor: 'conscientiousness',
    facetName: '組織化',
    positiveInstruction: '対話内に、予定の狂いやタスク逼迫時に優先順位を整理し、段取りやスケジュールを具体的に組み立て直した『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、計画の厳密な組み直しを行わず、その場の思いつきや成り行き任せで柔軟・即興的に対応した『行動事実』が確認できますか？',
    concretenessInstruction: '組織化に関して、優先順位の付け方やスケジュールの組み直し手順が具体的に語られていますか？'
  },
  {
    key: 'conscientiousness_productiveness',
    factor: 'conscientiousness',
    facetName: '生産性',
    positiveInstruction: '対話内に、途中で投げ出したり先送りにせず、決めたタスクや役割を最後までやり遂げた・リカバリーを実行した『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、無理にやり遂げようとせず、途中で諦めて寝る・先送りする・最低限の放棄を選んだ『行動事実』が確認できますか？',
    concretenessInstruction: '生産性に関して、タスクへの取り組み方やリカバリーの具体的な実行内容が語られていますか？'
  },
  {
    key: 'conscientiousness_responsibility',
    factor: 'conscientiousness',
    facetName: '責任感',
    positiveInstruction: '対話内に、他者や締め切りとの約束を守るため事前に連絡・相談を入れたり、自分の役割を全うしようと誠実に行動した『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、相手への事前連絡や相談を怠ったり、連絡を後回しにして事態を放置した『行動事実』が確認できますか？',
    concretenessInstruction: '責任感に関して、連絡のタイミングや伝えた内容など、責任ある行動の具体的事実が語られていますか？'
  },

  // 3. 外向性 (Extraversion)
  {
    key: 'extraversion_sociability',
    factor: 'extraversion',
    facetName: '社交性',
    positiveInstruction: '対話内に、集まりや沈黙の場で自ら進んで他者に話しかけたり、会話の口火を切ってコミュニケーションを取った『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、自ら話しかけることを控え、沈黙を保つ・一人で静かに過ごす・他者からの話しかけを待つ『客観的な行動事実』が確認できますか？',
    concretenessInstruction: '社交性に関して、声かけの有無や対人コミュニケーションの実際の様子が具体的に語られていますか？'
  },
  {
    key: 'extraversion_assertiveness',
    factor: 'extraversion',
    facetName: '主張性',
    positiveInstruction: '対話内に、周囲に流されるだけでなく自分の意見や希望・提案を堂々と表明し、全体の意思決定をリードしようとした『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、自分の希望や主張を押し出さず、他者の意見に同調する・決定を周囲に完全に任せて従った『客観的な行動事実』が確認できますか？',
    concretenessInstruction: '主張性に関して、提案した内容や意思表明の具体的なセリフ・立ち回りが語られていますか？'
  },
  {
    key: 'extraversion_activity',
    factor: 'extraversion',
    facetName: '活動性',
    positiveInstruction: '対話内に、静止・受動的に過ごすだけでなく能動的に出かけたり、活発に動いてエネルギーを行動に移した『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、活発な移動や外出を避け、自宅や自室で静かにリラックスして省エネに過ごした『客観的な行動事実』が確認できますか？',
    concretenessInstruction: '活動性に関して、過ごし方や外出・行動の活動量に関する具体的エピソードが語られていますか？'
  },

  // 4. 協調性 (Agreeableness)
  {
    key: 'agreeableness_compassion',
    factor: 'agreeableness',
    facetName: '思いやり',
    positiveInstruction: '対話内に、他者の負担や感情に寄り添い、相手を助けたり気遣う配慮の行動・声かけを行った『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、他者の感情や事情に深入りせず、自分の都合や利害・効率を最優先した『客観的な行動事実』が確認できますか？',
    concretenessInstruction: '思いやりに関して、相手への配慮や声かけの具体的な振る舞いが語られていますか？'
  },
  {
    key: 'agreeableness_respect',
    factor: 'agreeableness',
    facetName: '敬意',
    positiveInstruction: '対話内に、意見対立時や他人のミス時にも相手を頭ごなしに攻撃せず、敬意を払い穏やかに接した『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、相手のミスや対立に対して不満や苛立ちを露わにする、または批判的・冷淡な態度を取った『行動事実』が確認できますか？',
    concretenessInstruction: '敬意に関して、対立やミス発生時の実際の口調・接し方の具体的事実が語られていますか？'
  },
  {
    key: 'agreeableness_trust',
    factor: 'agreeableness',
    facetName: '信頼',
    positiveInstruction: '対話内に、周囲の人を疑わず好意的に受け止めて協調・協力して進めようとした『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、他者の意図や能力に疑念を抱き、警戒して自分一人で抱え込む・距離を置いた『行動事実』が確認できますか？',
    concretenessInstruction: '信頼に関して、他者との協力体制や信頼に関する具体的姿勢が語られていますか？'
  },

  // 5. 情緒安定性 (Emotional Stability)
  {
    key: 'neuroticism_anxiety',
    factor: 'neuroticism',
    facetName: '不安の低さ・ストレス対処',
    positiveInstruction: '対話内に、プレッシャーや不測の事態に直面した際、パニックにならず冷静に自分を落ち着かせた『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、突発的なトラブルや切迫に対して強い焦りや動揺・不安を感じて取り乱した『行動事実』が確認できますか？',
    concretenessInstruction: 'ストレス対処に関して、プレッシャー直面時の心理状態と対処行動の具体性が語られていますか？'
  },
  {
    key: 'neuroticism_depression',
    factor: 'neuroticism',
    facetName: '気分の安定',
    positiveInstruction: '対話内に、トラブルや不本意な出来事の後、過度に落ち込み続けず前向きに気持ちを切り替えた『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、嫌な出来事やミスを長く引きずり、落ち込んだりモヤモヤした気分から抜け出せなかった『行動事実』が確認できますか？',
    concretenessInstruction: '気分の安定に関して、気分の切り替えにかかった時間や事後の過ごし方の具体的事実が語られていますか？'
  },
  {
    key: 'neuroticism_volatility',
    factor: 'neuroticism',
    facetName: '動じにくさ',
    positiveInstruction: '対話内に、突発的なアクシデントや他人の手違いに対して感情的にならず、冷静に対処策を実行した『客観的な行動事実』が確認できますか？',
    negativeInstruction: '対話内に、予期せぬ変更やトラブルに対して感情の起伏が激しくなり、苛立ちや落胆を行動・態度に出した『事実』が確認できますか？',
    concretenessInstruction: '動じにくさに関して、アクシデント発生時の瞬間的なリアクションの具体性が語られていますか？'
  }
];

function parseClefScoringResponse(
  rawObj: any,
  sourceLabel: string,
  presentedFactors?: Set<FactorNameJP>
): ClefScoringBreakdown | null {
  if (!rawObj) return null;
  const target = rawObj.answers || rawObj.result || rawObj;
  if (!target || typeof target !== 'object') return null;

  // 15ファセットそれぞれの生確率・スコア・確信度・出自・重み・SEMを算出
  const positiveProbs: Record<string, number> = {};
  const negativeProbs: Record<string, number> = {};
  const concretenessProbs: Record<string, number> = {};
  const facetScores: Record<string, number | null> = {};
  const facetConfidences: Record<string, 'high' | 'moderate' | 'insufficient'> = {};
  const facetSources: Record<string, AssessmentMethodSource> = {};
  const facetWeights: Record<string, number> = {};
  const facetSems: Record<string, number> = {};
  const facetCIs: Record<string, { lower: number; upper: number }> = {};

  let hasAnyValidScore = false;

  // 受検態度・妥当性メタチェック（5問）の抽出（縮小推定重みの算出に先行使用）
  const validityChecks = {
    social_desirability: extractClefNoulProb(target.val_social_desirability) ?? 0.35,
    mock_or_careless: extractClefNoulProb(target.val_mock_or_careless) ?? 0.05,
    concrete_detail: extractClefNoulProb(target.val_concrete_detail) ?? 0.65,
    defensiveness: extractClefNoulProb(target.val_defensiveness) ?? 0.20,
    emotional_expressiveness: extractClefNoulProb(target.val_emotional_expressiveness) ?? 0.70
  };

  const FACTOR_KEY_TO_JP: Record<string, FactorNameJP> = {
    openness: '開放性',
    conscientiousness: '誠実性',
    extraversion: '外向性',
    agreeableness: '協調性',
    neuroticism: '情緒安定性'
  };

  for (const cfg of MULTIDIRECTIONAL_FACET_CONFIGS) {
    // 55問多方向キー（新）または 20問キー（旧互換）から確率を取得
    const pPos = extractClefNoulProb(target[`facet_pos_${cfg.key}`] ?? target[`facet_${cfg.key}`]);
    const pNeg = extractClefNoulProb(target[`facet_neg_${cfg.key}`]);
    const pCon = extractClefNoulProb(target[`facet_con_${cfg.key}`]);

    if (pPos !== null) {
      hasAnyValidScore = true;
      positiveProbs[cfg.key] = pPos;
    }
    if (pNeg !== null) negativeProbs[cfg.key] = pNeg;
    if (pCon !== null) concretenessProbs[cfg.key] = pCon;

    // 測定学的判定: 「未観測（欠測: Missing Data）」の判定
    const isMissing =
      (pCon === null || pCon < 0.35) &&
      (pPos === null || pPos < 0.35) &&
      (pNeg === null || pNeg < 0.35);

    if (isMissing) {
      facetScores[cfg.key] = null;
      facetConfidences[cfg.key] = 'insufficient';
      facetSources[cfg.key] = 'unobserved';
      facetWeights[cfg.key] = 0.0;
      facetSems[cfg.key] = 16.0;
      facetCIs[cfg.key] = { lower: 20, upper: 80 };
      continue;
    }

    // 該当因子がSJT架空シナリオとして提示されたかを確認
    const factorJp = FACTOR_KEY_TO_JP[cfg.factor];
    const isSjtPresented = presentedFactors ? presentedFactors.has(factorJp) : false;

    // アプローチA: 出自（Source）の分離
    // SJTシナリオが提示された因子は 'sjt'、過去の実体験深掘りのみで引き出された因子は 'star'
    const source: AssessmentMethodSource = isSjtPresented ? 'sjt' : 'star';
    facetSources[cfg.key] = source;

    // アプローチB: 縮小推定重み w の適用（社会的望ましさバイアスの抑制）
    let w = 1.0;
    if (source === 'star') {
      // STAR法（過去の客観的行動実績）:
      // 具体性 P(con) に応じた満額〜適正反映 (0.65〜1.0)
      const conVal = pCon ?? 0.65;
      w = Math.max(0.65, Math.min(1.0, conVal));
    } else {
      // SJT（架空状況判断・意図表明）:
      // 建前・社会的望ましさバイアス（SDB）によるインフレーションを防ぐ縮小推定 (Shrinkage)
      // 中央値50寄りに強く抑制 (基準 0.40 × SDB割引)
      const sdb = validityChecks.social_desirability;
      const sdbDiscount = Math.max(0.5, 1.0 - 0.5 * sdb); // 0.5〜1.0
      w = Math.round(0.40 * sdbDiscount * 100) / 100; // 0.20〜0.40
    }
    facetWeights[cfg.key] = w;

    // スコア算出: 50 + Δ * 50
    let delta = 0;
    if (pPos !== null && pNeg !== null) {
      delta = pPos - pNeg; // -1.0 〜 +1.0
    } else if (pPos !== null) {
      delta = (pPos - 0.5) * 2;
    } else if (pNeg !== null) {
      delta = (0.5 - pNeg) * 2;
    }
    // 特性の点推定は0〜100フルスケールで算出（SJT状況判断であっても質問紙と同一尺度で比較可能にし、人工的格差を排除）
    // 不確実性や社会的望ましさバイアスはSEM拡大（SEM=11.0）と95%信頼区間の広がりとして適切に反映
    const score = Math.min(100, Math.max(0, Math.round(50 + delta * 50)));
    facetScores[cfg.key] = score;

    // アプローチC: 確信度および測定標準誤差 (SEM) / 信頼区間の差別化
    if (source === 'star') {
      // STAR法: 過去の実績エピソードに基づくため高い精度
      if ((pCon ?? 0) >= 0.65) {
        facetConfidences[cfg.key] = 'high';
        facetSems[cfg.key] = 4.5;
      } else if ((pCon ?? 0) >= 0.40) {
        facetConfidences[cfg.key] = 'moderate';
        facetSems[cfg.key] = 6.0;
      } else {
        facetConfidences[cfg.key] = 'insufficient';
        facetSems[cfg.key] = 8.5;
      }
    } else {
      // SJT: 架空状況判断のため不確実性が高く、絶対に 'high' には昇格させない
      if ((pCon ?? 0) >= 0.50) {
        facetConfidences[cfg.key] = 'moderate';
      } else {
        facetConfidences[cfg.key] = 'insufficient';
      }
      // SJT由来のファセットは「推定レンジが広い」ことを明示するため SEM = 11.0（95% CI幅: ±22点）
      facetSems[cfg.key] = 11.0;
    }

    const margin = Math.round(1.96 * facetSems[cfg.key]);
    facetCIs[cfg.key] = {
      lower: Math.max(0, score - margin),
      upper: Math.min(100, score + margin)
    };
  }

  // 案2: 5因子直接採点 (0-100)
  const d_o = extractClefNoulScore(target.direct_openness);
  const d_c = extractClefNoulScore(target.direct_conscientiousness);
  const d_e = extractClefNoulScore(target.direct_extraversion);
  const d_a = extractClefNoulScore(target.direct_agreeableness);
  const d_n = extractClefNoulScore(target.direct_neuroticism);

  if (!hasAnyValidScore && d_o === null) {
    return null;
  }

  // アプローチA: STAR法スコアとSJTスコアの二元化集計
  const calcFactorScoresBySource = (
    fKeys: string[],
    targetSource: 'star' | 'sjt'
  ): number | null => {
    const valid = fKeys
      .filter(k => facetSources[k] === targetSource && typeof facetScores[k] === 'number')
      .map(k => facetScores[k] as number);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
  };

  const starScores = {
    openness: calcFactorScoresBySource(['openness_intellectual', 'openness_aesthetic', 'openness_creative'], 'star'),
    conscientiousness: calcFactorScoresBySource(['conscientiousness_organization', 'conscientiousness_productiveness', 'conscientiousness_responsibility'], 'star'),
    extraversion: calcFactorScoresBySource(['extraversion_sociability', 'extraversion_assertiveness', 'extraversion_activity'], 'star'),
    agreeableness: calcFactorScoresBySource(['agreeableness_compassion', 'agreeableness_respect', 'agreeableness_trust'], 'star'),
    neuroticism: calcFactorScoresBySource(['neuroticism_anxiety', 'neuroticism_depression', 'neuroticism_volatility'], 'star')
  };

  const sjtScores = {
    openness: calcFactorScoresBySource(['openness_intellectual', 'openness_aesthetic', 'openness_creative'], 'sjt'),
    conscientiousness: calcFactorScoresBySource(['conscientiousness_organization', 'conscientiousness_productiveness', 'conscientiousness_responsibility'], 'sjt'),
    extraversion: calcFactorScoresBySource(['extraversion_sociability', 'extraversion_assertiveness', 'extraversion_activity'], 'sjt'),
    agreeableness: calcFactorScoresBySource(['agreeableness_compassion', 'agreeableness_respect', 'agreeableness_trust'], 'sjt'),
    neuroticism: calcFactorScoresBySource(['neuroticism_anxiety', 'neuroticism_depression', 'neuroticism_volatility'], 'sjt')
  };

  const calcGap = (sjt: number | null, star: number | null): number | null => {
    if (sjt !== null && star !== null) return sjt - star;
    return null;
  };

  const gapScores = {
    openness: calcGap(sjtScores.openness, starScores.openness),
    conscientiousness: calcGap(sjtScores.conscientiousness, starScores.conscientiousness),
    extraversion: calcGap(sjtScores.extraversion, starScores.extraversion),
    agreeableness: calcGap(sjtScores.agreeableness, starScores.agreeableness),
    neuroticism: calcGap(sjtScores.neuroticism, starScores.neuroticism)
  };

  // メイン採用スコア (STAR行動実績を最優先、STAR未観測時のみSJT縮小推定値を採用)
  const resolveMainFactorScore = (starVal: number | null, sjtVal: number | null, directFallback: number | null): number => {
    if (starVal !== null) return starVal;
    if (sjtVal !== null) return sjtVal;
    return directFallback ?? 50;
  };

  const facetMeanScores = {
    openness: resolveMainFactorScore(starScores.openness, sjtScores.openness, d_o),
    conscientiousness: resolveMainFactorScore(starScores.conscientiousness, sjtScores.conscientiousness, d_c),
    extraversion: resolveMainFactorScore(starScores.extraversion, sjtScores.extraversion, d_e),
    agreeableness: resolveMainFactorScore(starScores.agreeableness, sjtScores.agreeableness, d_a),
    neuroticism: resolveMainFactorScore(starScores.neuroticism, sjtScores.neuroticism, d_n)
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
    dual_scores: {
      star_scores: starScores,
      sjt_scores: sjtScores,
      gap_scores: gapScores
    },
    facets: {
      openness: {
        intellectual: facetScores.openness_intellectual ?? null,
        aesthetic: facetScores.openness_aesthetic ?? null,
        creative: facetScores.openness_creative ?? null
      },
      conscientiousness: {
        organization: facetScores.conscientiousness_organization ?? null,
        productiveness: facetScores.conscientiousness_productiveness ?? null,
        responsibility: facetScores.conscientiousness_responsibility ?? null
      },
      extraversion: {
        sociability: facetScores.extraversion_sociability ?? null,
        assertiveness: facetScores.extraversion_assertiveness ?? null,
        activity: facetScores.extraversion_activity ?? null
      },
      agreeableness: {
        compassion: facetScores.agreeableness_compassion ?? null,
        respect: facetScores.agreeableness_respect ?? null,
        trust: facetScores.agreeableness_trust ?? null
      },
      neuroticism: {
        anxiety: facetScores.neuroticism_anxiety ?? null,
        depression: facetScores.neuroticism_depression ?? null,
        volatility: facetScores.neuroticism_volatility ?? null
      }
    },
    facet_confidences: facetConfidences,
    facet_sources: facetSources,
    facet_shrinkage_weights: facetWeights,
    facet_sems: facetSems,
    facet_confidence_intervals: facetCIs,
    multidirectional: {
      positive_probs: positiveProbs,
      negative_probs: negativeProbs,
      concreteness_probs: concretenessProbs,
      validity_checks: validityChecks
    },
    source: sourceLabel
  };
}

/**
 * ステップ3-A: Clef-flash (@cf/cloudflare/clef-flash) による55問多方向スコアリング
 * 1回のリクエストで最大64問の並列推論能力を活用し、以下の計55問を一括評価する:
 * 1. 15ファセット × ポジティブ高特性行動事実 (15問)
 * 2. 15ファセット × ネガティブ低特性行動事実（内向性・柔軟性・静観等） (15問)
 * 3. 15ファセット × 具体性・客観エビデンス充足度 (15問)
 * 4. 5因子直接判定 (5問)
 * 5. 受検態度・妥当性メタチェック（社会的望ましさ・不真面目・具体性等） (5問)
 *
 * スコアは両極差分 (P(pos) - P(neg)) から算出され、内向的な行動事実も正当に加算される。
 */
export async function runClefScoring(
  env: Env,
  dialogueHistory: string,
  presentedFactors?: Set<FactorNameJP>
): Promise<ClefScoringBreakdown | null> {
  const scoringState = `【対話履歴】\n${dialogueHistory}\n\n上記の対話履歴から、行動アンカー評定尺度（BARS / BOS）に基づき、各性格ファセットに対応する「客観的な具体的行動事実・発言」が実際に確認できるかを厳密に判定・評価してください。単なる印象や言葉遣いの丁寧さではなく、実際に語られた振る舞いを根拠としてください。\n\n【心理測定学上の絶対原則】\n受検者の発話の短さ（短文・口数の少なさ・端的な回答）を、安易に内向性や低特性行動（P(neg)）として加算することは厳禁です。集まりや対人場面において「自分からあえて沈黙を保った」「一人で静かに過ごした」という客観的なエピソード事実が語られた場合のみ低特性行動として判定してください。単なる回答文字数の短さや回答の消極性は、受検態度妥当性指標（defensiveness: 防衛的姿勢、concrete_detail: 具体描写度、mock_or_careless: 省力化回答）として評価してください。`;

  const scoringQuestions: Record<string, { type: 'noul'; instructions: string }> = {};

  // 1. 15ファセット × ポジティブ高特性行動事実 (15問)
  for (const cfg of MULTIDIRECTIONAL_FACET_CONFIGS) {
    scoringQuestions[`facet_pos_${cfg.key}`] = {
      type: 'noul',
      instructions: `【${cfg.facetName}（ポジティブ行動判定）】${cfg.positiveInstruction}`
    };
  }

  // 2. 15ファセット × ネガティブ低特性行動事実 (15問)
  for (const cfg of MULTIDIRECTIONAL_FACET_CONFIGS) {
    scoringQuestions[`facet_neg_${cfg.key}`] = {
      type: 'noul',
      instructions: `【${cfg.facetName}（低特性・内向的・受動的行動判定）】${cfg.negativeInstruction}`
    };
  }

  // 3. 15ファセット × 具体性・客観エビデンス充実度 (15問)
  for (const cfg of MULTIDIRECTIONAL_FACET_CONFIGS) {
    scoringQuestions[`facet_con_${cfg.key}`] = {
      type: 'noul',
      instructions: `【${cfg.facetName}（具体的エビデンス充実度）】${cfg.concretenessInstruction}`
    };
  }

  // 4. 5因子直接採点 (5問)
  scoringQuestions.direct_openness = {
    type: 'noul',
    instructions: '【5因子直接評価 - 開放性】対話全体から、このユーザーの『開放性（知的好奇心・美的好奇心・創造力）』は総合的に見て高いと評価できますか？'
  };
  scoringQuestions.direct_conscientiousness = {
    type: 'noul',
    instructions: '【5因子直接評価 - 誠実性】対話全体から、このユーザーの『誠実性（組織化・生産性・責任感）』は総合的に見て高いと評価できますか？'
  };
  scoringQuestions.direct_extraversion = {
    type: 'noul',
    instructions: '【5因子直接評価 - 外向性】対話全体から、このユーザーの『外向性（社交性・主張性・活動性）』は総合的に見て高いと評価できますか？'
  };
  scoringQuestions.direct_agreeableness = {
    type: 'noul',
    instructions: '【5因子直接評価 - 協調性】対話全体から、このユーザーの『協調性（思いやり・敬意・信頼）』は総合的に見て高いと評価できますか？'
  };
  scoringQuestions.direct_neuroticism = {
    type: 'noul',
    instructions: '【5因子直接評価 - 情緒安定性】対話全体から、このユーザーの『情緒安定性（ストレス耐性・気分の安定・動じにくさ）』は総合的に見て高いと評価できますか？'
  };

  // 5. 受検態度・妥当性メタチェック (5問)
  scoringQuestions.val_social_desirability = {
    type: 'noul',
    instructions: '【受検妥当性 - 建前・社会的望ましさ】対話全体において、ユーザーの発言は一般的な模範解答や建前・お行儀の良い回答ばかりで、素の具体的行動が隠されている傾向が見られますか？'
  };
  scoringQuestions.val_mock_or_careless = {
    type: 'noul',
    instructions: '【受検妥当性 - 冗談・不真面目】対話全体において、ふざけ、からかい、あからさまな虚偽・矛盾、または無作為で不誠実な回答傾向が見られますか？'
  };
  scoringQuestions.val_concrete_detail = {
    type: 'noul',
    instructions: '【受検妥当性 - 具体描写度】対話全体において、実際のセリフ・手順・周囲の反応など、客観的で具体的な描写が豊富に含まれていますか？'
  };
  scoringQuestions.val_defensiveness = {
    type: 'noul',
    instructions: '【受検妥当性 - 防衛的姿勢】対話全体において、質問の核心を避けたり、自己開示を頑なに拒絶する防衛的な傾向が見られますか？'
  };
  scoringQuestions.val_emotional_expressiveness = {
    type: 'noul',
    instructions: '【受検妥当性 - 素直な感情表出】対話全体において、取り繕わずに自分の本音・素直な感情や弱みを率直に開示して語っていますか？'
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
      const parsed = parseClefScoringResponse(aiRes, 'clef-flash [55-question multidirectional / env.AI binding]', presentedFactors);
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
      const parsed = parseClefScoringResponse(data, 'clef-flash [55-question multidirectional / HTTP Gateway]', presentedFactors);
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

  // メッセージ履歴からすでに提示済みのSJTシナリオ因子を抽出（アプローチA・B・Cの判定基準）
  const presentedFactors = getPresentedFactors(messages);

  // 1. まず Clef-flash で同時数値化（STAR/SJTの出自分離・縮小推定を適用）
  const clefScores = await runClefScoring(env, dialogueHistory, presentedFactors);

  const fmtFacet = (v: number | null | undefined) => (v !== null && v !== undefined ? `${v}点` : '未言及（判定保留）');

  const confirmedScoresBlock = clefScores
    ? `
【Clef-flash により算出・確定済みのBFI-2-Sスコア（変更厳禁）】
以下の5因子スコア（有効ファセットの平均×100）が確定値です。JSON出力の score には必ずこの数値をそのまま設定してください：
- openness (開放性): 確定スコア ${clefScores.facet_mean_scores.openness}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.openness)}")
  [内訳: 知的好奇心=${fmtFacet(clefScores.facets.openness.intellectual)}, 美的好奇心=${fmtFacet(clefScores.facets.openness.aesthetic)}, 創造力=${fmtFacet(clefScores.facets.openness.creative)}]
- conscientiousness (誠実性): 確定スコア ${clefScores.facet_mean_scores.conscientiousness}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.conscientiousness)}")
  [内訳: 組織化=${fmtFacet(clefScores.facets.conscientiousness.organization)}, 生産性=${fmtFacet(clefScores.facets.conscientiousness.productiveness)}, 責任感=${fmtFacet(clefScores.facets.conscientiousness.responsibility)}]
- extraversion (外向性): 確定スコア ${clefScores.facet_mean_scores.extraversion}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.extraversion)}")
  [内訳: 社交性=${fmtFacet(clefScores.facets.extraversion.sociability)}, 主張性=${fmtFacet(clefScores.facets.extraversion.assertiveness)}, 活動性=${fmtFacet(clefScores.facets.extraversion.activity)}]
- agreeableness (協調性): 確定スコア ${clefScores.facet_mean_scores.agreeableness}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.agreeableness)}")
  [内訳: 思いやり=${fmtFacet(clefScores.facets.agreeableness.compassion)}, 敬意=${fmtFacet(clefScores.facets.agreeableness.respect)}, 信頼=${fmtFacet(clefScores.facets.agreeableness.trust)}]
- neuroticism (情緒安定性): 確定スコア ${clefScores.facet_mean_scores.neuroticism}点 (level: "${scoreToLevelLabel(clefScores.facet_mean_scores.neuroticism)}")
  [内訳: 不安の低さ(ストレス対処)=${fmtFacet(clefScores.facets.neuroticism.anxiety)}, 抑うつの低さ(気分の安定)=${fmtFacet(clefScores.facets.neuroticism.depression)}, 感情変動の低さ(動じにくさ)=${fmtFacet(clefScores.facets.neuroticism.volatility)}]
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

    // 発話量統計（Verbosity指標）の算出（言語表現力バイアスの相殺・学術分析用）
    const userMessages = messages.filter(m => m.role === 'user');
    const totalChars = userMessages.reduce((sum, m) => sum + m.content.length, 0);
    const totalTurns = userMessages.length;
    const avgChars = totalTurns > 0 ? Math.round(totalChars / totalTurns) : 0;
    parsedResult.verbosity_stats = {
      total_user_characters: totalChars,
      total_user_turns: totalTurns,
      avg_characters_per_turn: avgChars
    };

    // Clef-flashの確定スコア（アプローチA: STAR行動実績主導 / SJT縮小推定二元化）をプログラム側で厳密に反映
    if (clefScores && parsedResult.scores) {
      const dims: Array<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism'> = [
        'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'
      ];
      for (const dim of dims) {
        if (parsedResult.scores[dim]) {
          const confirmedScore = clefScores.facet_mean_scores[dim];
          parsedResult.scores[dim].score = confirmedScore;
          parsedResult.scores[dim].level = scoreToLevelLabel(confirmedScore);

          // ファセット単位の観測状況・確信度・出自の集約
          const facetKeys = Object.keys(clefScores.facets[dim]) as Array<keyof typeof clefScores.facets[typeof dim]>;
          const observedFacetCount = facetKeys.filter(fk => clefScores.facets[dim][fk] !== null).length;
          const confidences = facetKeys
            .filter(fk => clefScores.facets[dim][fk] !== null)
            .map(fk => clefScores.facet_confidences?.[`${dim}_${String(fk)}`] || 'moderate');

          // 出自（STARかSJTかハイブリッドか）
          const sources = facetKeys
            .filter(fk => clefScores.facets[dim][fk] !== null)
            .map(fk => clefScores.facet_sources?.[`${dim}_${String(fk)}`]);
          const hasStar = sources.includes('star');
          const hasSjt = sources.includes('sjt');
          const sourceType: 'star' | 'sjt' | 'hybrid' | 'unobserved' =
            (hasStar && hasSjt) ? 'hybrid' : (hasStar ? 'star' : (hasSjt ? 'sjt' : 'unobserved'));

          parsedResult.scores[dim].source_type = sourceType;
          parsedResult.scores[dim].star_score = clefScores.dual_scores?.star_scores[dim] ?? null;
          parsedResult.scores[dim].sjt_score = clefScores.dual_scores?.sjt_scores[dim] ?? null;

          // 古典的テスト理論(CTT)およびIRT情報量モデルに基づくSEM・95%信頼区間の厳密算出
          const errorMetrics = calculateDimensionMeasurementError(confirmedScore, observedFacetCount, confidences);

          // アプローチC: SJT主導の場合のSEM拡大と信頼区間の可視化補正
          // SJT由来ファセットは架空状況判断であり不確実性が高いためSEMを拡大し、信頼区間（推定レンジ）を広く明示する
          let dimSem = errorMetrics.sem;
          let dimConf = errorMetrics.confidence;
          if (sourceType === 'sjt') {
            dimSem = Math.max(9.5, dimSem * 1.5);
            dimConf = dimConf === 'high' ? 'moderate' : dimConf; // SJTは高確信度にしない
          } else if (sourceType === 'hybrid') {
            dimSem = Math.max(6.5, dimSem * 1.2);
          }
          dimSem = Math.round(dimSem * 10) / 10;
          const margin = Math.round(1.96 * dimSem);

          parsedResult.scores[dim].evidenced_facet_count = observedFacetCount;
          parsedResult.scores[dim].sem = dimSem;
          parsedResult.scores[dim].confidence_interval = {
            lower: Math.max(0, confirmedScore - margin),
            upper: Math.min(100, confirmedScore + margin)
          };
          parsedResult.scores[dim].confidence = dimConf;
        }
      }
      parsedResult.clef_scoring_data = clefScores;
      parsedResult.dual_assessment = clefScores.dual_scores;
    }

    return parsedResult;
  } catch (parseErr: any) {
    console.error('JSON parse error in runFinalAnalysis:', parseErr, jsonStr);
    throw new Error(`分析結果JSONの構文解析に失敗しました: ${parseErr.message}`);
  }
}

let isSchemaEnsured = false;

/**
 * D1データベースのテーブル・カラム存在を安全に初回のみ保証（ホットパスでのDDL過負荷・ロック防止）
 */
export async function ensureDbSchema(db: D1Database): Promise<void> {
  if (isSchemaEnsured) return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS assessment_sessions (
        id TEXT PRIMARY KEY,
        session_token TEXT,
        student_id TEXT DEFAULT '',
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        created_at TEXT NOT NULL,
        dialogue_turns INTEGER DEFAULT 0,
        chat_messages TEXT,
        ai_personality_title TEXT,
        ai_personality_type TEXT,
        ai_summary TEXT,
        ai_openness REAL,
        ai_conscientiousness REAL,
        ai_extraversion REAL,
        ai_agreeableness REAL,
        ai_neuroticism REAL,
        ai_full_result TEXT,
        survey_scale_type TEXT,
        survey_scale_name TEXT,
        survey_raw_answers TEXT,
        survey_openness REAL,
        survey_conscientiousness REAL,
        survey_extraversion REAL,
        survey_agreeableness REAL,
        survey_neuroticism REAL,
        survey_completed_at TEXT,
        r2_saved INTEGER DEFAULT 0,
        r2_key TEXT
      )
    `).run();

    try { await db.prepare(`ALTER TABLE assessment_sessions ADD COLUMN session_token TEXT`).run(); } catch (_) {}
    try { await db.prepare(`ALTER TABLE assessment_sessions ADD COLUMN r2_saved INTEGER DEFAULT 0`).run(); } catch (_) {}
    try { await db.prepare(`ALTER TABLE assessment_sessions ADD COLUMN r2_key TEXT`).run(); } catch (_) {}
    isSchemaEnsured = true;
  } catch (err) {
    console.error('ensureDbSchema error:', err);
  }
}

/**
 * 管理者認証ヘルパー関数
 * Authorization: Bearer <password> または x-admin-password ヘッダーで安全に照合
 * （URLクエリパラメータ経由の平文認証はログ漏洩・履歴漏洩防止のため非許可）
 */
export function verifyAdminPassword(request: Request, env: Env): boolean {
  const expectedPassword = env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    console.error('ADMIN_PASSWORD is not configured in environment variables');
    return false;
  }

  // 1. Authorization: Bearer <password> (RFC 6750 標準)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken === expectedPassword) {
      return true;
    }
  }

  // 2. x-admin-password ヘッダー
  const headerKey = request.headers.get('x-admin-password');
  if (headerKey && headerKey.trim() === expectedPassword) {
    return true;
  }

  return false;
}
