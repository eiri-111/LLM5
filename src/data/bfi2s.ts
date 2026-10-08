import { DimensionKey, SurveyScoreDetail } from '../types';

export interface BfiQuestion {
  id: number;
  text: string;
  dimension: DimensionKey;
  is_reverse: boolean;
  facet: string;
}

export interface BfiScaleConfig {
  id: string;
  name: string;
  shortName: string;
  authorYear: string;
  description: string;
  questionCount: number;
  estimatedMinutes: string;
  likertPoints: number;
  scaleLabels: { value: number; label: string }[];
  instruction: string;
  questions: BfiQuestion[];
}

export const BFI_2_S_CONFIG: BfiScaleConfig = {
  id: 'bfi-2-s',
  name: 'BFI-2-S 日本語版 (Big Five Inventory-2 短縮版)',
  shortName: 'BFI-2-S',
  authorYear: '吉野・下司・橋本・上野・三枝・小塩 (2026) / Soto & John (2017)',
  description: '国際標準のビッグファイブ尺度BFI-2の精緻な下位概念構造を保ちながら30項目に凝縮した現代的尺度です。',
  questionCount: 30,
  estimatedMinutes: '約2〜3分',
  likertPoints: 5,
  scaleLabels: [
    { value: 1, label: '全くあてはまらない' },
    { value: 2, label: 'あまりあてはまらない' },
    { value: 3, label: 'どちらともいえない' },
    { value: 4, label: 'ややあてはまる' },
    { value: 5, label: 'とてもよくあてはまる' }
  ],
  instruction: '以下の文は、あなたの普段の特徴を表していると思いますか？ご自身にどれくらいあてはまるかを5段階でお答えください。「私は普段…」',
  questions: [
    { id: 1, text: '無口な方だ。', dimension: 'extraversion', is_reverse: true, facet: '社交性' },
    { id: 2, text: '他人への思いやりがあり、優しい。', dimension: 'agreeableness', is_reverse: false, facet: '思いやり' },
    { id: 3, text: '行き当たりばったりな方だ。', dimension: 'conscientiousness', is_reverse: true, facet: '組織化' },
    { id: 4, text: '多くの悩みごとを抱えている。', dimension: 'neuroticism', is_reverse: false, facet: '不安' },
    { id: 5, text: '芸術的関心があまりない。', dimension: 'openness', is_reverse: true, facet: '美的好奇心' },
    { id: 6, text: '堂々としていて、自己主張ができる。', dimension: 'extraversion', is_reverse: false, facet: '主張性' },
    { id: 7, text: '他人を疑いやすい。', dimension: 'agreeableness', is_reverse: true, facet: '信頼' },
    { id: 8, text: '怠けがちである。', dimension: 'conscientiousness', is_reverse: true, facet: '生産性' },
    { id: 9, text: '落ち込んだり、憂鬱になりやすい。', dimension: 'neuroticism', is_reverse: false, facet: '抑うつ' },
    { id: 10, text: '抽象的な知識にはほとんど関心がない。', dimension: 'openness', is_reverse: true, facet: '知的好奇心' },
    { id: 11, text: 'いつもエネルギーに満ちている。', dimension: 'extraversion', is_reverse: false, facet: '活動性' },
    { id: 12, text: '誰に対しても礼儀正しく敬意を払う。', dimension: 'agreeableness', is_reverse: false, facet: '敬意' },
    { id: 13, text: '信頼がおけ、常に頼りになる。', dimension: 'conscientiousness', is_reverse: false, facet: '責任感' },
    { id: 14, text: '情緒が安定していて、動じにくい。', dimension: 'neuroticism', is_reverse: true, facet: '感情の変動' },
    { id: 15, text: '独創的で、新しいアイデアを思いつく。', dimension: 'openness', is_reverse: false, facet: '創造力' },
    { id: 16, text: '積極的で、社交的である。', dimension: 'extraversion', is_reverse: false, facet: '社交性' },
    { id: 17, text: '冷淡で思いやりに欠けることがある。', dimension: 'agreeableness', is_reverse: true, facet: '思いやり' },
    { id: 18, text: '物事をきちんと整理整頓しておく。', dimension: 'conscientiousness', is_reverse: false, facet: '組織化' },
    { id: 19, text: 'リラックスしていて、ストレスにうまく対処している。', dimension: 'neuroticism', is_reverse: true, facet: '不安' },
    { id: 20, text: '芸術や音楽、文学に強い魅力を感じる。', dimension: 'openness', is_reverse: false, facet: '美的好奇心' },
    { id: 21, text: '他人をリードするのが得意である。', dimension: 'extraversion', is_reverse: false, facet: '主張性' },
    { id: 22, text: '他人と対立したり、揉め事を起こしやすい。', dimension: 'agreeableness', is_reverse: true, facet: '敬意' },
    { id: 23, text: '物事を最後までやり通すのが苦手である。', dimension: 'conscientiousness', is_reverse: true, facet: '生産性' },
    { id: 24, text: '不安や緊張を感じやすい。', dimension: 'neuroticism', is_reverse: false, facet: '感情の変動' },
    { id: 25, text: '考え方が複雑で、深く考える人間だ。', dimension: 'openness', is_reverse: false, facet: '知的好奇心' },
    { id: 26, text: '控えめで、大人しい。', dimension: 'extraversion', is_reverse: true, facet: '活動性' },
    { id: 27, text: '他人に対して冷たく、無関心になりやすい。', dimension: 'agreeableness', is_reverse: true, facet: '信頼' },
    { id: 28, text: '効率的に仕事をこなす。', dimension: 'conscientiousness', is_reverse: false, facet: '責任感' },
    { id: 29, text: '気分の浮き沈みが激しい。', dimension: 'neuroticism', is_reverse: false, facet: '抑うつ' },
    { id: 30, text: '創造性がほとんどない。', dimension: 'openness', is_reverse: true, facet: '創造力' }
  ]
};

/**
 * BFI-2-Sの回答から逆転項目の反転処理と0〜100正規化スコアを算出
 */
export function calculateBfiScores(
  rawAnswers: Record<number, number>
): Record<DimensionKey, SurveyScoreDetail> {
  const maxPoints = BFI_2_S_CONFIG.likertPoints; // 5件法

  const dimensionValues: Record<DimensionKey, number[]> = {
    openness: [],
    conscientiousness: [],
    extraversion: [],
    agreeableness: [],
    neuroticism: []
  };

  BFI_2_S_CONFIG.questions.forEach((q) => {
    const rawVal = rawAnswers[q.id];
    if (typeof rawVal === 'number' && rawVal >= 1 && rawVal <= maxPoints) {
      // 5件法の逆転項目反転計算: (5 + 1) - rawVal = 6 - rawVal
      const scoredVal = q.is_reverse ? (maxPoints + 1) - rawVal : rawVal;
      dimensionValues[q.dimension].push(scoredVal);
    }
  });

  const result: Record<DimensionKey, SurveyScoreDetail> = {
    openness: { rawMean: 0, normalizedScore: 0 },
    conscientiousness: { rawMean: 0, normalizedScore: 0 },
    extraversion: { rawMean: 0, normalizedScore: 0 },
    agreeableness: { rawMean: 0, normalizedScore: 0 },
    neuroticism: { rawMean: 0, normalizedScore: 0 }
  };

  (Object.keys(dimensionValues) as DimensionKey[]).forEach((dim) => {
    const values = dimensionValues[dim];
    if (values.length > 0) {
      const sum = values.reduce((acc, v) => acc + v, 0);
      const mean = sum / values.length;
      // 0〜100に正規化: (mean - 1) / (5 - 1) * 100
      const normalized = Math.round(((mean - 1) / (maxPoints - 1)) * 100);
      result[dim] = {
        rawMean: Math.round(mean * 100) / 100,
        normalizedScore: Math.min(100, Math.max(0, normalized))
      };
    }
  });

  return result;
}
