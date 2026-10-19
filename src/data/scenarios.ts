import { UserProfile } from '../types';

export interface ScenarioDefinition {
  scenarioTitle: string;
  situationText: string;
  questionText: string;
}

/**
 * 因子と年齢層に応じた、再現性のある詳細な架空場面（SJTシナリオ）を生成
 */
export function getDetailedScenarioForFactor(factor?: string, age?: number): ScenarioDefinition {
  const isStudent = typeof age === 'number' && age >= 15 && age <= 23;
  const isYoungAdult = typeof age === 'number' && age >= 24 && age <= 35;

  switch (factor) {
    case '誠実性':
      return {
        scenarioTitle: '締切・計画の破綻とスケジュール再構築',
        situationText: isStudent
          ? '数日後に提出が必要な大学のレポートや課題（または大事な用事）があり、今日中に半分終わらせる計画だったとします。ところが急な予定が入ったり集中が切れたりして、全く手をつかないまま夜遅くになってしまいました。明日は朝から講義が詰まっています。'
          : isYoungAdult
          ? '数日後に提出が必要な仕事の重要書類や企画書（またはプライベートの大事な手続き）があり、今日中に半分仕上げる計画だったとします。ところが急な業務や突発的なトラブル対応が入り、手をつかないまま夜遅くになってしまいました。明日は朝から予定が詰まっています。'
          : '期日までに必ず提出・準備しなければいけない大事な用事や書類があり、今日中に半分終わらせる計画だったとします。ところが急な予定や用事が入って後回しになり、気づけば夜遅くになってしまいました。明日は朝から外せない予定があります。',
        questionText:
          'この状況になったとき、あなたなら今夜から翌朝にかけて具体的にどう動きますか？（徹夜してでも意地で仕上げる、諦めて寝て朝早起きする、相手に期限の猶予や相談の連絡を入れる、優先度をつけて最低限だけ終わらせるなど、あなたの素の行動手順や、その時の焦り・気持ちの落ち着かせ方を教えてください）'
      };

    case '外向性':
    case '協調性':
      return {
        scenarioTitle: '集まりの計画・意見対立と意思決定',
        situationText: isStudent
          ? '友人やサークル・ゼミ仲間など3〜4人で、週末の集まり（食事の店選びや遊びの行き先など）を決めている場面を想像してください。相談している最中、メンバーの意見が「遠出して新しい場所に行きたい派」と「近場でゆっくりしたい派」に真っ二つに分かれ、議論が平行線のまま気まずい沈黙が流れて決まらなくなってしまいました。'
          : isYoungAdult
          ? '同僚や友人、パートナーなど3〜4人で、集まりの行き先や食事の店などを決めている場面を想像してください。相談している最中、意見が真っ二つに分かれて議論が平行線になり、気まずい沈黙が流れて決まらなくなってしまいました。'
          : '友人や知人、家族など3〜4人で、集まりや予定（出かける場所や食事の店など）を決めている場面を想像してください。相談している最中、意見が真っ二つに分かれて平行線になり、気まずい沈黙が流れて決まらなくなってしまいました。',
        questionText:
          'このとき、あなたはその場のメンバーに対して、具体的にどんなタイミングで何と声をかけますか？（自分から妥協案を出して引っ張る、誰かの意見に同調して決める、場を和ませる雑談を挟む、周りの様子を見て決定に任せるなど、あなたが実際に取る発言や立ち回りを教えてください）'
      };

    case '開放性':
      return {
        scenarioTitle: '休日の過ごし方・新しい刺激 vs いつもの定番',
        situationText:
          '休日に、誰とも約束がなく丸一日フリーな時間ができたとします。部屋で過ごしていて、ふと「何か普段とは違う面白いことや、新しい刺激に触れてみたい」という気分になりました。',
        questionText:
          'このとき、あなたは普段行かない新しいお店や場所に出かけたり、今まで触れたことのないジャンルの作品（動画・映画・音楽・ゲーム・本など）を、具体的にどのように探して試しますか？それとも、少し探したものの結局いつもの慣れ親しんだお気に入り（いつも通りの過ごし方・知っている作品）を選びますか？実際の探し方や選ぶ基準を教えてください。'
      };

    case '情緒安定性':
    default:
      return {
        scenarioTitle: '予定外のトラブル・他人のミスと気分の切り替え',
        situationText:
          '誰かと一緒に予定を進めている最中（または待ち合わせなど）に、相手のうっかりミスや手違いで、予定が大きく狂ったり、自分にも余計な手間がかかるトラブルが発生してしまった状況を想像してください。',
        questionText:
          'その瞬間、あなたはその相手に対してどのような口調や態度で接しますか？また、その出来事のあと、イライラや嫌な気分をどのように切り替えますか？どれくらい引きずるか、実際のあなたの反応やその後の過ごし方を教えてください。'
      };
  }
}

/**
 * 行動アンカー評定尺度（BARS / BOS）に基づく客観的行動評価ルーブリック
 */
export interface BARSBehaviorCriteria {
  facetKey: string;
  factor: string;
  facetName: string;
  positiveBehavior: string; // 該当した場合に行動エビデンスとして評価される具体的行動事実
  negativeBehavior?: string; // 逆転傾向を示す行動事実
}

export const BARS_RUBRICS: BARSBehaviorCriteria[] = [
  // 開放性 (Openness)
  {
    facetKey: 'facet_openness_intellectual',
    factor: '開放性',
    facetName: '知的好奇心',
    positiveBehavior: '未知の概念や抽象的な仕組みに対して、自ら背景・理由を調べたり深く考察したりする行動を取った事実があるか'
  },
  {
    facetKey: 'facet_openness_aesthetic',
    factor: '開放性',
    facetName: '美的好奇心',
    positiveBehavior: 'デザイン・芸術・音楽・自然の美しさや雰囲気・文化的な体験に能動的に浸ったり鑑賞したりする行動を取った事実があるか'
  },
  {
    facetKey: 'facet_openness_creative',
    factor: '開放性',
    facetName: '創造力',
    positiveBehavior: '前例通りのやり方に固執せず、独自の工夫や新しいアプローチ・オリジナルの解決策を試した行動事実があるか'
  },

  // 誠実性 (Conscientiousness)
  {
    facetKey: 'facet_conscientiousness_organization',
    factor: '誠実性',
    facetName: '組織化',
    positiveBehavior: '予定が狂ったりタスクが逼迫した際、優先順位を整理し直し、段取り・スケジュールを具体的に組み立て直した行動事実があるか'
  },
  {
    facetKey: 'facet_conscientiousness_productiveness',
    factor: '誠実性',
    facetName: '生産性',
    positiveBehavior: '途中で投げ出したり先送りにせず、決めたタスクや役割を最後までやり遂げる・リカバリーを実行した行動事実があるか'
  },
  {
    facetKey: 'facet_conscientiousness_responsibility',
    factor: '誠実性',
    facetName: '責任感',
    positiveBehavior: '他者や締め切りとの約束を守るため、事前に連絡・相談を入れたり、自分の役割を全うしようと誠実に行動した事実があるか'
  },

  // 外向性 (Extraversion)
  {
    facetKey: 'facet_extraversion_sociability',
    factor: '外向性',
    facetName: '社交性',
    positiveBehavior: '沈黙や集まりの場で、自ら進んで他者に話しかけたり、会話の口火を切ってコミュニケーションを取った行動事実があるか'
  },
  {
    facetKey: 'facet_extraversion_assertiveness',
    factor: '外向性',
    facetName: '主張性',
    positiveBehavior: '周りに流されるだけでなく、自分の意見・希望・提案を堂々と表明し、全体の意思決定をリードしようとした行動事実があるか'
  },
  {
    facetKey: 'facet_extraversion_activity',
    factor: '外向性',
    facetName: '活動性',
    positiveBehavior: 'インドアで静止するだけでなく、能動的に外に出かけたり、活発に動き回ってエネルギーを行動に移した事実があるか'
  },

  // 協調性 (Agreeableness)
  {
    facetKey: 'facet_agreeableness_compassion',
    factor: '協調性',
    facetName: '思いやり',
    positiveBehavior: '他者の負担や立場・感情に寄り添い、相手を助けたり気遣う配慮の行動・声かけを行った事実があるか'
  },
  {
    facetKey: 'facet_agreeableness_respect',
    factor: '協調性',
    facetName: '敬意',
    positiveBehavior: '意見が対立したり相手がミスした際にも、頭ごなしに怒ったり攻撃せず、相手に敬意を払い穏やかに接した行動事実があるか'
  },
  {
    facetKey: 'facet_agreeableness_trust',
    factor: '協調性',
    facetName: '信頼',
    positiveBehavior: '周囲の人を過剰に疑わず、好意的に受け止めて協調・協力して進めようとした行動事実があるか'
  },

  // 情緒安定性 (Neuroticism 逆転 / Emotional Stability)
  {
    facetKey: 'facet_neuroticism_anxiety',
    factor: '情緒安定性',
    facetName: '不安の低さ・ストレス対処',
    positiveBehavior: 'プレッシャーや不測の事態に直面した際、パニックにならず深呼吸や気分転換を行い、冷静に自分を落ち着かせた行動事実があるか'
  },
  {
    facetKey: 'facet_neuroticism_depression',
    factor: '情緒安定性',
    facetName: '抑うつの低さ・気分の安定',
    positiveBehavior: 'トラブルや不本意な出来事の後、過度に落ち込み続けたり自責の念に囚われず、気持ちを前向きに切り替えた行動事実があるか'
  },
  {
    facetKey: 'facet_neuroticism_volatility',
    factor: '情緒安定性',
    facetName: '感情変動の低さ・動じにくさ',
    positiveBehavior: '突発的なアクシデントや他人の手違いに対して、感情的にならず冷静に対処策を実行した行動事実があるか'
  }
];

/**
 * STAR法（Situation, Task, Action, Result）に基づく深掘りプロービングプロンプトの指針
 */
export const STAR_PROBING_GUIDE = `
【STAR法に基づく構造化行動プロービングの鉄則】
1. S/T（状況・課題）はすでにシナリオで共有されているため、ユーザーの「A（実際の行動・具体的なセリフ）」と「R（その結果や気持ちの切り替え）」に焦点を絞ってください。
2. 抽象的な一般論（「普段から気をつけています」「話し合います」等）に対しては、必ず「その時、具体的に相手に何と声をかけましたか？」「具体的にどのような手順で動きましたか？」と1手だけ客観的行動を掘り下げてください。
3. 一度に複数の質問を投げず、必ず1つの明確な問い（末尾は『？』）で終えてください。
`;

/**
 * ユーザープロファイル（年齢）に応じた最初の対話メッセージ（SJTシナリオ）を生成
 */
export function buildInitialGreeting(userProfile?: UserProfile | null): string {
  const age = typeof userProfile?.age === 'number'
    ? userProfile.age
    : (userProfile?.age ? parseInt(String(userProfile.age), 10) : undefined);

  // 第1問として最も誰でもイメージしやすく、外向性・協調性の行動を引き出せるシナリオを初期提示
  const scenario = getDetailedScenarioForFactor('外向性', age);

  return [
    '本調査へのご協力ありがとうございます。',
    'これより、日常の身近な場面の中であなたがどのように振る舞うかを伺います。',
    '',
    '「自分はこういう性格だ」と難しく考えず、もしその場面になったら「自分なら実際に何と言うか・どう動くか」を、普段通りの言葉でお気軽にお話しください。',
    '',
    'それでは最初のシチュエーションです。次のような場面を想像してみてください。',
    '',
    `【状況】\n${scenario.situationText}`,
    '',
    scenario.questionText
  ].join('\n');
}
