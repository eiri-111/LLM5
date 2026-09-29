export interface BigFiveDimension {
  score: number;
  level: string;
  title: string;
  description: string;
  traits: string[];
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
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface Question {
  id: number;
  text: string;
  dimension: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
  dimension_name: string;
  is_reverse: boolean;
}

export type AnalysisMode = 'chat' | 'questionnaire' | 'text';
