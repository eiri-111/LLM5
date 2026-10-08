export interface BigFiveDimension {
  score: number;
  level: string;
  title: string;
  description: string;
  traits: string[];
  analysis_reasoning?: string; // 対話からなぜこのスコアと判定されたかの根拠
}

export interface BigFiveScores {
  openness: BigFiveDimension;
  conscientiousness: BigFiveDimension;
  extraversion: BigFiveDimension;
  agreeableness: BigFiveDimension;
  neuroticism: BigFiveDimension;
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
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export type InterviewerModelType = 'dynamic/llm5' | 'dynamic/llm-qwen';

export type GenderType = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserProfile {
  student_id?: string; // 学籍番号（任意・未収集）
  age?: number | string; // 年齢 / 年代
  gender?: GenderType | string; // 性別
}

export type ScaleType = 'tipi-j' | 'namikawa' | 'bfi-2-s';

export type DimensionKey = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

export interface SurveyQuestion {
  id: number;
  text: string;
  dimension: DimensionKey;
  is_reverse: boolean;
  facet?: string;
}

export interface SurveyScaleConfig {
  id: ScaleType;
  name: string;
  shortName: string;
  authorYear: string;
  description: string;
  questionCount: number;
  estimatedMinutes: string;
  likertPoints: number; // 5 or 7
  scaleLabels: { value: number; label: string }[];
  instruction: string;
  questions: SurveyQuestion[];
}

export interface SurveyScoreDetail {
  rawMean: number;        // 尺度の元の平均点 (1〜5 or 1〜7)
  normalizedScore: number;// 0〜100に正規化したスコア
}

export interface SurveyResult {
  scaleType: ScaleType;
  scaleName: string;
  rawAnswers: Record<number, number>; // { [questionId]: answerValue }
  scores: Record<DimensionKey, SurveyScoreDetail>;
  completedAt: string;
}

export interface AssessmentSessionPayload {
  session_id: string;
  user_profile: UserProfile;
  messages: ChatMessage[];
  ai_result?: AnalysisResult;
  survey_result?: SurveyResult;
  qualtrics_id?: string;
}

export interface AdminSessionRecord {
  id: string;
  student_id: string;
  age: number;
  gender: string;
  created_at: string;
  dialogue_turns: number;
  qualtrics_id?: string | null;
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
  survey_completed_at?: string | null;
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
