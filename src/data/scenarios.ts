import { UserProfile } from '../types';

export interface ScenarioDefinition {
  scenarioTitle: string;
  situationText: string;
  questionText: string;
}

/**
 * 因子に応じた、再現性のある詳細な架空場面（全年代共通SJTシナリオ）を生成
 */
export function getDetailedScenarioForFactor(factor?: string, _age?: number): ScenarioDefinition {
  switch (factor) {
    case '誠実性':
      return {
        scenarioTitle: '締切・計画の破綻とスケジュール再構築',
        situationText:
          '期日までに必ず提出・準備しなければいけない大事な用事や書類（手続き・提出物など）があり、今日中に半分終わらせる計画だったとします。ところが急な用事が入ったり集中が切れたりして、全く手をつかないまま夜遅くになってしまいました。明日は朝から外せない予定が入っています。',
        questionText:
          'もし過去に似たようなご経験があれば、その時実際にどう対処されたかを教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら今夜から翌朝にかけて具体的にどう動くか」を教えてください）'
      };

    case '外向性':
      return {
        scenarioTitle: '集まりの計画・意見対立と意思決定',
        situationText:
          '友人や知人、仲間など3〜4人で、集まりで入る食事の店や行き先を決めている場面を想像してください。相談している最中、候補が2つ挙がってお互いに譲らず意見が真っ二つに分かれ、議論が平行線のまま気まずい沈黙が流れて決まらなくなってしまいました。',
        questionText:
          'もし過去に似たような場面のご経験があれば、その時その場のメンバーに対して実際にどう声をかけたり動いたりしたかを教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら具体的にどんなタイミングで何と声をかけるか、どう立ち回るか」を教えてください）'
      };

    case '協調性':
      return {
        scenarioTitle: '仲間内での作業遅れ・困っている相手への関わりと協力',
        situationText:
          '友人や仲間、同僚など数人で一緒に作業や準備を進めている場面を想像してください。メンバーの1人が自分の担当分でつまずいて遅れており、焦りや疲れから周囲と少しギスギスした雰囲気になりかけています。一方で、あなた自身の作業もまだ残っている状態です。',
        questionText:
          'もし過去に似たような場面のご経験があれば、その時その相手や周囲に対して実際にどう声をかけたり行動したりしたかを教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら相手や周囲にどう接するか、どう動くか」を教えてください）'
      };

    case '開放性':
      return {
        scenarioTitle: '休日の過ごし方・新しい刺激 vs いつもの定番',
        situationText:
          '休日に、誰とも約束がなく丸一日フリーな時間ができたとします。部屋で過ごしていて、ふと「何か普段とは違う面白いことや、新しい刺激に触れてみたい」という気分になりました。',
        questionText:
          'もし最近このような気分になったご経験があれば、その時実際にどう過ごされたか、当時の具体的な行動を教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら具体的にどう過ごすか」を教えてください）'
      };

    case '情緒安定性':
    default:
      return {
        scenarioTitle: '予定外のトラブル・他人のミスと気分の切り替え',
        situationText:
          '誰かと一緒に予定を進めている最中（または待ち合わせなど）に、相手のうっかりミスや手違いで、予定が大きく狂ったり、自分にも余計な手間がかかるトラブルが発生してしまった状況を想像してください。',
        questionText:
          'もし過去に似たようなトラブルのご経験があれば、その瞬間相手に実際にどのような言葉や態度で接し、その場をどう対応したか（または気持ちをどう切り替えたか）を教えていただけますか？（思い当たる経験がなければ、「この状況になったらご自身なら相手にどう接し、どう対応するか」を教えてください）'
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
  positiveBehavior: string; // 該当した場合に高特性として評価される具体的行動事実
  negativeBehavior: string; // 該当した場合に低特性（内向性・柔軟性・静観等）として評価される具体的行動事実
  concretenessCriteria: string; // 単なる一般論・抽象論ではなく客観的行動エビデンスが語られたか
}

export const BARS_RUBRICS: BARSBehaviorCriteria[] = [
  // 開放性 (Openness)
  {
    facetKey: 'facet_openness_intellectual',
    factor: '開放性',
    facetName: '知的好奇心',
    positiveBehavior: '未知の概念や抽象的な仕組みに対して、自ら背景・理由を調べたり深く考察したりする行動を取った事実があるか',
    negativeBehavior: '複雑な理論や未知の仕組みに深入りせず、実践的・実用的な情報や手近な定番の事柄だけにとどめる行動事実があるか',
    concretenessCriteria: '調べた対象や思考プロセスに関する具体的・客観的なエピソードが語られているか'
  },
  {
    facetKey: 'facet_openness_aesthetic',
    factor: '開放性',
    facetName: '美的好奇心',
    positiveBehavior: 'デザイン・芸術・音楽・自然の美しさや雰囲気・文化的な体験に能動的に浸ったり鑑賞したりする行動を取った事実があるか',
    negativeBehavior: '芸術・美的体験や情緒的な鑑賞に特別な関心を払わず、機能性・実利性を優先する行動事実があるか',
    concretenessCriteria: '実際に触れた作品や場所・鑑賞行動についての具体的描写があるか'
  },
  {
    facetKey: 'facet_openness_creative',
    factor: '開放性',
    facetName: '創造力',
    positiveBehavior: '前例通りのやり方に固執せず、独自の工夫や新しいアプローチ・オリジナルの解決策を試した行動事実があるか',
    negativeBehavior: '自己流の工夫を避け、確立された手順や過去の実績・マニュアル通りの定番のやり方を忠実に選んだ行動事実があるか',
    concretenessCriteria: '試した工夫やアプローチの具体的な内容・手順が述べられているか'
  },

  // 誠実性 (Conscientiousness)
  {
    facetKey: 'facet_conscientiousness_organization',
    factor: '誠実性',
    facetName: '組織化',
    positiveBehavior: '予定が狂ったりタスクが逼迫した際、優先順位を整理し直し、段取り・スケジュールを具体的に組み立て直した行動事実があるか',
    negativeBehavior: '計画の厳密な組み直しを行わず、その場の思いつきや成り行き任せで柔軟・即興的に対応した行動事実があるか',
    concretenessCriteria: '優先順位の付け方やスケジュールの組み直し手順が具体的に語られているか'
  },
  {
    facetKey: 'facet_conscientiousness_productiveness',
    factor: '誠実性',
    facetName: '生産性',
    positiveBehavior: '途中で投げ出したり先送りにせず、決めたタスクや役割を最後までやり遂げる・リカバリーを実行した行動事実があるか',
    negativeBehavior: '無理にやり遂げようとせず、途中で諦めて寝る・先送りする・最低限の放棄を選んだ行動事実があるか',
    concretenessCriteria: 'タスクへの取り組み方やリカバリーの具体的な実行内容が語られているか'
  },
  {
    facetKey: 'facet_conscientiousness_responsibility',
    factor: '誠実性',
    facetName: '責任感',
    positiveBehavior: '他者や締め切りとの約束を守るため、事前に連絡・相談を入れたり、自分の役割を全うしようと誠実に行動した事実があるか',
    negativeBehavior: '相手への事前連絡や相談を怠ったり、連絡を後回しにして事態を放置した行動事実があるか',
    concretenessCriteria: '連絡のタイミングや伝えた内容など、責任ある行動の具体的事実が語られているか'
  },

  // 外向性 (Extraversion)
  {
    facetKey: 'facet_extraversion_sociability',
    factor: '外向性',
    facetName: '社交性',
    positiveBehavior: '沈黙や集まりの場で、自ら進んで他者に話しかけたり、会話の口火を切ってコミュニケーションを取った行動事実があるか',
    negativeBehavior: '自ら話しかけることを控え、沈黙を保つ・一人で静かに過ごす・他者からの話しかけを待つ行動事実があるか',
    concretenessCriteria: '声かけの有無や対人コミュニケーションの実際の様子が具体的に語られているか'
  },
  {
    facetKey: 'facet_extraversion_assertiveness',
    factor: '外向性',
    facetName: '主張性',
    positiveBehavior: '周りに流されるだけでなく、自分の意見・希望・提案を堂々と表明し、全体の意思決定をリードしようとした行動事実があるか',
    negativeBehavior: '自分の希望や主張を押し出さず、他者の意見に同調する・決定を周囲に完全に任せて従った行動事実があるか',
    concretenessCriteria: '提案した内容や意思表明の具体的なセリフ・立ち回りが語られているか'
  },
  {
    facetKey: 'facet_extraversion_activity',
    factor: '外向性',
    facetName: '活動性',
    positiveBehavior: 'インドアで静止するだけでなく、能動的に外に出かけたり、活発に動き回ってエネルギーを行動に移した事実があるか',
    negativeBehavior: '活発な移動や外出を避け、自宅や部屋で静かにリラックスして省エネに過ごした行動事実があるか',
    concretenessCriteria: '過ごし方や外出・行動の活動量に関する具体的エピソードが語られているか'
  },

  // 協調性 (Agreeableness)
  {
    facetKey: 'facet_agreeableness_compassion',
    factor: '協調性',
    facetName: '思いやり',
    positiveBehavior: '他者の負担や立場・感情に寄り添い、相手を助けたり気遣う配慮の行動・声かけを行った事実があるか',
    negativeBehavior: '他者の感情や事情に深入りせず、自分の都合や利害・効率を最優先した行動事実があるか',
    concretenessCriteria: '相手への配慮や声かけの具体的な振る舞いが語られているか'
  },
  {
    facetKey: 'facet_agreeableness_respect',
    factor: '協調性',
    facetName: '敬意',
    positiveBehavior: '意見が対立したり相手がミスした際にも、頭ごなしに怒ったり攻撃せず、相手に敬意を払い穏やかに接した行動事実があるか',
    negativeBehavior: '相手のミスや対立に対して不満や苛立ちを露わにする、または批判的・冷淡な態度を取った行動事実があるか',
    concretenessCriteria: '対立やミス発生時の実際の口調・接し方の具体的事実が語られているか'
  },
  {
    facetKey: 'facet_agreeableness_trust',
    factor: '協調性',
    facetName: '信頼',
    positiveBehavior: '周囲の人を過剰に疑わず、好意的に受け止めて協調・協力して進めようとした行動事実があるか',
    negativeBehavior: '他者の意図や能力に疑念を抱き、警戒して自分一人で抱え込む・距離を置いた行動事実があるか',
    concretenessCriteria: '他者との協力体制や信頼に関する具体的姿勢が語られているか'
  },

  // 情緒安定性 (Neuroticism 逆転 / Emotional Stability)
  {
    facetKey: 'facet_neuroticism_anxiety',
    factor: '情緒安定性',
    facetName: '不安の低さ・ストレス対処',
    positiveBehavior: 'プレッシャーや不測の事態に直面した際、パニックにならず深呼吸や気分転換を行い、冷静に自分を落ち着かせた行動事実があるか',
    negativeBehavior: '突発的なトラブルや切迫に対して強い焦りや動揺・不安を感じて取り乱した行動事実があるか',
    concretenessCriteria: 'プレッシャー直面時の心理状態と対処行動の具体性が語られているか'
  },
  {
    facetKey: 'facet_neuroticism_depression',
    factor: '情緒安定性',
    facetName: '抑うつの低さ・気分の安定',
    positiveBehavior: 'トラブルや不本意な出来事の後、過度に落ち込み続けたり自責の念に囚われず、気持ちを前向きに切り替えた行動事実があるか',
    negativeBehavior: '嫌な出来事やミスを長く引きずり、落ち込んだりモヤモヤした気分から抜け出せなかった行動事実があるか',
    concretenessCriteria: '気分の切り替えにかかった時間や事後の過ごし方の具体的事実が語られているか'
  },
  {
    facetKey: 'facet_neuroticism_volatility',
    factor: '情緒安定性',
    facetName: '感情変動の低さ・動じにくさ',
    positiveBehavior: '突発的なアクシデントや他人の手違いに対して、感情的にならず冷静に対処策を実行した行動事実があるか',
    negativeBehavior: '予期せぬ変更やトラブルに対して感情の起伏が激しくなり、苛立ちや落胆を行動・態度に出した事実があるか',
    concretenessCriteria: 'アクシデント発生時の瞬間的なリアクションの具体性が語られているか'
  }
];

/**
 * 受検態度・妥当性メタチェック（5問）の基準
 */
export const VALIDITY_CRITERIA = {
  social_desirability: '回答が一般的な「こうあるべき」という模範解答・建前ばかりで構成され、本人の生々しい行動が隠されている傾向があるか',
  mock_or_careless: '冗談、からかい、あからさまな矛盾、または無作為・不真面目な回答傾向が見られるか',
  concrete_detail: '発言内に具体的な状況・他者との会話セリフ・取った行動の手順などの客観的描写が豊富に含まれているか',
  defensiveness: '質問に対して直接答えず話題を逸らす、または自己開示を意図的に拒絶・防衛する傾向があるか',
  emotional_expressiveness: '取り繕わず、自分の素直な感情や弱み・ありのままの反応を率直に開示して語っているか'
};

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
