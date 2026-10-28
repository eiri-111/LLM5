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
  analysis_reasoning?: string; // 対話からなぜこのスコアと判定されたかの根拠
  confidence?: 'high' | 'moderate' | 'insufficient' | 'unobserved'; // 行動エビデンスの充足度・測定確信度
  evidenced_facet_count?: number; // 3ファセット中エビデンスが得られた数 (0〜3)
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

export interface BigFiveScores {
  openness: BigFiveDimension;
  conscientiousness: BigFiveDimension;
  extraversion: BigFiveDimension;
  agreeableness: BigFiveDimension;
  neuroticism: BigFiveDimension;
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
  scores: BigFiveScores;
  strengths: string[];
  growth_areas: string[];
  career_recommendations: string[];
  relationship_style: string;
  stress_management: string;
  llm_analysis_rationale?: string; // 対話全体の心理プロファイリング根拠・LLMの分析インサイト
  dialogue_evidence?: string[]; // 対話から抽出された行動パターン・発言エピソード
  demographics?: {
    age?: number | string | null;
    gender?: string | null;
  };
  clef_scoring_data?: ClefScoringBreakdown; // Clef-flashによる20問同時採点データ（案1・案2比較検証用）
  dual_assessment?: DualAssessmentScores; // STAR行動実績とSJT状況判断の完全二元化スコア
  verbosity_stats?: {
    total_user_characters: number;
    total_user_turns: number;
    avg_characters_per_turn: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export type GenderType = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserProfile {
  student_id?: string; // 学籍番号（任意・未収集）
  age?: number | string; // 年齢 / 年代
  gender?: GenderType | string; // 性別
}

export type ScaleType = 'bfi-2-s' | string;

export type DimensionKey = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

export interface SurveyFacetScores {
  openness: { intellectual: number; aesthetic: number; creative: number };
  conscientiousness: { organization: number; productiveness: number; responsibility: number };
  extraversion: { sociability: number; assertiveness: number; activity: number };
  agreeableness: { compassion: number; respect: number; trust: number };
  neuroticism: { anxiety: number; depression: number; volatility: number };
}

export interface SurveyScoreDetail {
  rawMean: number;        // 尺度の元の平均点 (1〜5)
  normalizedScore: number;// 0〜100に正規化したスコア
}

export interface SelfMonitoringScoreDetail extends SurveyScoreDetail {
  subscores?: {
    ability: number;     // 自己呈示変容能力 (0〜100)
    sensitivity: number; // 他者表出感受性 (0〜100)
  };
}

export interface SurveyResult {
  scaleType: ScaleType;
  scaleName: string;
  rawAnswers?: Record<string | number, number>; // { [questionId]: answerValue }
  scores: Record<DimensionKey, SurveyScoreDetail>;
  facetScores?: SurveyFacetScores;
  selfMonitoring?: SelfMonitoringScoreDetail;
  socialDesirability?: SurveyScoreDetail;
  completedAt: string;
}

export interface AssessmentSessionPayload {
  session_id: string;
  user_profile: UserProfile;
  messages: ChatMessage[];
  ai_result?: AnalysisResult;
  survey_result?: SurveyResult;
}

export interface AdminSessionRecord {
  id: string;
  student_id: string;
  age: number;
  gender: string;
  created_at: string;
  dialogue_turns: number;
  ai_personality_title?: string | null;
  ai_personality_type?: string | null;
  ai_summary?: string | null;
  ai_openness?: number | null;
  ai_conscientiousness?: number | null;
  ai_extraversion?: number | null;
  ai_agreeableness?: number | null;
  ai_neuroticism?: number | null;
  survey_scale_type?: string | null;
  survey_scale_name?: string | null;
  survey_openness?: number | null;
  survey_conscientiousness?: number | null;
  survey_extraversion?: number | null;
  survey_agreeableness?: number | null;
  survey_neuroticism?: number | null;
  survey_self_monitoring?: number | null;
  survey_social_desirability?: number | null;
  survey_completed_at?: string | null;
  r2_saved?: boolean | number;
  r2_key?: string | null;
  data_source?: 'r2' | 'd1';
  chat_messages?: string | null;
  ai_full_result?: string | null;
  survey_raw_answers?: string | null;
  messages_count?: number;
  has_ai_result?: boolean;
  has_survey_completed?: boolean;
  parsed_ai_result?: AnalysisResult | null;
  parsed_messages?: ChatMessage[];
  parsed_survey_answers?: Record<string | number, number> | null;
}
