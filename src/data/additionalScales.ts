import { SurveyScoreDetail, SelfMonitoringScoreDetail } from '../types';

export interface AdditionalQuestion {
  id: number;
  text: string;
  scale: 'self_monitoring' | 'social_desirability';
  subscale?: 'ability' | 'sensitivity';
  is_reverse: boolean;
  conceptLabel: string;
}

export interface AdditionalScaleConfig {
  id: string;
  name: string;
  shortName: string;
  authorYear: string;
  description: string;
  questionCount: number;
  likertPoints: number;
  instruction: string;
  questions: AdditionalQuestion[];
}

/**
 * 改訂自己モニタリング尺度 (Revised Self-Monitoring Scale: RSMS) 日本語短縮版 (10項目)
 * 典拠: Lennox & Wolfe (1984) / Snyder (1974) / 岩男・杉森 (1985)
 * 下位尺度:
 * - ability: 自己呈示の変容能力 (Ability to modify self-presentation)
 * - sensitivity: 他者の表出行動への感受性 (Sensitivity to expressive behavior of others)
 */
export const SELF_MONITORING_CONFIG: AdditionalScaleConfig = {
  id: 'self-monitoring',
  name: '改訂自己モニタリング尺度 日本語短縮版 (RSMS-10)',
  shortName: '自己モニタリング (SM)',
  authorYear: 'Lennox & Wolfe (1984) / Snyder (1974)',
  description: '状況や他者の反応に合わせて自身の表出や行動を柔軟にコントロール・調整する傾向（高自己モニタリング）か、内面的な感情や信念に忠実に一貫して行動する傾向（低自己モニタリング）かを測定します。',
  questionCount: 10,
  likertPoints: 5,
  instruction: '以下の文は、あなたの普段の対人関係や振る舞い方にどの程度あてはまりますか？5段階でお答えください。',
  questions: [
    {
      id: 31,
      text: '相手の表情やしぐさから、その人がどう感じているかを察するのが得意だ。',
      scale: 'self_monitoring',
      subscale: 'sensitivity',
      is_reverse: false,
      conceptLabel: '他者感情の察知'
    },
    {
      id: 32,
      text: '状況やその場の雰囲気に合わせて、自分の振る舞い方を柔軟に変えることができる。',
      scale: 'self_monitoring',
      subscale: 'ability',
      is_reverse: false,
      conceptLabel: '状況への柔軟な適応'
    },
    {
      id: 33,
      text: 'どんな場面でも、周りの空気に合わせるより自分の素のままで行動することが多い。',
      scale: 'self_monitoring',
      subscale: 'ability',
      is_reverse: true,
      conceptLabel: '素のままの行動貫徹'
    },
    {
      id: 34,
      text: '人と接するとき、相手が自分に対してどのような印象を抱いているかが気になる。',
      scale: 'self_monitoring',
      subscale: 'sensitivity',
      is_reverse: false,
      conceptLabel: '相手からの印象への関心'
    },
    {
      id: 35,
      text: '会話の相手や場に合わせて、親しみやすい態度や礼儀正しい態度を使い分けることができる。',
      scale: 'self_monitoring',
      subscale: 'ability',
      is_reverse: false,
      conceptLabel: '態度・自己呈示の演じ分け'
    },
    {
      id: 36,
      text: '他人が本音を隠していたり、無理に笑顔を作っていることに気づきやすい。',
      scale: 'self_monitoring',
      subscale: 'sensitivity',
      is_reverse: false,
      conceptLabel: '他者の真情・本音への敏感さ'
    },
    {
      id: 37,
      text: '集まりやグループの中で、求められている役割（盛り上げ役や聞き役など）に合わせて振る舞うことができる。',
      scale: 'self_monitoring',
      subscale: 'ability',
      is_reverse: false,
      conceptLabel: '求められる役割の遂行'
    },
    {
      id: 38,
      text: '会話中の相手の感情の変化や、声のトーンの微妙な違いに敏感である。',
      scale: 'self_monitoring',
      subscale: 'sensitivity',
      is_reverse: false,
      conceptLabel: '非言語・声のトーンの察知'
    },
    {
      id: 39,
      text: '他人に良く思われるために、自分の意見や好みを曲げて相手に合わせることはしない。',
      scale: 'self_monitoring',
      subscale: 'ability',
      is_reverse: true,
      conceptLabel: '同調回避・自律性'
    },
    {
      id: 40,
      text: '大人数の中にいるとき、周りの人たちがどのように行動しているかを自然と観察している。',
      scale: 'self_monitoring',
      subscale: 'sensitivity',
      is_reverse: false,
      conceptLabel: '周囲の動向観察'
    }
  ]
};

/**
 * Marlowe-Crowne 社会的望ましさ尺度 (MCSDS) 日本語短縮版 (10項目)
 * 典拠: Crowne & Marlowe (1960) / Reynolds (1982) / 北村・鈴木 (1986)
 * 「誰もが日常的に経験する小さな不品行や否定的な感情」を否認するか、
 * 「滅多にできない完全無欠の徳行」を主張する傾向（建前・印象操作・社会的望ましさバイアス）を測定
 */
export const SOCIAL_DESIRABILITY_CONFIG: AdditionalScaleConfig = {
  id: 'social-desirability',
  name: 'Marlowe-Crowne 社会的望ましさ尺度 日本語短縮版 (MCSDS-10)',
  shortName: '社会的望ましさ (SD)',
  authorYear: 'Crowne & Marlowe (1960) / 北村・鈴木 (1986)',
  description: '回答が社会的に望ましいとされる規範や模範解答（建前）にどれくらい引っ張られているかを測定し、自己報告のバイアス傾向を評価します。',
  questionCount: 10,
  likertPoints: 5,
  instruction: '以下の文は、あなたの普段の行動や態度にどれくらいあてはまりますか？率直にご自身を振り返ってお答えください。',
  questions: [
    {
      id: 41,
      text: '誰にでも欠点はあるが、私は他人の欠点やミスに対して腹を立てたことが一度もない。',
      scale: 'social_desirability',
      is_reverse: false,
      conceptLabel: '他者欠点への不怒'
    },
    {
      id: 42,
      text: '自分の思い通りにいかないことが重なると、少し機嫌が悪くなったり不機嫌になることがある。',
      scale: 'social_desirability',
      is_reverse: true,
      conceptLabel: '思い通りにならない時の不機嫌'
    },
    {
      id: 43,
      text: '自分が誤りやミスをしたときは、どんなときでも言い訳をせず素直にそれを認める。',
      scale: 'social_desirability',
      is_reverse: false,
      conceptLabel: '過ちの即座受容'
    },
    {
      id: 44,
      text: 'これまでに一度も、他人の悪口や噂話を言ったり、興味を持って聞いたりしたことがない。',
      scale: 'social_desirability',
      is_reverse: false,
      conceptLabel: '噂話・悪口の完全拒絶'
    },
    {
      id: 45,
      text: '気が進まない頼まれごとをされたとき、断るための口実や言い訳を考えたことがある。',
      scale: 'social_desirability',
      is_reverse: true,
      conceptLabel: '断りの口実模索'
    },
    {
      id: 46,
      text: '相手の立場や好みに左右されず、誰に対しても常に公平で親切に接することができる。',
      scale: 'social_desirability',
      is_reverse: false,
      conceptLabel: '普遍的公平親切'
    },
    {
      id: 47,
      text: '会話中、よく知らないことでも見栄を張って知っているようなふりをしたことがある。',
      scale: 'social_desirability',
      is_reverse: true,
      conceptLabel: '知ったかぶりの経験'
    },
    {
      id: 48,
      text: '約束の時間や締め切りには、どんな理由があっても絶対に遅れたことがない。',
      scale: 'social_desirability',
      is_reverse: false,
      conceptLabel: '時間・締切の完全厳守'
    },
    {
      id: 49,
      text: '人に親切にしてもらったときでも、感謝の言葉を言い忘れたりお礼をしなかったことが時々ある。',
      scale: 'social_desirability',
      is_reverse: true,
      conceptLabel: 'お礼の失念'
    },
    {
      id: 50,
      text: '感情的になって他人に当たったり、心ないきつい言葉を言ってしまったことは一度もない。',
      scale: 'social_desirability',
      is_reverse: false,
      conceptLabel: '感情的言動の完全皆無'
    }
  ]
};

/**
 * 自己モニタリング尺度の得点算出
 * 逆転項目反転 (6 - rawVal) 後に平均点と 0〜100正規化スコアを算出
 */
export function calculateSelfMonitoringScore(
  rawAnswers: Record<string | number, number>
): SelfMonitoringScoreDetail {
  const maxPoints = SELF_MONITORING_CONFIG.likertPoints;
  const questions = SELF_MONITORING_CONFIG.questions;

  const allScores: number[] = [];
  const abilityScores: number[] = [];
  const sensitivityScores: number[] = [];

  questions.forEach(q => {
    const rawVal = rawAnswers[q.id];
    if (typeof rawVal === 'number' && rawVal >= 1 && rawVal <= maxPoints) {
      const scoredVal = q.is_reverse ? (maxPoints + 1) - rawVal : rawVal;
      allScores.push(scoredVal);
      if (q.subscale === 'ability') abilityScores.push(scoredVal);
      if (q.subscale === 'sensitivity') sensitivityScores.push(scoredVal);
    }
  });

  if (allScores.length === 0) {
    return { rawMean: 3, normalizedScore: 50, subscores: { ability: 50, sensitivity: 50 } };
  }

  const rawMean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const normalizedScore = Math.min(100, Math.max(0, Math.round(((rawMean - 1) / (maxPoints - 1)) * 100)));

  const calcSub = (arr: number[]) => {
    if (arr.length === 0) return 50;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.min(100, Math.max(0, Math.round(((m - 1) / (maxPoints - 1)) * 100)));
  };

  return {
    rawMean: Math.round(rawMean * 100) / 100,
    normalizedScore,
    subscores: {
      ability: calcSub(abilityScores),
      sensitivity: calcSub(sensitivityScores)
    }
  };
}

/**
 * 社会的望ましさ尺度の得点算出
 * 逆転項目反転 (6 - rawVal) 後に平均点と 0〜100正規化スコアを算出
 * 高得点ほど「社会的に望ましい模範解答・建前」の回答傾向が強い
 */
export function calculateSocialDesirabilityScore(
  rawAnswers: Record<string | number, number>
): SurveyScoreDetail {
  const maxPoints = SOCIAL_DESIRABILITY_CONFIG.likertPoints;
  const questions = SOCIAL_DESIRABILITY_CONFIG.questions;

  const allScores: number[] = [];

  questions.forEach(q => {
    const rawVal = rawAnswers[q.id];
    if (typeof rawVal === 'number' && rawVal >= 1 && rawVal <= maxPoints) {
      const scoredVal = q.is_reverse ? (maxPoints + 1) - rawVal : rawVal;
      allScores.push(scoredVal);
    }
  });

  if (allScores.length === 0) {
    return { rawMean: 3, normalizedScore: 50 };
  }

  const rawMean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const normalizedScore = Math.min(100, Math.max(0, Math.round(((rawMean - 1) / (maxPoints - 1)) * 100)));

  return {
    rawMean: Math.round(rawMean * 100) / 100,
    normalizedScore
  };
}
