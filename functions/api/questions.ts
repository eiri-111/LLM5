export const onRequestGet: PagesFunction = async () => {
  const questions = [
    {
      id: 1,
      text: "新しいアイデアや未知の体験、創造的な活動にワクワクする",
      dimension: "openness",
      dimension_name: "開放性",
      is_reverse: false
    },
    {
      id: 2,
      text: "物事を計画的に進め、締め切りや約束事はしっかり守るほうだ",
      dimension: "conscientiousness",
      dimension_name: "誠実性",
      is_reverse: false
    },
    {
      id: 3,
      text: "初対面の人とも打ち解けやすく、賑やかな場や交流が好きだ",
      dimension: "extraversion",
      dimension_name: "外向性",
      is_reverse: false
    },
    {
      id: 4,
      text: "他人の気持ちに共感しやすく、困っている人を見ると放っておけない",
      dimension: "agreeableness",
      dimension_name: "協調性",
      is_reverse: false
    },
    {
      id: 5,
      text: "ささいなことで心配になったり、プレッシャーで不安を感じやすい",
      dimension: "neuroticism",
      dimension_name: "情緒不安定性",
      is_reverse: false
    },
    {
      id: 6,
      text: "慣れ親しんだいつものやり方を好み、変化やリスクは避けたい",
      dimension: "openness",
      dimension_name: "開放性",
      is_reverse: true
    },
    {
      id: 7,
      text: "細かい整理整頓や計画は苦手で、その場の気分で行動しがちだ",
      dimension: "conscientiousness",
      dimension_name: "誠実性",
      is_reverse: true
    },
    {
      id: 8,
      text: "大勢で過ごすよりも、一人で静かに過ごす時間のほうが落ち着く",
      dimension: "extraversion",
      dimension_name: "外向性",
      is_reverse: true
    },
    {
      id: 9,
      text: "相手の意見に疑問があるときは、遠慮なく反論や批判をすることが多い",
      dimension: "agreeableness",
      dimension_name: "協調性",
      is_reverse: true
    },
    {
      id: 10,
      text: "予期せぬトラブルや失敗があっても、気持ちを素早く切り替えられる",
      dimension: "neuroticism",
      dimension_name: "情緒不安定性",
      is_reverse: true
    }
  ];

  const freeTextPrompt = {
    title: "自由記述（より詳細な分析のために）",
    description: "普段の休日の過ごし方、今夢中になっていること、または大切にしている信条や価値観などを自由に記入してください（任意ですが、詳しく書くほどLLMの分析精度が飛躍的に高まります）。",
    placeholder: "例：休日はカフェで読書をしたり、気になった新しいガジェットやプログラミング技術を試すのが好きです。仕事ではチームのコミュニケーションを大切にしつつ、効率的に目標を達成することにやりがいを感じます。"
  };

  return new Response(
    JSON.stringify({ questions, free_text_prompt: freeTextPrompt }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    }
  );
};
