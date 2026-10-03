import { ScaleType, SurveyScaleConfig, DimensionKey, SurveyResult, SurveyScoreDetail } from '../types';

export const PERSONALITY_SCALES: Record<ScaleType, SurveyScaleConfig> = {
  'tipi-j': {
    id: 'tipi-j',
    name: 'TIPI-J (日本語版Ten Item Personality Inventory)',
    shortName: 'TIPI-J',
    authorYear: '小塩・阿部・カトローニ (2012)',
    description: 'わずか10項目でビッグファイブの5特性を効率的に測定できる超短縮尺度です。',
    questionCount: 10,
    estimatedMinutes: '約1〜2分',
    likertPoints: 7,
    scaleLabels: [
      { value: 1, label: '全く違うと思う' },
      { value: 2, label: 'おおよそ違うと思う' },
      { value: 3, label: '少し違うと思う' },
      { value: 4, label: 'どちらでもない' },
      { value: 5, label: '少しそう思う' },
      { value: 6, label: 'おおよそそう思う' },
      { value: 7, label: '強くそう思う' }
    ],
    instruction: '以下のそれぞれの項目について、ご自身にどの程度あてはまるかを7段階でお答えください。「私は自分自身のことを…」',
    questions: [
      { id: 1, text: '活発で、外向的だと思う。', dimension: 'extraversion', is_reverse: false },
      { id: 2, text: '他人に不満をもち、もめごとを起こしやすいと思う。', dimension: 'agreeableness', is_reverse: true },
      { id: 3, text: 'しっかりしていて、自分に厳しいと思う。', dimension: 'conscientiousness', is_reverse: false },
      { id: 4, text: '心配性で、うろたえやすいと思う。', dimension: 'neuroticism', is_reverse: false },
      { id: 5, text: '新しいことが好きで、変わった考えをもつと思う。', dimension: 'openness', is_reverse: false },
      { id: 6, text: 'ひかえめで、おとなしいと思う。', dimension: 'extraversion', is_reverse: true },
      { id: 7, text: '人に気をつかう、やさしい人間だと思う。', dimension: 'agreeableness', is_reverse: false },
      { id: 8, text: 'だらしなく、うっかりしていると思う。', dimension: 'conscientiousness', is_reverse: true },
      { id: 9, text: '冷静で、気分が安定していると思う。', dimension: 'neuroticism', is_reverse: true },
      { id: 10, text: '発想力に欠けた、平凡な人間だと思う。', dimension: 'openness', is_reverse: true }
    ]
  },

  'namikawa': {
    id: 'namikawa',
    name: 'Big Five 尺度短縮版 (並川ら)',
    shortName: '並川ら短縮版',
    authorYear: '並川・谷・脇田・熊谷・中根・野口 (2012)',
    description: '和田(1996)の尺度をもとに項目反応理論を用いて精選された、信頼性の高い29項目の形容詞尺度です。',
    questionCount: 29,
    estimatedMinutes: '約3〜5分',
    likertPoints: 7,
    scaleLabels: [
      { value: 1, label: 'まったくあてはまらない' },
      { value: 2, label: 'あてはまらない' },
      { value: 3, label: 'あまりあてはまらない' },
      { value: 4, label: 'どちらともいえない' },
      { value: 5, label: 'ややあてはまる' },
      { value: 6, label: 'あてはまる' },
      { value: 7, label: '非常にあてはまる' }
    ],
    instruction: '以下のそれぞれの言葉について、ご自身の普段の様子や性格にどの程度あてはまるかをお答えください。',
    questions: [
      // 外向性 (5項目)
      { id: 1, text: '活発な', dimension: 'extraversion', is_reverse: false },
      { id: 2, text: 'おしゃべりな', dimension: 'extraversion', is_reverse: false },
      { id: 3, text: '陽気な', dimension: 'extraversion', is_reverse: false },
      { id: 4, text: 'おとなしい', dimension: 'extraversion', is_reverse: true },
      { id: 5, text: '無口な', dimension: 'extraversion', is_reverse: true },
      // 調和性 / 協調性 (6項目)
      { id: 6, text: '温かい', dimension: 'agreeableness', is_reverse: false },
      { id: 7, text: '親切な', dimension: 'agreeableness', is_reverse: false },
      { id: 8, text: '思いやりのある', dimension: 'agreeableness', is_reverse: false },
      { id: 9, text: '寛大な', dimension: 'agreeableness', is_reverse: false },
      { id: 10, text: '冷淡な', dimension: 'agreeableness', is_reverse: true },
      { id: 11, text: '怒りっぽい', dimension: 'agreeableness', is_reverse: true },
      // 誠実性 / 勤勉性 (7項目)
      { id: 12, text: '几帳面な', dimension: 'conscientiousness', is_reverse: false },
      { id: 13, text: '計画性のある', dimension: 'conscientiousness', is_reverse: false },
      { id: 14, text: '慎重な', dimension: 'conscientiousness', is_reverse: false },
      { id: 15, text: '責任感のある', dimension: 'conscientiousness', is_reverse: false },
      { id: 16, text: '粘り強い', dimension: 'conscientiousness', is_reverse: false },
      { id: 17, text: 'だらしない', dimension: 'conscientiousness', is_reverse: true },
      { id: 18, text: '気まぐれな', dimension: 'conscientiousness', is_reverse: true },
      // 情緒不安定性 / 神経症傾向 (5項目)
      { id: 19, text: '心配性な', dimension: 'neuroticism', is_reverse: false },
      { id: 20, text: '緊張しやすい', dimension: 'neuroticism', is_reverse: false },
      { id: 21, text: '不安になりやすい', dimension: 'neuroticism', is_reverse: false },
      { id: 22, text: '傷つきやすい', dimension: 'neuroticism', is_reverse: false },
      { id: 23, text: '落ち着いた', dimension: 'neuroticism', is_reverse: true },
      // 開放性 (6項目)
      { id: 24, text: '好奇心の強い', dimension: 'openness', is_reverse: false },
      { id: 25, text: '独創的な', dimension: 'openness', is_reverse: false },
      { id: 26, text: '想像力豊かな', dimension: 'openness', is_reverse: false },
      { id: 27, text: '知的な', dimension: 'openness', is_reverse: false },
      { id: 28, text: '芸術的な', dimension: 'openness', is_reverse: false },
      { id: 29, text: '保守的な', dimension: 'openness', is_reverse: true }
    ]
  },

  'bfi-2-s': {
    id: 'bfi-2-s',
    name: 'BFI-2-S 日本語版 (Big Five Inventory-2 短縮版)',
    shortName: 'BFI-2-S',
    authorYear: '吉野・下司・橋本・上野・三枝・小塩 (2026) / Soto & John (2017)',
    description: '国際標準のBFI-2の精緻な下位概念構造を保ちながら30項目に凝縮した現代的尺度です。',
    questionCount: 30,
    estimatedMinutes: '約3〜5分',
    likertPoints: 5,
    scaleLabels: [
      { value: 1, label: '全くあてはまらない' },
      { value: 2, label: 'あまりあてはまらない' },
      { value: 3, label: 'どちらともいえない' },
      { value: 4, label: 'ややあてはまる' },
      { value: 5, label: 'とてもよくあてはまる' }
    ],
    instruction: '以下の文は、あなたの特徴を表していると思いますか？ご自身にどれくらいあてはまるかを5段階でお答えください。「私は…」',
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
  }
};

/**
 * 尺度回答から各因子の得点を集計・算出
 */
export function calculateSurveyScores(
  scaleType: ScaleType,
  rawAnswers: Record<number, number>
): Record<DimensionKey, SurveyScoreDetail> {
  const config = PERSONALITY_SCALES[scaleType];
  const maxPoints = config.likertPoints;

  const dimensionValues: Record<DimensionKey, number[]> = {
    openness: [],
    conscientiousness: [],
    extraversion: [],
    agreeableness: [],
    neuroticism: []
  };

  config.questions.forEach((q) => {
    const rawVal = rawAnswers[q.id];
    if (typeof rawVal === 'number' && rawVal >= 1 && rawVal <= maxPoints) {
      // 逆転項目の反転処理
      // 7件法なら (7 + 1) - rawVal = 8 - rawVal
      // 5件法なら (5 + 1) - rawVal = 6 - rawVal
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
      // 0〜100に正規化
      // (mean - 1) / (maxPoints - 1) * 100
      const normalized = Math.round(((mean - 1) / (maxPoints - 1)) * 100);
      result[dim] = {
        rawMean: Math.round(mean * 100) / 100,
        normalizedScore: Math.min(100, Math.max(0, normalized))
      };
    }
  });

  return result;
}
