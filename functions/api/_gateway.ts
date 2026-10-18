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

/** 対話ターン数（ユーザー発話回数）の制御基準 */
export const MIN_USER_TURNS = 6; // 最低ターン数（2〜3個のエピソードを深掘りして最低6ターン）
export const MAX_USER_TURNS = 8; // 安全上限ターン数（8ターンに達したら必ず対話を完了して質問紙へ誘導）
/** Clef-flash noul確率で「具体的な行動エビデンスが得られた」と判定する閾値 */
export const FACET_EVIDENCE_THRESHOLD = 0.55;
/** 「話題には触れたが、まだ具体的な発言・行動の深掘りが足りない（深掘りチャンス）」と判定する中間閾値 */
export const FACET_PARTIAL_THRESHOLD = 0.30;

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
    probeHint: '普段の会話でどんな話題（「なぜそうなるのか」等の仕組みや知的なテーマ）に食いつくか、疑問が湧いたときにどう調べるか',
    evidenceInstruction: '【開放性 - 知的好奇心の行動エビデンス】単なる抽象的な自己紹介ではなく、対話の中で「普段どんな話題に食いつくか」「疑問や未知のテーマに対してどう調べたり議論したりしたか」という具体的な行動・会話エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(調べ|仕組み|なぜ|理由|議論|深掘り|知識|勉強|本|ニュース|考察|分析|知的好奇心)/
  },
  {
    key: 'ev_openness_aesthetic',
    factor: '開放性',
    name: '美的好奇心',
    probeHint: '自由な時間や休日にどんなコンテンツ（音楽・映画・美術・デザイン・景色・雰囲気の良い場所など）を選び、どう楽しむか',
    evidenceInstruction: '【開放性 - 美的好奇心の行動エビデンス】対話の中で、音楽・映画・芸術・デザイン・風景・作品のこだわりなど、美的・文化的な体験にどう触れているか（または全く関心がないか）が分かる具体的な選択・行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(音楽|映画|美術|芸術|デザイン|景色|雰囲気|カフェ|建築|作品|イラスト|写真|ライブ|センス)/
  },
  {
    key: 'ev_openness_creative',
    factor: '開放性',
    name: '創造力',
    probeHint: 'いつものやり方に飽きたときや課題に直面したとき、新しい方法・独自の工夫・変わった選択肢をどう試したか',
    evidenceInstruction: '【開放性 - 創造力の行動エビデンス】対話の中で、新しいやり方を試した、独自の工夫やアイデアを出した（あるいは定番・ルーティンをあえて守った）という具体的な行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(工夫|新しい|アイデア|試|自作|アレンジ|独自|発想|挑戦|ルーティン|定番)/
  },

  // 2. 誠実性 (Conscientiousness)
  {
    key: 'ev_conscientiousness_organization',
    factor: '誠実性',
    name: '組織化（段取り・整理）',
    probeHint: '出かける前や作業前にどこまで事前に計画・段取りを組むか、あるいは予定変更時にどう再手配したか',
    evidenceInstruction: '【誠実性 - 組織化の行動エビデンス】対話の中で、事前の計画・スケジュール管理・段取り・整理整頓（あるいはノープラン・行き当たりばったりで動く様子）が分かる具体的な行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(計画|段取り|準備|スケジュール|予約|整理|リスト|片付け|ノープラン|行き当たりばったり|ルート)/
  },
  {
    key: 'ev_conscientiousness_productiveness',
    factor: '誠実性',
    name: '生産性（やり抜く力）',
    probeHint: 'やらなければいけないけれど面倒な作業や課題があるとき、すぐ着手してやり通したか、後回しにしたか',
    evidenceInstruction: '【誠実性 - 生産性の行動エビデンス】対話の中で、面倒な作業や地道なタスクに対して「どう着手し、最後までどうやり抜いたか（あるいは先延ばし・休憩を優先したか）」が分かる具体的な行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(面倒|コツコツ|やり切|やり抜|最後|終わらせ|後回し|先延ばし|集中|継続|作業|課題)/
  },
  {
    key: 'ev_conscientiousness_responsibility',
    factor: '誠実性',
    name: '責任感',
    probeHint: '自分の役割や約束・時間を守るために具体的にどう動いたか、周囲から頼まれた時にどう対応したか',
    evidenceInstruction: '【誠実性 - 責任感の行動エビデンス】対話の中で、約束や締切の遵守、自分の役割を最後まで果たす行動、周囲からの頼まれごとへの対応ぶりが分かる具体的な行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(役割|責任|約束|時間|遅刻|締切|期限|守る|任され|担当|きっちり)/
  },

  // 3. 外向性 (Extraversion)
  {
    key: 'ev_extraversion_sociability',
    factor: '外向性',
    name: '社交性',
    probeHint: '人が集まる場や会話の中で、自分からどう話しかけたか、または聞き役に回ったか',
    evidenceInstruction: '【外向性 - 社交性の行動エビデンス】対話の中で、他者との会話や集まりの場面で「自分から話しかけたか、会話を広げたか、それとも静かに聞き役に回ったか」という具体的な振る舞い・発言エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(話しかけ|会話|盛り上|雑談|聞き役|しゃべ|初対面|友達|仲間|声かけ|明るく)/
  },
  {
    key: 'ev_extraversion_assertiveness',
    factor: '外向性',
    name: '主張性（主導権）',
    probeHint: '複数人で何かを決めるときや場が停滞したとき、自分から「こうしよう」と提案・リードしたか、周囲の決定に従ったか',
    evidenceInstruction: '【外向性 - 主張性の行動エビデンス】対話の中で、集団や対人場面で「自分から意見を出して主導（リード）したか、それとも他人の提案に任せたか」が分かる具体的な発言・行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(提案|リード|主導|意見|まとめ|引っ張|仕切|決め|従う|合わせる)/
  },
  {
    key: 'ev_extraversion_activity',
    factor: '外向性',
    name: '活動性',
    probeHint: '休日や日常の中でどれくらい予定を入れて外へ動き回るか、あるいは家でゆっくり過ごすか、行動のテンポやフットワークの軽さ',
    evidenceInstruction: '【外向性 - 活動性の行動エビデンス】対話の中で、日々の行動量、休日のフットワークの軽さ、エネルギッシュに動き回るかゆっくり過ごすかが分かる具体的な行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(休日|出かけ|動き回|アクティブ|フットワーク|インドア|家でのんびり|予定を入れ|活発|外に出)/
  },

  // 4. 協調性 (Agreeableness)
  {
    key: 'ev_agreeableness_compassion',
    factor: '協調性',
    name: '思いやり',
    probeHint: '周囲で困っている人や疲れている人がいたとき、どんな声をかけたか・どんな手助けをしたか',
    evidenceInstruction: '【協調性 - 思いやりの行動エビデンス】対話の中で、周囲の人への気遣い、声かけ、手助け、フォロー（あるいは自分のペースを優先した様子）が分かる具体的な行動・発言エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(気遣|フォロー|助け|手伝|声.*かけ|心配|優し|サポート|気づか|寄り添)/
  },
  {
    key: 'ev_agreeableness_respect',
    factor: '協調性',
    name: '敬意（対立回避）',
    probeHint: '周囲と意見や考えが少し違ったとき（または相手の話を聞くとき）、角が立たないようにどう伝えたか・どう折り合いをつけたか（あるいは率直に意見を言ったか）',
    evidenceInstruction: '【協調性 - 敬意の行動エビデンス】対話の中で、意見の相違や他人のミスに直面した際、「角を立てずに穏やかに伝えたか、譲歩したか、それともストレートに反論・指摘したか」という具体的な言葉遣い・態度のエピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(意見.*違|対立|譲|穏やか|角が立た|怒ら|指摘|反論|言い方|空気を読|丁寧)/
  },
  {
    key: 'ev_agreeableness_trust',
    factor: '協調性',
    name: '信頼',
    probeHint: '他人に作業や役割を任せるとき、相手を信じて任せたか、それとも自分で確認しないと気が済まなかったか',
    evidenceInstruction: '【協調性 - 信頼の行動エビデンス】対話の中で、他者の言動や役割分担に対して「相手を信頼して任せたか、好意的に受け止めたか、あるいは疑って自分で確認したか」が分かる具体的な行動エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(任せ|信頼|信じ|頼る|疑|自分でや|確認しな|お願いし)/
  },

  // 5. 情緒安定性 (Emotional Stability)
  {
    key: 'ev_neuroticism_anxiety',
    factor: '情緒安定性',
    name: '不安の低さ（ストレス対処）',
    probeHint: 'プレッシャーがかかる場面や結果が分からない状況で、どんな態度・行動をとっていたか',
    evidenceInstruction: '【情緒安定性 - 不安の低さの行動エビデンス】対話の中で、プレッシャーや不確実な状況に対して「落ち着いて構えていたか、それとも心配や焦りが行動・言葉に出ていたか」が分かる具体的なエピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(不安|焦|心配|緊張|プレッシャー|落ち着|リラックス|ドキドキ|気にし)/
  },
  {
    key: 'ev_neuroticism_depression',
    factor: '情緒安定性',
    name: '抑うつの低さ（気分の切り替え）',
    probeHint: '失敗したあとや嫌な出来事があった直後〜翌日にかけて、どれくらい引きずったか、どうやって気分を切り替えたか（口数・態度・行動）',
    evidenceInstruction: '【情緒安定性 - 抑うつの低さの行動エビデンス】対話の中で、失敗や嫌な出来事があった後の「気分の切り替え行動・翌日の様子・どれくらい引きずったか」が分かる具体的な事後エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(落ち込|引きず|切り替え|立ち直|寝れば|翌日|気分|ショック|凹|へこ|元気)/
  },
  {
    key: 'ev_neuroticism_volatility',
    factor: '情緒安定性',
    name: '感情変動の低さ（トラブル時の冷静さ）',
    probeHint: '想定外のことが起きたり思い通りに進まない場面で、イライラや焦りが態度・口調に出たか、それとも動じず冷静に対処したか',
    evidenceInstruction: '【情緒安定性 - 感情変動の低さの行動エビデンス】対話の中で、予定外のトラブルやハプニングが起きた瞬間に「イライラやパニックを態度・口調に出したか、それとも動じず冷静に対処したか」が分かる具体的な行動・発言エピソードがすでに語られましたか？（未言及や曖昧な場合は必ずno）',
    regexFallback: /(イライラ|パニック|冷静|動じ|トラブル|ハプニング|怒|感情的|落ち着いて対)/
  }
];

interface GoldenSituation {
  id: string;
  title: string;
  targetFactors: FactorNameJP[];
  primaryFacets: string[];
  bridgeGuide: string;
  promptInstruction: string;
  detectionRegex: RegExp;
}

/**
 * 1つのエピソードから複数の因子・ファセットを同時に引き出す「4つの黄金シチュエーション」
 * 話題転換時（new_situation）に唐突感が出ないよう、直前の話題から繋ぐ bridgeGuide を併設
 */
const GOLDEN_SITUATIONS: GoldenSituation[] = [
  {
    id: 'situation_trouble',
    title: '予定通りにいかない場面・急な予定変更への対応',
    targetFactors: ['情緒安定性', '誠実性', '外向性'],
    primaryFacets: [
      'ev_neuroticism_volatility',
      'ev_neuroticism_anxiety',
      'ev_conscientiousness_organization',
      'ev_extraversion_assertiveness'
    ],
    bridgeGuide:
      '直前のエピソードでのユーザーの落ち着いた取り組みや行動スタイルを受け止めた上で、「ところで、普段そうして過ごす中で、たまに『予定通りにいかないこと』や『急な予定変更・ちょっとしたハプニング』が起きることもあると思いますが〜」と日常の延長として自然に繋げてください。',
    promptInstruction:
      '【シチュエーション提示：予定通りにいかない場面・急な変更】最近、日常や学校・仕事・出先などで「予定通りにいかなくなった場面（電車の遅れ、急な予定変更、手順や機材のトラブルなど）」があれば1つ挙げてもらい、その時にどんな態度でどう動いたか（周りになんと言ったか、どう段取りし直したか）を尋ねてください。（※もし最近大きなトラブルがなければ、ちょっとした予定変更の場面でどう動くかでも構わないと添えてください）',
    detectionRegex: /(予定外のトラブル|予定通りにいかない|ハプニング|急な予定変更|道に迷)/
  },
  {
    id: 'situation_group_decision',
    title: '複数人での意思決定・役割分担・協力の場面',
    targetFactors: ['外向性', '協調性'],
    primaryFacets: [
      'ev_extraversion_sociability',
      'ev_extraversion_assertiveness',
      'ev_agreeableness_compassion',
      'ev_agreeableness_respect',
      'ev_agreeableness_trust'
    ],
    bridgeGuide:
      '直前の話に共感した上で、「ちなみに、友人や家族、活動の仲間など『誰かと一緒に何かを決めたり進めたりする場面』についても少し伺いたいのですが〜」と対人場面へ自然にスライドさせてください。',
    promptInstruction:
      '【シチュエーション提示：複数人での意思決定・協力】最近、友人や家族、学校・仕事の仲間など複数人で「どこに行くか・どう進めるかを決めた場面」や「役割分担をして協力した場面」を1つ挙げてもらい、自分から提案して引っ張ったか、周りの意見を聞いてまとめる役に回ったかなど、実際の立ち回りを尋ねてください。',
    detectionRegex: /(複数人で|意見が分かれ|意見や希望|どう進めるかを決め|立ち回り)/
  },
  {
    id: 'situation_free_time_curiosity',
    title: '自由時間の選択・興味の深掘り・新しい体験の場面',
    targetFactors: ['開放性', '外向性'],
    primaryFacets: [
      'ev_openness_intellectual',
      'ev_openness_aesthetic',
      'ev_openness_creative',
      'ev_extraversion_activity'
    ],
    bridgeGuide:
      '直前までの話（学校・仕事・課題などのオンの場面）と自然に対比させて、「ちなみに、そういった普段の活動や課題から離れて、休日にぽっかり自由な時間ができた時（オフの時間）についても伺いたいのですが〜」とクッションを入れて切り出してください。',
    promptInstruction:
      '【シチュエーション提示：自由時間の過ごし方・好奇心とこだわり】最近、休日に自由な時間ができた時に実際にどう過ごしたか（外に出かけて動き回ったか、家でどんな音楽・映画・作品・デザイン等を楽しんだか、あるいは気になって徹底的に調べたことや新しく試したことはあるか）、具体的なエピソードを尋ねてください。',
    detectionRegex: /(自由な時間|ぽっかり|盛り上がった話題|食いついて|作品・音楽)/
  },
  {
    id: 'situation_task_and_recovery',
    title: '面倒な課題への着手・疲れた日や失敗後の切り替え場面',
    targetFactors: ['誠実性', '情緒安定性'],
    primaryFacets: [
      'ev_conscientiousness_productiveness',
      'ev_conscientiousness_responsibility',
      'ev_neuroticism_depression',
      'ev_neuroticism_anxiety'
    ],
    bridgeGuide:
      '直前の話を受け止めた上で、「ところで、普段の生活の中で『やらなきゃいけないけれど少し面倒な課題・作業』に向き合う時や、『ちょっとうまくいかず疲れた日』の切り替えについても伺いたいのですが〜」と自然に繋げてください。',
    promptInstruction:
      '【シチュエーション提示：面倒な課題への取り組みと気分の切り替え】最近、「やらなければいけないけれど少し面倒だった作業・課題」にどう着手して進めたか（先に片付けたか、ギリギリまで寝かせたか等）、また、ちょっとした失敗や嫌なことがあった後にどうやって気分を切り替えたか、具体的なエピソードを尋ねてください。',
    detectionRegex: /(面倒だった作業|その後の過ごし方|翌日の様子|どう切り替えた)/
  }
];

/**
 * 直近で同じエピソードの深掘り（フォローアップ質問）が何ターン連続しているかを推定
 */
function countConsecutiveDeepenTurns(messages: ChatMessage[]): number {
  let deepenCount = 0;
  // 最後のアシスタントメッセージから逆順に見て、新しいシチュエーション提示でなければ深掘りとみなす
  const assistantMsgs = messages.slice(1).filter(m => m.role === 'assistant');
  for (let i = assistantMsgs.length - 1; i >= 0; i--) {
    const text = assistantMsgs[i].content;
    const isNewSituationPrompt =
      /(別の場面|ここからは少し場面を変え|最近.*場面はありますか|どんな場面がありましたか|思い出してみてください|から離れて|についても伺いたいのですが)/.test(text) ||
      GOLDEN_SITUATIONS.some(s => s.detectionRegex.test(text));
    if (isNewSituationPrompt) {
      break;
    }
    deepenCount++;
  }
  return deepenCount;
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
 * Clef-flashの15ファセット同時評価レスポンス（パターンC）を解析し、
 * 「同じエピソードの2〜3往復深掘り」または「未充足ファセットを狙う新シチュエーション提示」を決定する
 */
function parseClefPatternCDecision(
  resObj: any,
  messages: ChatMessage[],
  userCount: number
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
    // 3ファセット中2ファセット以上が >= 0.55、または 1ファセット以上が >= 0.55 かつ全3ファセットが >= 0.30（平均 >= 0.45）
    factorCovered[factor] =
      evidenced.length >= 2 || (evidenced.length >= 1 && partial.length === 3 && meanProb >= 0.45);
  }

  const uncoveredFactors = allFactors.filter(f => !factorCovered[f]);
  const overallReadyProb = extractProb(target.is_ready_overall) ?? 0;

  const episodeDepthChoice =
    target.episode_depth_status?.chosen ||
    target.episode_depth_status?.answer ||
    target.episode_depth_status?.choice ||
    (typeof target.episode_depth_status === 'string' ? target.episode_depth_status : null);

  const consecutiveDeepen = countConsecutiveDeepenTurns(messages);
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
  const assistantAlreadyEnded = /(インタビューは.*終了|対話セッションは.*完了|次のステップ.*質問紙)/.test(lastAssistantMsg);
  const userSaidNoEpisode = /(特にない|思いつかない|あまりない|覚えていない|わからない|ないです)/.test(lastUserMsg);

  // パターンC 完了判定:
  // 1) 安全上限ターン数（8ターン）に達した場合は無条件で完了
  // 2) 直前のアシスタントが既に終了宣言を行っていた場合は即完了
  // 3) 最低ターン数（6ターン）以上 かつ（4因子以上充足 または 8ファセット以上 >= 0.55 または overallReadyProb >= 0.55）
  const isEnoughEvidenceAtMinTurns =
    uncoveredFactors.length <= 1 || totalEvidencedFacets >= 8 || overallReadyProb >= 0.55;
  const isReady =
    userCount >= MAX_USER_TURNS ||
    assistantAlreadyEnded ||
    (userCount >= MIN_USER_TURNS && isEnoughEvidenceAtMinTurns);

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

  // 「断片的ヒント（0.30 <= prob < 0.55）」が出ているファセット（あと1問深掘りすれば0.55を超える有望ファセット）
  const partialFacets = FACET_DEFINITIONS.filter(
    f => (facetProbs[f.key] ?? 0) >= FACET_PARTIAL_THRESHOLD && (facetProbs[f.key] ?? 0) < FACET_EVIDENCE_THRESHOLD
  ).sort((a, b) => (facetProbs[b.key] ?? 0) - (facetProbs[a.key] ?? 0));

  // 【深掘り用】まだ0.55に達していないファセットのうち、「今のエピソードの文脈に最も関連している順（確率が高い順 b - a）」にソート
  const contextualMissingFacets = FACET_DEFINITIONS.filter(
    f => (facetProbs[f.key] ?? 0) < FACET_EVIDENCE_THRESHOLD
  ).sort((a, b) => {
    const scoreA = (facetProbs[a.key] ?? 0) + (uncoveredFactors.includes(a.factor) ? 0.10 : 0);
    const scoreB = (facetProbs[b.key] ?? 0) + (uncoveredFactors.includes(b.factor) ? 0.10 : 0);
    return scoreB - scoreA;
  });

  // 深掘りモード vs 新シチュエーション提示モードの決定
  const hasInitialEpisodeContent = userCount > 1 || lastUserMsg.trim().length >= 10;
  const shouldDeepen =
    userCount >= 1 &&
    hasInitialEpisodeContent &&
    !userSaidNoEpisode &&
    consecutiveDeepen < 2 &&
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
        `ユーザーが直前に語ってくれたエピソード（場面）の話題は変えず、まずはその内容をカギカッコなしで自然に受け止めてください。`,
        `もしユーザーが「〜と思った」と心の中の感想だけを答えた場合は、「そう思ったとき、実際には相手にそれを口に出して伝えましたか？それとも態度には出さず周りに合わせましたか？」のように、必ず【実際の行動・発言】へ変換して尋ねてください。`,
        `その場面に関連する以下の観点（${targetNames}）から、今の文脈に最も自然に繋がるものを1〜2個選び、ユーザーが実際にどう動いたか・周囲とどうやり取りしたかを尋ねてください：`,
        targetHints
      ].join('\n'),
      notes: `Clef-flash Pattern C [deepen_episode] (evidenced: ${totalEvidencedFacets}/15, targets: ${targetNames})`
    };
  }

  // 新しいシチュエーション（黄金シチュエーション）を提示するモード
  // 既にアシスタントが提示済みのシチュエーションを除外し、「まだ確率が低い（全く触れられていない）未充足因子・ファセット」を最も多くカバーできるシチュエーションを選択
  const assistantHistoryText = messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content)
    .join('\n');

  const scoredSituations = GOLDEN_SITUATIONS.map(sit => {
    const alreadyAsked = sit.detectionRegex.test(assistantHistoryText);
    const missingFacetsInSit = sit.primaryFacets.filter(
      key => (facetProbs[key] ?? 0) < FACET_EVIDENCE_THRESHOLD
    );
    // 確率が低い（まだ全然話に出ていない）ファセットほど高スコアを付与して優先的に穴埋めする
    const unexploredWeight = missingFacetsInSit.reduce(
      (sum, key) => sum + (1.0 - (facetProbs[key] ?? 0)),
      0
    );
    const uncoveredFactorHits = sit.targetFactors.filter(f => uncoveredFactors.includes(f)).length;
    const score = (alreadyAsked ? -15 : 0) + uncoveredFactorHits * 3 + unexploredWeight * 2;
    return { sit, score };
  }).sort((a, b) => b.score - a.score);

  const chosenSituation = scoredSituations[0].sit;
  // そのシチュエーション内でまだ確率が低いファセットから優先して最大3つをターゲットにする
  const sitTargetFacets = FACET_DEFINITIONS.filter(
    f => chosenSituation.primaryFacets.includes(f.key) && (facetProbs[f.key] ?? 0) < FACET_EVIDENCE_THRESHOLD
  )
    .sort((a, b) => (facetProbs[a.key] ?? 0) - (facetProbs[b.key] ?? 0))
    .slice(0, 3);

  const focusFactor = chosenSituation.targetFactors.find(f => uncoveredFactors.includes(f))
    || chosenSituation.targetFactors[0];
  const facetSummary = sitTargetFacets.length > 0
    ? sitTargetFacets.map(f => `${f.factor}［${f.name}］`).join('・')
    : chosenSituation.targetFactors.join('・');

  const bridgeInstruction = userCount === 1
    ? `ユーザーが挙げてくれた「素や性格が出る場所・場面」を受け止め、そこに関連づけながら、`
    : `【急な話題転換を防ぐ橋渡し（重要）】\n${chosenSituation.bridgeGuide}\nその流れで、`;

  return {
    focus_dimension: focusFactor,
    action_mode: 'new_situation',
    target_facets: sitTargetFacets.map(f => f.name),
    evidenced_facets_count: totalEvidencedFacets,
    is_ready_for_final_analysis: false,
    target_question_strategy: [
      `【新しいシチュエーションのお題提示（狙い: ${facetSummary}）】`,
      `${bridgeInstruction}以下のシチュエーションでの具体的なエピソードを尋ねてください：`,
      chosenSituation.promptInstruction
    ].join('\n'),
    notes: `Clef-flash Pattern C [new_situation:${chosenSituation.id}] (evidenced: ${totalEvidencedFacets}/15, target: ${facetSummary})`
  };
}

/**
 * ステップ1: 分析官AI (Workers AI @cf/cloudflare/clef-flash を呼び出し)
 * パターンC: 1回のリクエストで「BFI-2-S 15ファセットすべての行動エビデンス充足度（閾値0.70）」と
 * 「今のエピソードを深掘りすべきか／新しい場面に切り替えるべきか」を同時に評価する
 */
export async function runAnalyst(env: Env, messages: ChatMessage[]): Promise<AnalystStrategy> {
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
      const parsed = parseClefPatternCDecision(aiRes, messages, userCount);
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
      const parsed = parseClefPatternCDecision(data, messages, userCount);
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

  // 3. 万一の通信障害時のルールベース・フォールバック（正規表現による15ファセット簡易判定から同じロジックを実行）
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

  const fallbackParsed = parseClefPatternCDecision({ answers: mockAnswers }, messages, userCount);
  if (fallbackParsed) {
    fallbackParsed.notes = `${fallbackParsed.notes} [Rule-based fallback]`;
    return fallbackParsed;
  }

  return {
    focus_dimension: '外向性',
    action_mode: 'new_situation',
    target_question_strategy: GOLDEN_SITUATIONS[userCount % GOLDEN_SITUATIONS.length].promptInstruction,
    is_ready_for_final_analysis: false,
    notes: 'Minimal fallback strategy'
  };
}

/**
 * インタビュアーAI用のシステムプロンプトを生成
 * パターンC: 「同一エピソードの2〜3往復深掘り（カメラに映る行動・発言の引き出し）」と
 * 「複数因子が活性化する新シチュエーション提示」を明確に制御する
 */
function buildInterviewerInstruction(strategy: AnalystStrategy): string {
  const isReady = strategy.is_ready_for_final_analysis;
  const focusDimension = strategy.focus_dimension || '行動特性';
  const targetStrategy = strategy.target_question_strategy || '具体的な行動エピソードについて尋ねる';
  const actionMode = strategy.action_mode || 'new_situation';

  if (isReady || actionMode === 'complete') {
    return `
あなたはプロフェッショナルな行動エピソード・インタビュアーです。
これまでの対話で、ビッグファイブ全5因子（および主要ファセット）のエピソード収集がすべて完了しました。

【あなたのタスク（対話完了の締めくくり）】
1. ユーザーの直前の発言に対して、温かく具体的に共感・要約（1〜2文）してください。
2. 【重要・追加質問の絶対禁止】: これ以上、新しい質問や問いかけ（「〜ですか？」「〜ありましたか？」など）は絶対にしないでください。疑問符（？）も使わないでください。
3. 最後に、「ここまで具体的なエピソードをたくさん聞かせていただき、ありがとうございました！対話セッションはこれで完了です。画面下のボタンから、次のステップ『質問紙（BFI-2-S）』へお進みください。」と案内して締めくくってください。
4. 思考プロセスや内部推論（<thought>や<think>タグなど）は一切出力に含めず、ユーザーへの発話文のみを直接出力してください。
`;
  }

  const modeSpecificGuide =
    actionMode === 'deepen_episode'
      ? `
【現在のモード：今のエピソードの自然な深掘り（フォローアップ）】
- 最初に、直前のユーザーの回答内容をカギカッコなしで自然に1文で受け止めてください（「その気持ち、理解できます」のような抽象的なテンプレ共感はせず、相手が話した事実や状況に沿って受け止めてください）。
- 話題や場面は切り替えず、直前にユーザーが話してくれたエピソードの「続き・その場での立ち回り」を尋ねてください。
- もしユーザーが「〜と思った」と心の中の感想や疑問だけを答えた場合は、「どんな考えが浮かびましたか？」と再び頭の中の話を聞くのは厳禁です。必ず「そう思ったとき、実際には相手にそれを口に出して伝えましたか？それとも態度には出さず周りに合わせましたか？」のように【実際の行動・発言】へ変換して尋ねてください。
`
      : `
【現在のモード：新しいシチュエーションのお題提示（話題の橋渡し）】
- まず直前のユーザーの回答に対して、カギカッコなしで1〜2文で具体的に受け止めを述べてください。
- 【重要】急に話題が飛んだ印象を与えないよう、直前の話題（オンの活動や対人場面など）を枕詞にして、自然な橋渡し（クッション文）を挟んでから次のシチュエーションを切り出してください。
- もしユーザーが「そういう場面自体がめったにない」と答えた場合は、なぜそういう場面が起きないのか（事前に全部決めておくから、最初から相手に合わせるから等）や普段の小さな場面ではどう動くかを答えやすく案内してください。
`;

  return `
あなたは心理学に基づく行動エピソード・インタビュアーです。
ユーザーが実際に経験した「場面（エピソード）」と「その中での具体的な振る舞い（発言・行動・選択・事後の様子）」を引き出すことがあなたの役割です。

裏方の分析官AI（Clef-flash）から以下の戦略指示が届いています:
【分析官の指示】:
- 主な注目領域: ${focusDimension}${strategy.target_facets?.length ? `（注目ファセット: ${strategy.target_facets.join(' / ')}）` : ''}
${targetStrategy}
${modeSpecificGuide}
【対話・質問の絶対ルール】
1. 必ず丁寧で親しみやすい敬語を使用してください。
2. 1回の発言で聞く質問は「1つ（または密接に関連する具体的な問いかけ）」に絞り、自然な会話文（3〜4文程度）にしてください。
3. **不自然なカギカッコ出力の禁止**: 1文目の相槌や質問文をカギカッコ（「 」）で括って出力しないでください。普通の人間同士の自然な会話文としてそのまま出力してください。
4. **勝手な終了宣言の禁止**: まだ対話セッションは継続中です。「今回のインタビューはこれで終了となります」「ありがとうございました」などと勝手に終了宣言をしないでください。必ず最後にユーザーへの質問（？で終わる文）を1つ投げかけて終えてください。
5. 「あなたの誠実性を測るために〜」のような検査の裏側の意図や専門用語（ビッグファイブ、ファセット等）は絶対に出さないでください。
6. 思考プロセスや内部推論（<thought>や<think>タグなど）は一切出力に含めず、ユーザーへの発話文のみを直接出力してください。
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
      stream: true,
      chat_template_kwargs: {
        enable_thinking: false
      }
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
        if (
          !isInsideThinking &&
          tagBuffer.length > 0 &&
          !tagBuffer.startsWith('<think') &&
          !tagBuffer.startsWith('<thought') &&
          !tagBuffer.startsWith('<|channel>thought')
        ) {
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
        temperature: 0.7,
        chat_template_kwargs: {
          enable_thinking: false
        }
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
