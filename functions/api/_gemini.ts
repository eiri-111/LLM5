export interface Env {
  CF_AI_GATEWAY_URL?: string;
  CF_AIG_TOKEN?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
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
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Cloudflare AI GatewayのRoute/UnifiedエンドポイントへのリクエストURLとヘッダーを生成
 * (Gemini APIキーはAI Gateway側のRoute設定で自動注入されるため、アプリ側では保持不要)
 */
export function getAIGatewayRequest(env: Env, model: string = DEFAULT_MODEL): { url: string; headers: Record<string, string> } {
  let baseUrl = env.CF_AI_GATEWAY_URL?.trim();
  if (!baseUrl) {
    throw new Error('Cloudflare AI Gateway URLが設定されていません。Pagesの環境変数 CF_AI_GATEWAY_URL を設定してください。(例: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/google-ai-studio)');
  }

  baseUrl = baseUrl.replace(/\/+$/, '');

  // プロバイダーパスが含まれていない場合は google-ai-studio を付加
  if (!baseUrl.includes('/google-ai-studio')) {
    baseUrl = `${baseUrl}/google-ai-studio`;
  }

  const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // AI Gateway Token があれば付与
  if (env.CF_AIG_TOKEN && env.CF_AIG_TOKEN.trim() !== '') {
    const token = env.CF_AIG_TOKEN.trim();
    headers['cf-aig-authorization'] = `Bearer ${token}`;
    headers['Authorization'] = `Bearer ${token}`;
  }

  return { url, headers };
}

export const INTERVIEWER_SYSTEM_INSTRUCTION = `
あなたは心理学の専門知識を持つプロフェッショナルな性格分析カウンセラー「Dr. OCEAN」です。
ユーザーと自然で心地よい対話を行いながら、ビッグファイブ理論（主要5因子）に基づいてパーソナリティを深く理解することがあなたの使命です。

【ビッグファイブの5因子】
1. 開放性 (Openness): 知的好奇心、新しい体験への興味、創造性、美意識
2. 誠実性 (Conscientiousness): 計画性、自制心、責任感、物事の丁寧さ
3. 外向性 (Extraversion): 社交性、エネルギー、刺激の追求、ポジティブ感情
4. 協調性 (Agreeableness): 共感性、他者への信頼、利他性、配慮
5. 情緒不安定性 (Neuroticism): ストレスへの敏感さ、不安や緊張の感じやすさ、感情の起伏

【対話のルール】
- 丁寧で温かみがあり、知性的かつ親しみやすい日本語で対話してください。
- スマホ画面で読みやすいよう、1回の返答は2〜3文（150文字程度以内）に簡潔にまとめてください。
- ユーザーの回答に対して、まずは「受容・共感・肯定」を一言伝えてください。
- 一度に複数の質問をせず、必ず「1つの具体的な質問」に絞ってください。
- 休日の過ごし方、予期せぬ予定変更があったときの対応、新しい趣味への挑戦、人間関係の心地よい距離感など、日常のシーンを尋ねてください。
`;

export const ANALYSIS_JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    personality_title: {
      type: "STRING",
      description: "ユーザーの性格を象徴するキャッチコピー（例: '知的好奇心豊かな先駆的イノベーター'）"
    },
    personality_type: {
      type: "STRING",
      description: "性格タイプ分類名（例: '創造的探究型', '調和重視サポーター' 等）"
    },
    summary: {
      type: "STRING",
      description: "全体的な人物像と個性の統合的解説（250〜400文字程度）"
    },
    scores: {
      type: "OBJECT",
      properties: {
        openness: {
          type: "OBJECT",
          properties: {
            score: { type: "INTEGER", description: "0から100のスコア" },
            level: { type: "STRING", description: "スコア水準（非常に高い, 高い, 平均的, 控えめ, 低い）" },
            title: { type: "STRING", description: "この次元の特徴を一言で" },
            description: { type: "STRING", description: "詳細な解説" },
            traits: { type: "ARRAY", items: { type: "STRING" }, description: "キーワード3〜4個" }
          },
          required: ["score", "level", "title", "description", "traits"]
        },
        conscientiousness: {
          type: "OBJECT",
          properties: {
            score: { type: "INTEGER", description: "0から100のスコア" },
            level: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            traits: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["score", "level", "title", "description", "traits"]
        },
        extraversion: {
          type: "OBJECT",
          properties: {
            score: { type: "INTEGER", description: "0から100のスコア" },
            level: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            traits: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["score", "level", "title", "description", "traits"]
        },
        agreeableness: {
          type: "OBJECT",
          properties: {
            score: { type: "INTEGER", description: "0から100のスコア" },
            level: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            traits: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["score", "level", "title", "description", "traits"]
        },
        neuroticism: {
          type: "OBJECT",
          properties: {
            score: { type: "INTEGER", description: "0から100のスコア" },
            level: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            traits: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["score", "level", "title", "description", "traits"]
        }
      },
      required: ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
    },
    strengths: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "主要な強み（3〜4個）"
    },
    growth_areas: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "注意点や成長のヒント（2〜3個）"
    },
    career_recommendations: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "適したワークスタイルや活躍しやすい環境（3〜4個）"
    },
    relationship_style: {
      type: "STRING",
      description: "対人関係やコミュニケーションの特徴とアドバイス"
    },
    stress_management: {
      type: "STRING",
      description: "ストレスを感じやすい傾向と効果的な解消法"
    }
  },
  required: [
    "personality_title",
    "personality_type",
    "summary",
    "scores",
    "strengths",
    "growth_areas",
    "career_recommendations",
    "relationship_style",
    "stress_management"
  ]
};
