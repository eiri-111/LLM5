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

export interface BigFiveDimension {
  score: number;
  level: string;
  title: string;
  description: string;
  traits: string[];
  analysis_reasoning?: string;
  confidence?: 'high' | 'moderate' | 'insufficient';
  evidenced_facet_count?: number;
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
  /** ファセット別エビデンス充足確信度 ('high': 明確な行動事実あり, 'moderate': 言及あり, 'insufficient': 未言及/欠測) */
  facet_confidences?: Record<string, 'high' | 'moderate' | 'insufficient'>;
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
  verbosity_stats?: {
    total_user_characters: number;
    total_user_turns: number;
    avg_characters_per_turn: number;
  };
}

const DEFAULT_ACCOUNT_ID = 'e809b1129ec4b6f69520858ac79b2095';
const DEFAULT_GATEWAY_ID = 'llm5';

/** 対話ターン数（ユーザー発話回数）の制御基準 */
export const MIN_USER_TURNS = 6; // 最低ターン数（2〜3個のエピソードを深掘りして最低6ターン）
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
          'この状況になったとき、あなたなら今夜から翌朝にかけて具体的にどう動きますか？（徹夜してでも意地で仕上げる、諦めて寝て朝早起きする、相手に期限の猶予や相談の連絡を入れる、優先度をつけて最低限だけ終わらせるなど、あなたの素の行動手順や、その時の焦り・気持ちの落ち着かせ方を教えてください）'
      };

    case '外向性':
    case '協調性':
      return {
        scenarioTitle: '集まりの計画・意見対立と意思決定',
        situationText:
          '友人や知人、仲間など3〜4人で、集まりで入る食事の店や行き先を決めている場面を想像してください。相談している最中、候補が2つ挙がってお互いに譲らず意見が真っ二つに分かれ、議論が平行線のまま気まずい沈黙が流れて決まらなくなってしまいました。',
        questionText:
          'このとき、あなたはその場のメンバーに対して、具体的にどんなタイミングで何と声をかけますか？（自分から折衷案を出して場を引っ張る、誰かの意見に同調して後押しする、場を和ませる雑談を挟む、周りの様子を見て決定に任せるなど、あなたが実際に取る発言や立ち回りを教えてください）'
      };

    case '開放性':
      return {
        scenarioTitle: '休日の過ごし方・新しい刺激 vs いつもの定番',
        situationText:
          '休日に、誰とも約束がなく丸一日フリーな時間ができたとします。部屋で過ごしていて、ふと「何か普段とは違う面白いことや、新しい刺激に触れてみたい」という気分になりました。',
        questionText:
          'このとき、あなたは普段行かない新しいお店や場所に出かけたり、今まで触れたことのないジャンルの作品（動画・映画・音楽・ゲーム・本など）を、具体的にどのように探して試しますか？それとも、少し探したものの結局いつもの慣れ親しんだお気に入り（いつも通りの過ごし方・知っている作品）を選びますか？実際の探し方や選ぶ基準を教えてください。'
      };

    case '情緒安定性':
    default:
      return {
        scenarioTitle: '予定外のトラブル・他人のミスと気分の切り替え',
        situationText:
          '誰かと一緒に予定を進めている最中（または待ち合わせなど）に、相手のうっかりミスや手違いで、予定が大きく狂ったり、自分にも余計な手間がかかるトラブルが発生してしまった状況を想像してください。',
        questionText:
          'その瞬間、あなたはその相手に対してどのような口調や態度で接しますか？また、その出来事のあと、イライラや嫌な気分をどのように切り替えますか？どれくらい引きずるか、実際のあなたの反応やその後の過ごし方を教えてください。'
      };
  }
}

/**
 * これまでのユーザー発言から生活キーワード（大学、ゲーム、バイト等）を抽出し、
 * 「前話したこと」を忘れない文脈ブリッジ文を生成
 */
export function buildContextBridge(messages: ChatMessage[]): string {
  const userText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');

  if (userText.includes('大学') && (userText.includes('休') || userText.includes('ゲーム'))) {
    return '先ほど、今日は大学をお休みされてご自宅でゲームをしながらリラックスして過ごされていたとお話ししてくださいましたね。普段の過ごし方がよく分かりました、ありがとうございます！そうした普段の学生生活や日常に関連して、例えばこんな場面を想像してみてほしいのですが……';
  }
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

  for (const dim of allDimensions) {
    const dimFacets = FACET_DEFINITIONS.filter(f => f.factor === dim);
    const evidencedCount = dimFacets.filter(f => (facetScoresFallback[f.key] ?? 0) >= FACET_EVIDENCE_THRESHOLD).length;
    covered[dim] = evidencedCount >= 2;
  }

  const uncovered = allDimensions.filter(d => !covered[d]);
  return { covered, uncovered, lastAssignedDim: null, facetScoresFallback };
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
        text.includes('食事の店選び') ||
        text.includes('候補が2つ') ||
        text.includes('議論が平行線') ||
        text.includes('遠出して')
      ) {
        presented.add('外向性');
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
        text.includes('提出が必要な') ||
        text.includes('手をつかないまま夜遅く') ||
        text.includes('締切') ||
        text.includes('課題')
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
function parseClefPatternCDecision(
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
  const factorEvidencedCounts: Record<FactorNameJP, number> = {
    '開放性': 0,
    '誠実性': 0,
    '外向性': 0,
    '協調性': 0,
    '情緒安定性': 0
  };
  const factorCovered: Record<FactorNameJP, boolean> = {
    '開放性': false,
    '誠実性': false,
    '外向性': false,
    '協調性': false,
    '情緒安定性': false
  };

  let totalEvidencedFacets = 0;

  for (const factor of allFactors) {
    const facets = FACET_DEFINITIONS.filter(f => f.factor === factor);
    const evidenced = facets.filter(f => (facetProbs[f.key] ?? 0) >= FACET_EVIDENCE_THRESHOLD);
    const partial = facets.filter(f => (facetProbs[f.key] ?? 0) >= FACET_PARTIAL_THRESHOLD);
    const meanProb = facets.reduce((sum, f) => sum + (facetProbs[f.key] ?? 0), 0) / facets.length;

    factorEvidencedCounts[factor] = evidenced.length;
    totalEvidencedFacets += evidenced.length;

    // パターンC 因子充足条件:
    // 3ファセット中2ファセット以上が >= 0.70、または 1ファセット以上が >= 0.70 かつ全3ファセットが >= 0.50（平均 >= 0.65）
    factorCovered[factor] =
      evidenced.length >= 2 || (evidenced.length >= 1 && partial.length === 3 && meanProb >= 0.65);
  }

  const uncoveredFactors = allFactors.filter(f => !factorCovered[f]);
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

  // パターンC 完了判定:
  // 1) 最低ターン数（6ターン）以上
  // 2) 全5因子が充足（各2ファセット以上 >= 0.70）かつ10ファセット以上が >= 0.70
  //    または 7ターン以上で全シナリオが出題済み（未提示シナリオなし）
  //    または 8ターン以上で4因子以上充足 ＆ overallReadyProb >= 0.65
  const isAllFactorsSatisfied = uncoveredFactors.length === 0 && totalEvidencedFacets >= 10;
  const isAllScenariosPresentedSatisfied = userCount >= 6 && unpresentedAny.length === 0 && totalEvidencedFacets >= 6;
  const isLongDialogueSatisfied = userCount >= 8 && uncoveredFactors.length <= 1 && (overallReadyProb >= 0.65 || totalEvidencedFacets >= 8);
  const isReady = userCount >= MIN_USER_TURNS && (isAllFactorsSatisfied || isAllScenariosPresentedSatisfied || isLongDialogueSatisfied);

  if (isReady) {
    return {
      focus_dimension: '完了',
      target_question_strategy:
        'すべての質問が完了しました。新たな質問は一切行わず、直前の回答に温かく共感・感謝した上で、画面下のボタンから次の質問紙（BFI-2-S）へ進むよう案内してください。',
      is_ready_for_final_analysis: true,
      action_mode: 'complete',
      evidenced_facets_count: totalEvidencedFacets,
      notes: `Clef-flash Pattern C Complete (evidencedFacets: ${totalEvidencedFacets}/15, turns: ${userCount})`
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
        `【現在のエピソードの自然な深掘り】`,
        `ユーザーが直前に語ってくれたエピソード（場面・出来事）の話題は変えず、まずはその内容をカギカッコなしで自然に1文で受け止めてください。`,
        `その場面の中で、ユーザーが【具体的に何と言ったか／どう動いたか／どう対処したか】という客観的な事実（振る舞い）を1つ尋ねてください。`,
        `（※架空の前提を作ったり、「なぜそう思ったのか」という内省を聞くことは厳禁です。事実を尋ねてください）`,
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

  // もし未提示シナリオが存在しない場合は、無理に新シナリオを出さず完了へ
  if (unpresentedAny.length === 0 && userCount >= 6) {
    return {
      focus_dimension: '完了',
      target_question_strategy:
        'すべてのシナリオについての確認が完了しました。追加の質問は行わず、直前の回答に感謝を伝えた上で、画面下のボタンから次の質問紙へ進むよう案内してください。',
      is_ready_for_final_analysis: true,
      action_mode: 'complete',
      evidenced_facets_count: totalEvidencedFacets,
      notes: `Clef-flash Pattern C [All scenarios presented] (turns: ${userCount})`
    };
  }

  const missingFacetsInFactor = FACET_DEFINITIONS.filter(
    f => f.factor === targetFactor && (facetProbs[f.key] ?? 0) < FACET_EVIDENCE_THRESHOLD
  );
  const targetFacets = (missingFacetsInFactor.length > 0 ? missingFacetsInFactor : contextualMissingFacets).slice(0, 3);
  const targetNames = targetFacets.map(f => `${f.factor}［${f.name}］`).join('・');

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

  // 全体の完了判定
  clefQuestions.is_ready_overall = {
    type: 'noul',
    instructions:
      'これまでの対話全体を通じて、ビッグファイブ全5因子（開放性・誠実性・外向性・協調性・情緒安定性）すべてについて、各因子2ファセット以上の具体的な行動エピソードが十分に集まり、質問紙と同等の精度で採点できる状態に達しましたか？'
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
                rawAccumulatedText += content;

                // 思考タグ (<thought>, <think>, <|channel>thought) のリアルタイム除去
                let cleanChunk = '';
                for (let i = 0; i < content.length; i++) {
                  const char = content[i];
                  if (!isInsideThinking) {
                    if (char === '<') {
                      tagBuffer = '<';
                    } else if (tagBuffer.length > 0) {
                      tagBuffer += char;
                      if (
                        '<think>'.startsWith(tagBuffer) ||
                        '<thought>'.startsWith(tagBuffer) ||
                        '<|channel>thought'.startsWith(tagBuffer)
                      ) {
                        if (
                          tagBuffer === '<think>' ||
                          tagBuffer === '<thought>' ||
                          tagBuffer === '<|channel>thought'
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
                      if (
                        '</think>'.startsWith(tagBuffer) ||
                        '</thought>'.startsWith(tagBuffer) ||
                        '<channel|>'.startsWith(tagBuffer)
                      ) {
                        if (
                          tagBuffer === '</think>' ||
                          tagBuffer === '</thought>' ||
                          tagBuffer === '<channel|>'
                        ) {
                          isInsideThinking = false;
                          tagBuffer = '';
                        }
                      } else if (
                        !tagBuffer.startsWith('</think>') &&
                        !tagBuffer.startsWith('</thought>') &&
                        !tagBuffer.startsWith('<channel|>')
                      ) {
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
          }
        }
      } catch (err: any) {
        console.error('Stream reading error:', err);
        const errEvent = JSON.stringify({ type: 'error', error: err.message || 'Stream error' });
        controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`));
      } finally {
        if (
          !isInsideThinking &&
          tagBuffer.length > 0 &&
          !tagBuffer.startsWith('<think') &&
          !tagBuffer.startsWith('<thought') &&
          !tagBuffer.startsWith('<|channel>thought')
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

        // 完了モード以外で、万一テキストが空、または質問記号（？）が含まれていない場合の自動補完
        if (!isReady && strategy.action_mode !== 'complete') {
          const userAge = typeof userProfile?.age === 'number' ? userProfile.age : (userProfile?.age ? parseInt(String(userProfile.age), 10) : undefined);
          const scenario = getDetailedScenarioForFactor(strategy.focus_dimension, userAge);
          if (!cleanAccumulatedText.trim()) {
            const fallbackReply = `お答えいただきありがとうございます！\n少し場面を変えて、次の具体的なシチュエーションについて伺わせてください。\n\n【状況】\n${scenario.situationText}\n\n${scenario.questionText}`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: fallbackReply })}\n\n`));
          } else if (!cleanAccumulatedText.includes('？') && !cleanAccumulatedText.includes('?')) {
            const followUpQuestion = `\n\nちなみに、もし「${scenario.situationText.slice(0, 45)}...」という状況なら、あなたなら具体的にどう動きますか？`;
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
      if (!reply.trim()) {
        reply = `お答えいただきありがとうございます！\n少し場面を変えて、次の具体的なシチュエーションについて伺わせてください。\n\n【状況】\n${scenario.situationText}\n\n${scenario.questionText}`;
      } else if (!isReady && strategy.action_mode !== 'complete' && !reply.includes('？') && !reply.includes('?')) {
        reply += `\n\nちなみに、もし「${scenario.situationText.slice(0, 45)}...」という状況なら、あなたなら具体的にどう動きますか？`;
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

function scoreToLevelLabel(score: number): string {
  if (score >= 70) return '高い';
  if (score >= 45) return '中庸';
  return '控えめ';
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

function parseClefScoringResponse(rawObj: any, sourceLabel: string): ClefScoringBreakdown | null {
  if (!rawObj) return null;
  const target = rawObj.answers || rawObj.result || rawObj;
  if (!target || typeof target !== 'object') return null;

  // 15ファセットそれぞれの生確率・スコア・確信度を算出
  const positiveProbs: Record<string, number> = {};
  const negativeProbs: Record<string, number> = {};
  const concretenessProbs: Record<string, number> = {};
  const facetScores: Record<string, number> = {};
  const facetConfidences: Record<string, 'high' | 'moderate' | 'insufficient'> = {};

  let hasAnyValidScore = false;

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

    // スコア算出ロジック:
    // 両極（ポジティブ・ネガティブ）の差分 Delta (-1.00 〜 +1.00) を 0 〜 100 に正規化
    let score = 50;
    if (pPos !== null && pNeg !== null) {
      const delta = pPos - pNeg;
      score = Math.min(100, Math.max(0, Math.round(50 + delta * 50)));
    } else if (pPos !== null) {
      score = Math.min(100, Math.max(0, Math.round(pPos * 100)));
    }
    facetScores[cfg.key] = score;

    // 確信度（行動エビデンス充実度）判定:
    // 具体性確率 (pCon) を最優先、未取得時はポジティブ/ネガティブの極端度で判定
    if (pCon !== null) {
      if (pCon >= 0.65) {
        facetConfidences[cfg.key] = 'high';
      } else if (pCon >= 0.40) {
        facetConfidences[cfg.key] = 'moderate';
      } else {
        facetConfidences[cfg.key] = 'insufficient';
      }
    } else {
      if (score >= 70 || score <= 30) {
        facetConfidences[cfg.key] = 'high';
      } else if (score >= 42 && score <= 58) {
        facetConfidences[cfg.key] = 'insufficient';
      } else {
        facetConfidences[cfg.key] = 'moderate';
      }
    }
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

  // 受検態度・妥当性メタチェック（5問）の抽出
  const validityChecks = {
    social_desirability: extractClefNoulProb(target.val_social_desirability) ?? 0.35,
    mock_or_careless: extractClefNoulProb(target.val_mock_or_careless) ?? 0.05,
    concrete_detail: extractClefNoulProb(target.val_concrete_detail) ?? 0.65,
    defensiveness: extractClefNoulProb(target.val_defensiveness) ?? 0.20,
    emotional_expressiveness: extractClefNoulProb(target.val_emotional_expressiveness) ?? 0.70
  };

  const avg3 = (v1: number | undefined, v2: number | undefined, v3: number | undefined, fallback: number): number => {
    const valid = [v1, v2, v3].filter((v): v is number => typeof v === 'number');
    if (valid.length === 0) return fallback;
    return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
  };

  const facetMeanScores = {
    openness: avg3(facetScores.openness_intellectual, facetScores.openness_aesthetic, facetScores.openness_creative, d_o ?? 50),
    conscientiousness: avg3(facetScores.conscientiousness_organization, facetScores.conscientiousness_productiveness, facetScores.conscientiousness_responsibility, d_c ?? 50),
    extraversion: avg3(facetScores.extraversion_sociability, facetScores.extraversion_assertiveness, facetScores.extraversion_activity, d_e ?? 50),
    agreeableness: avg3(facetScores.agreeableness_compassion, facetScores.agreeableness_respect, facetScores.agreeableness_trust, d_a ?? 50),
    neuroticism: avg3(facetScores.neuroticism_anxiety, facetScores.neuroticism_depression, facetScores.neuroticism_volatility, d_n ?? 50)
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
        intellectual: facetScores.openness_intellectual ?? facetMeanScores.openness,
        aesthetic: facetScores.openness_aesthetic ?? facetMeanScores.openness,
        creative: facetScores.openness_creative ?? facetMeanScores.openness
      },
      conscientiousness: {
        organization: facetScores.conscientiousness_organization ?? facetMeanScores.conscientiousness,
        productiveness: facetScores.conscientiousness_productiveness ?? facetMeanScores.conscientiousness,
        responsibility: facetScores.conscientiousness_responsibility ?? facetMeanScores.conscientiousness
      },
      extraversion: {
        sociability: facetScores.extraversion_sociability ?? facetMeanScores.extraversion,
        assertiveness: facetScores.extraversion_assertiveness ?? facetMeanScores.extraversion,
        activity: facetScores.extraversion_activity ?? facetMeanScores.extraversion
      },
      agreeableness: {
        compassion: facetScores.agreeableness_compassion ?? facetMeanScores.agreeableness,
        respect: facetScores.agreeableness_respect ?? facetMeanScores.agreeableness,
        trust: facetScores.agreeableness_trust ?? facetMeanScores.agreeableness
      },
      neuroticism: {
        anxiety: facetScores.neuroticism_anxiety ?? facetMeanScores.neuroticism,
        depression: facetScores.neuroticism_depression ?? facetMeanScores.neuroticism,
        volatility: facetScores.neuroticism_volatility ?? facetMeanScores.neuroticism
      }
    },
    facet_confidences: facetConfidences,
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
  dialogueHistory: string
): Promise<ClefScoringBreakdown | null> {
  const scoringState = `【対話履歴】\n${dialogueHistory}\n\n上記の対話履歴から、行動アンカー評定尺度（BARS / BOS）に基づき、各性格ファセットに対応する「客観的な具体的行動事実・発言」が実際に確認できるかを厳密に判定・評価してください。単なる印象や言葉遣いの丁寧さではなく、実際に語られた振る舞いを根拠としてください。`;

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
      const parsed = parseClefScoringResponse(aiRes, 'clef-flash [55-question multidirectional / env.AI binding]');
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
      const parsed = parseClefScoringResponse(data, 'clef-flash [55-question multidirectional / HTTP Gateway]');
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

          // ファセット単位の確信度集約 (3ファセット中 high の数)
          const facetKeys = Object.keys(clefScores.facets[dim]) as Array<keyof typeof clefScores.facets[typeof dim]>;
          const confidences = facetKeys.map(fk => clefScores.facet_confidences?.[`${dim}_${String(fk)}`] || 'moderate');
          const highCount = confidences.filter(c => c === 'high').length;
          const insufficientCount = confidences.filter(c => c === 'insufficient').length;

          parsedResult.scores[dim].evidenced_facet_count = highCount;
          parsedResult.scores[dim].confidence = highCount >= 2
            ? 'high'
            : (insufficientCount >= 2 ? 'insufficient' : 'moderate');
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
