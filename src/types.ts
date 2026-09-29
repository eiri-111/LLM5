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
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}
