import { SurveyScoreDetail } from '../types';

export interface SocialDesirabilityQuestion {
  id: number;
  text: string;
  is_reverse: boolean;
  conceptLabel: string;
}

export interface SocialDesirabilityConfig {
  id: string;
  name: string;
  shortName: string;
  authorYear: string;
  description: string;
  questionCount: number;
  likertPoints: number;
  instruction: string;
  questions: SocialDesirabilityQuestion[];
}

/**
 * Marlowe-Crowne 社会的望ましさ尺度 (MCSDS) 日本語短縮版 (10項目: Q31〜Q40)
 * 典拠: Crowne & Marlowe (1960) / Reynolds (1982) / 北村・鈴木 (1986)
 * 「誰もが日常的に経験する小さな不徳や否定的な感情」を否認するか、
 * 「滅多にできない完全無欠の徳行」を主張する傾向（建前・模範解答・社会的望ましさバイアス）を測定
 */
export const SOCIAL_DESIRABILITY_CONFIG: SocialDesirabilityConfig = {
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
      id: 31,
      text: '誰にでも欠点はあるが、私は他人の欠点やミスに対して腹を立てたことが一度もない。',
      is_reverse: false,
      conceptLabel: '他者欠点への不怒'
    },
    {
      id: 32,
      text: '自分の思い通りにいかないことが重なると、少し機嫌が悪くなったり不機嫌になることがある。',
      is_reverse: true,
      conceptLabel: '思い通りにならない時の不機嫌'
    },
    {
      id: 33,
      text: '自分が誤りやミスをしたときは、どんなときでも言い訳をせず素直にそれを認める。',
      is_reverse: false,
      conceptLabel: '過ちの即座受容'
    },
    {
      id: 34,
      text: 'これまでに一度も、他人の悪口や噂話を言ったり、興味を持って聞いたりしたことがない。',
      is_reverse: false,
      conceptLabel: '噂話・悪口の完全拒絶'
    },
    {
      id: 35,
      text: '気が進まない頼まれごとをされたとき、断るための口実や言い訳を考えたことがある。',
      is_reverse: true,
      conceptLabel: '断りの口実模索'
    },
    {
      id: 36,
      text: '相手の立場や好みに左右されず、誰に対しても常に公平で親切に接することができる。',
      is_reverse: false,
      conceptLabel: '普遍的公平親切'
    },
    {
      id: 37,
      text: '会話中、よく知らないことでも見栄を張って知っているようなふりをしたことがある。',
      is_reverse: true,
      conceptLabel: '知ったかぶりの経験'
    },
    {
      id: 38,
      text: '約束の時間や締め切りには、どんな理由があっても絶対に遅れたことがない。',
      is_reverse: false,
      conceptLabel: '時間・締切の完全厳守'
    },
    {
      id: 39,
      text: '人に親切にしてもらったときでも、感謝の言葉を言い忘れたりお礼をしなかったことが時々ある。',
      is_reverse: true,
      conceptLabel: 'お礼の失念'
    },
    {
      id: 40,
      text: '感情的になって他人に当たったり、心ないきつい言葉を言ってしまったことは一度もない。',
      is_reverse: false,
      conceptLabel: '感情的言動の完全皆無'
    }
  ]
};

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
